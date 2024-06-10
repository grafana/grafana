package schedule

import (
	context "context"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/util"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type recordingRule struct {
	ctx    context.Context
	evalCh chan *Evaluation
	stopFn util.CancelCauseFunc

	maxAttempts int64

	clock          clock.Clock
	evalFactory    eval.EvaluatorFactory
	featureToggles featuremgmt.FeatureToggles

	// Event hooks that are only used in tests.
	evalAppliedHook evalAppliedFunc

	logger  log.Logger
	metrics *metrics.Scheduler
	tracer  tracing.Tracer

	writer writer.Writer
}

func newRecordingRule(parent context.Context, maxAttempts int64, clock clock.Clock, evalFactory eval.EvaluatorFactory, ft featuremgmt.FeatureToggles, logger log.Logger, metrics *metrics.Scheduler, tracer tracing.Tracer, writer writer.Writer) *recordingRule {
	ctx, stop := util.WithCancelCause(parent)
	return &recordingRule{
		ctx:            ctx,
		evalCh:         make(chan *Evaluation),
		stopFn:         stop,
		clock:          clock,
		evalFactory:    evalFactory,
		featureToggles: ft,
		maxAttempts:    maxAttempts,
		logger:         logger,
		metrics:        metrics,
		tracer:         tracer,
		writer:         writer,
	}
}

func (r *recordingRule) Eval(eval *Evaluation) (bool, *Evaluation) {
	// read the channel in unblocking manner to make sure that there is no concurrent send operation.
	var droppedMsg *Evaluation
	select {
	case droppedMsg = <-r.evalCh:
	default:
	}

	select {
	case r.evalCh <- eval:
		return true, droppedMsg
	case <-r.ctx.Done():
		return false, droppedMsg
	}
}

func (r *recordingRule) Update(lastVersion RuleVersionAndPauseStatus) bool {
	return true
}

func (r *recordingRule) Stop(reason error) {
	if r.stopFn != nil {
		r.stopFn(reason)
	}
}

func (r *recordingRule) Run(key ngmodels.AlertRuleKey) error {
	ctx := ngmodels.WithRuleKey(r.ctx, key)
	logger := r.logger.FromContext(ctx)
	logger.Debug("Recording rule routine started")

	for {
		select {
		case eval, ok := <-r.evalCh:
			if !ok {
				logger.Debug("Evaluation channel has been closed. Exiting")
				return nil
			}
			if !r.featureToggles.IsEnabled(ctx, featuremgmt.FlagGrafanaManagedRecordingRules) {
				logger.Warn("Recording rule scheduled but toggle is not enabled. Skipping")
				return nil
			}
			// TODO: Skipping the "evalRunning" guard that the alert rule routine does, because it seems to be dead code and impossible to hit.
			// TODO: Either implement me or remove from alert rules once investigated.

			r.doEvaluate(ctx, eval)
		case <-ctx.Done():
			logger.Debug("Stopping recording rule routine")
			return nil
		}
	}
}

func (r *recordingRule) doEvaluate(ctx context.Context, ev *Evaluation) {
	logger := r.logger.FromContext(ctx).New("now", ev.scheduledAt, "fingerprint", ev.Fingerprint())
	orgID := fmt.Sprint(ev.rule.OrgID)
	evalDuration := r.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotal := r.metrics.EvalTotal.WithLabelValues(orgID)
	evalStart := r.clock.Now()

	defer func() {
		evalTotal.Inc()
		evalDuration.Observe(r.clock.Now().Sub(evalStart).Seconds())
		r.evaluationDoneTestHook(ev)
	}()

	if ev.rule.IsPaused {
		logger.Debug("Skip recording rule evaluation because it is paused")
		return
	}

	ctx, span := r.tracer.Start(ctx, "recording rule execution", trace.WithAttributes(
		attribute.String("rule_uid", ev.rule.UID),
		attribute.Int64("org_id", ev.rule.OrgID),
		attribute.Int64("rule_version", ev.rule.Version),
		attribute.String("rule_fingerprint", ev.Fingerprint().String()),
		attribute.String("tick", ev.scheduledAt.UTC().Format(time.RFC3339Nano)),
	))
	defer span.End()

	for attempt := int64(1); attempt <= r.maxAttempts; attempt++ {
		logger := logger.New("attempt", attempt)
		if ctx.Err() != nil {
			span.SetStatus(codes.Error, "rule evaluation cancelled")
			logger.Error("Skipping recording rule evaluation because context has been cancelled")
			return
		}

		err := r.tryEvaluation(ctx, ev, logger)
		if err == nil {
			return
		}

		logger.Error("Failed to evaluate rule", "attempt", attempt, "error", err)
		select {
		case <-ctx.Done():
			logger.Error("Context has been cancelled while backing off", "attempt", attempt)
			return
		case <-time.After(retryDelay):
			continue
		}
	}
}

