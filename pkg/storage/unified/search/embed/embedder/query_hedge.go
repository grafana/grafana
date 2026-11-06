package embedder

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
)

var queryHedgeLogger = log.New("unified.embedder.query_hedge")

// QueryAttempt makes one application call to an embedding provider. Provider
// adapters decide the retry policy for the original and extra attempts.
type QueryAttempt func(context.Context) (EmbedTextOutput, error)

type QueryAttemptKind string

const (
	QueryAttemptOriginal QueryAttemptKind = "original"
	QueryAttemptExtra    QueryAttemptKind = "extra"
)

type QueryAttemptOutcome string

const (
	QueryAttemptSuccess   QueryAttemptOutcome = "success"
	QueryAttemptError     QueryAttemptOutcome = "error"
	QueryAttemptCanceled  QueryAttemptOutcome = "canceled"
	QueryAttemptQuota     QueryAttemptOutcome = "quota"
	QueryAttemptMalformed QueryAttemptOutcome = "malformed"
)

// QueryHedgeObserver receives bounded provider and attempt values. An attempt
// completion can arrive after Run returns when the canceled loser finishes.
type QueryHedgeObserver interface {
	AttemptStarted(provider string, kind QueryAttemptKind)
	AttemptFinished(provider string, kind QueryAttemptKind, outcome QueryAttemptOutcome, inputTokens int)
	HedgeSkipped(provider string)
	Winner(provider string, kind QueryAttemptKind)
	ExtraInFlight(provider string, delta int)
}

// QueryHedger limits extra calls across all providers that share this instance.
// A slot is held until the provider call actually returns, including when its
// caller has already completed or canceled.
type QueryHedger struct {
	delay    time.Duration
	slots    chan struct{}
	observer QueryHedgeObserver
}

func NewQueryHedger(delay time.Duration, maxConcurrent int, observer QueryHedgeObserver) (*QueryHedger, error) {
	if maxConcurrent < 0 {
		return nil, fmt.Errorf("query hedge max concurrent must be nonnegative: %d", maxConcurrent)
	}
	if maxConcurrent > 0 && delay <= 0 {
		return nil, fmt.Errorf("query hedge delay must be positive when enabled: %s", delay)
	}
	return &QueryHedger{delay: delay, slots: make(chan struct{}, maxConcurrent), observer: observer}, nil
}

type queryAttemptResult struct {
	out  EmbedTextOutput
	err  error
	kind QueryAttemptKind
}