func (r *recordingRule) tryEvaluation(ctx context.Context, ev *Evaluation, logger log.Logger) error {
	orgID := fmt.Sprint(ev.rule.OrgID)
	evalAttemptTotal := r.metrics.EvalAttemptTotal.WithLabelValues(orgID)
	evalAttemptFailures := r.metrics.EvalAttemptFailures.WithLabelValues(orgID)
	evalTotalFailures := r.metrics.EvalFailures.WithLabelValues(orgID)

	evalStart := r.clock.Now()
	evalCtx := eval.NewContext(ctx, SchedulerUserFor(ev.rule.OrgID))
	result, err := r.buildAndExecutePipeline(ctx, evalCtx, ev, logger)
	evalDur := r.clock.Now().Sub(evalStart)

	evalAttemptTotal.Inc()
	span := trace.SpanFromContext(ctx)

	// TODO: In some cases, err can be nil but the dataframe itself contains embedded error frames. Parse these out like we do when evaluating alert rules.
	// TODO: (Maybe, refactor something in eval package so we can use shared code for this)
	if err != nil {
		evalAttemptFailures.Inc()
		// TODO: Only errors embedded in the frame can be considered retryable.
		// TODO: Since we are not handling these yet per the above TODO, we can blindly consider all errors to be non-retryable for now, and just exit.
		evalTotalFailures.Inc()
		span.SetStatus(codes.Error, "rule evaluation failed")
		span.RecordError(err)
		return fmt.Errorf("server side expressions pipeline returned an error: %w", err)
	}

	logger.Info("Recording rule evaluated", "results", result, "duration", evalDur)
	span.AddEvent("rule evaluated", trace.WithAttributes(
		attribute.Int64("results", int64(len(result.Responses))),
	))

	frames, err := r.frameRef(ev.rule.Record.From, result)
	if err != nil {
		span.SetStatus(codes.Error, "failed to extract frames from rule evaluation")
		span.RecordError(err)
		return fmt.Errorf("failed to extract frames from rule evaluation: %w", err)
	}

	writeStart := r.clock.Now()
	err = r.writer.Write(ctx, ev.rule.Record.Metric, writeStart, frames, ev.rule.Labels)
	writeDur := r.clock.Now().Sub(writeStart)

	if err != nil {
		span.SetStatus(codes.Error, "failed to write metrics")
		span.RecordError(err)
		return fmt.Errorf("metric remote write failed: %w", err)
	}

	logger.Debug("Metrics written", "duration", writeDur)
	span.AddEvent("metrics written", trace.WithAttributes(
		attribute.Int64("frames", int64(len(frames))),
	))

	return nil
}

func (r *recordingRule) buildAndExecutePipeline(ctx context.Context, evalCtx eval.EvaluationContext, ev *Evaluation, logger log.Logger) (*backend.QueryDataResponse, error) {
	start := r.clock.Now()
	evaluator, err := r.evalFactory.Create(evalCtx, ev.rule.GetEvalCondition())
	if err != nil {
		logger.Error("Failed to build rule evaluator", "error", err)
		return nil, err
	}
	results, err := evaluator.EvaluateRaw(ctx, ev.scheduledAt)
	if err != nil {
		logger.Error("Failed to evaluate rule", "error", err, "duration", r.clock.Now().Sub(start))
	}
	return results, err
}

func (r *recordingRule) evaluationDoneTestHook(ev *Evaluation) {
	if r.evalAppliedHook == nil {
		return
	}

	r.evalAppliedHook(ev.rule.GetKey(), ev.scheduledAt)
}

func (r *recordingRule) frameRef(refID string, resp *backend.QueryDataResponse) (data.Frames, error) {
	if len(resp.Responses) == 0 {
		return nil, fmt.Errorf("no responses returned from rule evaluation")
	}

	for ref, resp := range resp.Responses {
		if ref == refID {
			return resp.Frames, nil
		}
	}

	return nil, fmt.Errorf("no response with refID %s found in rule evaluation", refID)
}