// Run returns the first valid query vector, using one extra attempt only when
// the original remains pending after the delay and extra capacity is free.
// Both attempts inherit ctx's deadline; the loser is canceled asynchronously.
func (h *QueryHedger) Run(ctx context.Context, input EmbedTextInput, provider string, original, extra QueryAttempt, classifyError func(error) QueryAttemptOutcome) (EmbedTextOutput, error) {
	if ctx.Err() != nil {
		return EmbedTextOutput{}, ctx.Err()
	}
	if h == nil || cap(h.slots) == 0 || input.Task != TaskRetrievalQuery || len(input.Texts) != 1 {
		return original(ctx)
	}
	provider = boundedQueryProvider(provider)

	originalCtx, cancelOriginal := context.WithCancel(ctx)
	defer cancelOriginal()
	originalResult := make(chan queryAttemptResult, 1)
	h.startAttempt(originalCtx, provider, QueryAttemptOriginal, original, classifyError, originalResult, false)

	timer := time.NewTimer(h.delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return EmbedTextOutput{}, ctx.Err()
	case result := <-originalResult:
		return h.selectOriginal(ctx, provider, result)
	case <-timer.C:
	}
	// A completed original or canceled caller can race with the timer. Prefer
	// either over launching an unnecessary duplicate when already observable.
	if ctx.Err() != nil {
		return EmbedTextOutput{}, ctx.Err()
	}
	select {
	case result := <-originalResult:
		return h.selectOriginal(ctx, provider, result)
	default:
	}
	select {
	case h.slots <- struct{}{}:
	default:
		queryHedgeLogger.Debug("Extra query embedding attempt skipped", "provider", provider)
		if h.observer != nil {
			h.observer.HedgeSkipped(provider)
		}
		select {
		case <-ctx.Done():
			return EmbedTextOutput{}, ctx.Err()
		case result := <-originalResult:
			return h.selectOriginal(ctx, provider, result)
		}
	}
	if ctx.Err() != nil {
		<-h.slots
		return EmbedTextOutput{}, ctx.Err()
	}

	extraCtx, cancelExtra := context.WithCancel(ctx)
	defer cancelExtra()
	extraResult := make(chan queryAttemptResult, 1)
	queryHedgeLogger.Debug("Extra query embedding attempt started", "provider", provider)
	if h.observer != nil {
		h.observer.ExtraInFlight(provider, 1)
	}
	h.startAttempt(extraCtx, provider, QueryAttemptExtra, extra, classifyError, extraResult, true)

	var firstError *queryAttemptResult
	var originalError *queryAttemptResult
	for {
		select {
		case <-ctx.Done():
			return EmbedTextOutput{}, ctx.Err()
		case result := <-originalResult:
			if result.err == nil {
				return h.selectWinner(ctx, provider, result)
			}
			originalError = &result
			if firstError != nil {
				if ctx.Err() != nil {
					return EmbedTextOutput{}, ctx.Err()
				}
				return result.out, result.err
			}
			firstError = &result
			originalResult = nil
		case result := <-extraResult:
			if result.err == nil {
				return h.selectWinner(ctx, provider, result)
			}
			if originalError != nil {
				if ctx.Err() != nil {
					return EmbedTextOutput{}, ctx.Err()
				}
				return originalError.out, originalError.err
			}
			firstError = &result
			extraResult = nil
		}
	}
}

func boundedQueryProvider(provider string) string {
	switch provider {
	case "vertex", "bedrock", "azure":
		return provider
	default:
		return "unknown"
	}
}

func (h *QueryHedger) selectOriginal(ctx context.Context, provider string, result queryAttemptResult) (EmbedTextOutput, error) {
	if ctx.Err() != nil {
		return EmbedTextOutput{}, ctx.Err()
	}
	if result.err == nil {
		return h.selectWinner(ctx, provider, result)
	}
	return result.out, result.err
}

func (h *QueryHedger) selectWinner(ctx context.Context, provider string, result queryAttemptResult) (EmbedTextOutput, error) {
	if ctx.Err() != nil {
		return EmbedTextOutput{}, ctx.Err()
	}
	if h.observer != nil {
		h.observer.Winner(provider, result.kind)
	}
	queryHedgeLogger.Debug("Query embedding attempt selected", "provider", provider, "attempt", result.kind)
	return result.out, nil
}

func (h *QueryHedger) startAttempt(ctx context.Context, provider string, kind QueryAttemptKind, call QueryAttempt, classifyError func(error) QueryAttemptOutcome, results chan<- queryAttemptResult, releaseSlot bool) {
	if h.observer != nil {
		h.observer.AttemptStarted(provider, kind)
	}
	go func() {
		if releaseSlot {
			defer func() {
				<-h.slots
				if h.observer != nil {
					h.observer.ExtraInFlight(provider, -1)
				}
			}()
		}
		attemptCtx, span := tracer.Start(ctx, "unified.embedder.QueryAttempt")
		span.SetAttributes(attribute.String("provider", provider), attribute.String("attempt", string(kind)))
		defer span.End()
		out, err := call(attemptCtx)
		outcome := QueryAttemptSuccess
		if err == nil && (len(out.Embeddings) != 1 || len(out.Embeddings[0].Dense) == 0) {
			err = errors.New("query embedding attempt returned an invalid vector")
			outcome = QueryAttemptMalformed
		} else if err != nil {
			outcome = QueryAttemptError
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				outcome = QueryAttemptCanceled
			} else if classifyError != nil && classifyError(err) == QueryAttemptQuota {
				outcome = QueryAttemptQuota
			}
		}
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		if h.observer != nil {
			h.observer.AttemptFinished(provider, kind, outcome, out.InputTokens)
		}
		results <- queryAttemptResult{out: out, err: err, kind: kind}
	}()
}
