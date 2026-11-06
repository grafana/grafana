package embedder_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type hedgeEvents struct {
	mu       sync.Mutex
	started  map[embedder.QueryAttemptKind]int
	finished map[embedder.QueryAttemptKind]int
	tokens   map[embedder.QueryAttemptKind]int
	outcomes map[embedder.QueryAttemptKind]embedder.QueryAttemptOutcome
	winner   embedder.QueryAttemptKind
	skipped  int
	inFlight int
	provider string
}

func newHedgeEvents() *hedgeEvents {
	return &hedgeEvents{started: make(map[embedder.QueryAttemptKind]int), finished: make(map[embedder.QueryAttemptKind]int), tokens: make(map[embedder.QueryAttemptKind]int), outcomes: make(map[embedder.QueryAttemptKind]embedder.QueryAttemptOutcome)}
}

func (e *hedgeEvents) AttemptStarted(provider string, kind embedder.QueryAttemptKind) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.provider = provider
	e.started[kind]++
}

func (e *hedgeEvents) AttemptFinished(_ string, kind embedder.QueryAttemptKind, outcome embedder.QueryAttemptOutcome, tokens int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.finished[kind]++
	e.tokens[kind] += tokens
	e.outcomes[kind] = outcome
}

func (e *hedgeEvents) HedgeSkipped(string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.skipped++
}

func (e *hedgeEvents) Winner(_ string, kind embedder.QueryAttemptKind) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.winner = kind
}

func (e *hedgeEvents) ExtraInFlight(_ string, delta int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.inFlight += delta
}

func TestQueryHedgerFastOriginalDoesNotStartExtra(t *testing.T) {
	hedger, err := embedder.NewQueryHedger(time.Second, 4, nil)
	require.NoError(t, err)
	input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
	calls := 0
	original := func(context.Context) (embedder.EmbedTextOutput, error) {
		calls++
		return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{1}}}}, nil
	}
	extra := func(context.Context) (embedder.EmbedTextOutput, error) {
		calls++
		return embedder.EmbedTextOutput{}, errors.New("unexpected extra call")
	}

	out, err := hedger.Run(context.Background(), input, "vertex", original, extra, nil)
	require.NoError(t, err)
	require.Equal(t, 1, calls)
	require.Equal(t, float32(1), out.Embeddings[0].Dense[0])
}

func TestQueryHedgerEarlyOriginalErrorReturnsWithoutExtra(t *testing.T) {
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	want := errors.New("original failed")
	extraCalls := 0
	_, err = hedger.Run(t.Context(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}, "vertex", func(context.Context) (embedder.EmbedTextOutput, error) {
		return embedder.EmbedTextOutput{}, want
	}, func(context.Context) (embedder.EmbedTextOutput, error) {
		extraCalls++
		return embedder.EmbedTextOutput{}, nil
	}, nil)
	require.ErrorIs(t, err, want)
	require.Zero(t, extraCalls)
}

func TestQueryHedgerExtraWinsAndCancelsOriginal(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 4, nil)
		require.NoError(t, err)
		originalDone := make(chan struct{})
		var calls atomic.Int32
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		out, err := hedger.Run(context.Background(), input, "vertex", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			calls.Add(1)
			<-ctx.Done()
			close(originalDone)
			return embedder.EmbedTextOutput{}, ctx.Err()
		}, func(context.Context) (embedder.EmbedTextOutput, error) {
			calls.Add(1)
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{2}}}}, nil
		}, nil)
		require.NoError(t, err)
		require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
		require.Equal(t, int32(2), calls.Load())
		<-originalDone
	})
}

func TestQueryHedgerOriginalWinsAndCancelsPendingExtra(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		events := newHedgeEvents()
		hedger, err := embedder.NewQueryHedger(time.Second, 1, events)
		require.NoError(t, err)
		originalRelease := make(chan struct{})
		extraStarted := make(chan struct{})
		extraCanceled := make(chan struct{})
		extraReturn := make(chan struct{})
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		result := make(chan struct {
			out embedder.EmbedTextOutput
			err error
		}, 1)
		go func() {
			out, err := hedger.Run(context.Background(), input, "vertex", func(context.Context) (embedder.EmbedTextOutput, error) {
				<-originalRelease
				return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{1}}}}, nil
			}, func(ctx context.Context) (embedder.EmbedTextOutput, error) {
				close(extraStarted)
				<-ctx.Done()
				close(extraCanceled)
				<-extraReturn
				return embedder.EmbedTextOutput{}, ctx.Err()
			}, nil)
			result <- struct {
				out embedder.EmbedTextOutput
				err error
			}{out, err}
		}()
		<-extraStarted
		close(originalRelease)
		got := <-result
		require.NoError(t, got.err)
		require.Equal(t, float32(1), got.out.Embeddings[0].Dense[0])
		<-extraCanceled
		events.mu.Lock()
		require.Equal(t, 1, events.inFlight)
		events.mu.Unlock()
		close(extraReturn)
		synctest.Wait()
		events.mu.Lock()
		require.Zero(t, events.inFlight)
		require.Equal(t, embedder.QueryAttemptOriginal, events.winner)
		events.mu.Unlock()

		out, err := hedger.Run(context.Background(), input, "bedrock", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			<-ctx.Done()
			return embedder.EmbedTextOutput{}, ctx.Err()
		}, func(context.Context) (embedder.EmbedTextOutput, error) {
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{2}}}}, nil
		}, nil)
		require.NoError(t, err)
		require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
		synctest.Wait()
	})
}

func TestQueryHedgerWaitsForValidSuccessAndReturnsOriginalFailure(t *testing.T) {
	for _, firstFailure := range []string{"original", "extra"} {
		t.Run(firstFailure, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				events := newHedgeEvents()
				hedger, err := embedder.NewQueryHedger(time.Second, 1, events)
				require.NoError(t, err)
				originalRelease := make(chan struct{})
				extraRelease := make(chan struct{})
				extraStarted := make(chan struct{})
				originalErr := errors.New("original failed")
				input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
				result := make(chan error, 1)
				go func() {
					_, err := hedger.Run(context.Background(), input, "vertex", func(context.Context) (embedder.EmbedTextOutput, error) {
						<-originalRelease
						return embedder.EmbedTextOutput{}, originalErr
					}, func(context.Context) (embedder.EmbedTextOutput, error) {
						close(extraStarted)
						<-extraRelease
						return embedder.EmbedTextOutput{}, errors.New("extra failed")
					}, nil)
					result <- err
				}()
				<-extraStarted
				if firstFailure == "original" {
					close(originalRelease)
				} else {
					close(extraRelease)
				}
				synctest.Wait()
				select {
				case <-result:
					t.Fatal("a single failed attempt returned before the other completed")
				default:
				}
				if firstFailure == "original" {
					close(extraRelease)
				} else {
					close(originalRelease)
				}
				require.ErrorIs(t, <-result, originalErr)
				synctest.Wait()
				events.mu.Lock()
				defer events.mu.Unlock()
				require.Equal(t, 1, events.started[embedder.QueryAttemptOriginal])
				require.Equal(t, 1, events.started[embedder.QueryAttemptExtra])
				require.Equal(t, 1, events.finished[embedder.QueryAttemptOriginal])
				require.Equal(t, 1, events.finished[embedder.QueryAttemptExtra])
			})
		})
	}
}

func TestQueryHedgerExtraErrorWaitsForOriginalSuccess(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		releaseOriginal := make(chan struct{})
		extraFinished := make(chan struct{})
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		result := make(chan struct {
			out embedder.EmbedTextOutput
			err error
		}, 1)
		go func() {
			out, err := hedger.Run(context.Background(), input, "azure", func(context.Context) (embedder.EmbedTextOutput, error) {
				<-releaseOriginal
				return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{6}}}}, nil
			}, func(context.Context) (embedder.EmbedTextOutput, error) {
				close(extraFinished)
				return embedder.EmbedTextOutput{}, errors.New("extra failed")
			}, nil)
			result <- struct {
				out embedder.EmbedTextOutput
				err error
			}{out, err}
		}()
		<-extraFinished
		synctest.Wait()
		select {
		case <-result:
			t.Fatal("extra failure returned before the original succeeded")
		default:
		}
		close(releaseOriginal)
		got := <-result
		require.NoError(t, got.err)
		require.Equal(t, float32(6), got.out.Embeddings[0].Dense[0])
	})
}

func TestQueryHedgerMalformedOriginalCannotBeatValidExtra(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		originalRelease := make(chan struct{})
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		out, err := hedger.Run(context.Background(), input, "azure", func(context.Context) (embedder.EmbedTextOutput, error) {
			<-originalRelease
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{}}}, nil
		}, func(context.Context) (embedder.EmbedTextOutput, error) {
			close(originalRelease)
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{3}}}}, nil
		}, nil)
		require.NoError(t, err)
		require.Equal(t, float32(3), out.Embeddings[0].Dense[0])
	})
}

func TestQueryHedgerCanceledExtraKeepsSlotUntilProviderReturns(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		firstCtx, cancelFirst := context.WithCancel(context.Background())
		defer cancelFirst()
		extraStarted := make(chan struct{})
		releaseExtra := make(chan struct{})
		firstResult := make(chan error, 1)
		go func() {
			_, err := hedger.Run(firstCtx, input, "vertex", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
				<-ctx.Done()
				return embedder.EmbedTextOutput{}, ctx.Err()
			}, func(context.Context) (embedder.EmbedTextOutput, error) {
				close(extraStarted)
				<-releaseExtra // Models a provider that has not returned after cancellation.
				return embedder.EmbedTextOutput{}, context.Canceled
			}, nil)
			firstResult <- err
		}()
		<-extraStarted
		cancelFirst()
		require.ErrorIs(t, <-firstResult, context.Canceled)

		secondExtraCalls := 0
		secondOut, err := hedger.Run(context.Background(), input, "bedrock", func(context.Context) (embedder.EmbedTextOutput, error) {
			<-time.After(2 * time.Second)
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{5}}}}, nil
		}, func(context.Context) (embedder.EmbedTextOutput, error) {
			secondExtraCalls++
			return embedder.EmbedTextOutput{}, errors.New("extra should be skipped")
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 0, secondExtraCalls)
		require.Equal(t, float32(5), secondOut.Embeddings[0].Dense[0])
		close(releaseExtra)
		synctest.Wait()
	})
}

func TestQueryHedgerRejectsInvalidSettings(t *testing.T) {
	_, err := embedder.NewQueryHedger(time.Second, -1, nil)
	require.ErrorContains(t, err, "max concurrent")
	_, err = embedder.NewQueryHedger(0, 1, nil)
	require.ErrorContains(t, err, "delay")
	_, err = embedder.NewQueryHedger(0, 0, nil)
	require.NoError(t, err)
}

func TestQueryHedgerReportsLateLoserTokensOnce(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		events := newHedgeEvents()
		hedger, err := embedder.NewQueryHedger(time.Second, 1, events)
		require.NoError(t, err)
		releaseOriginal := make(chan struct{})
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		out, err := hedger.Run(context.Background(), input, "vertex", func(context.Context) (embedder.EmbedTextOutput, error) {
			<-releaseOriginal
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{1}}}, InputTokens: 7}, nil
		}, func(context.Context) (embedder.EmbedTextOutput, error) {
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{2}}}, InputTokens: 8}, nil
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 8, out.InputTokens)
		close(releaseOriginal)
		synctest.Wait()
		events.mu.Lock()
		defer events.mu.Unlock()
		require.Equal(t, 1, events.started[embedder.QueryAttemptOriginal])
		require.Equal(t, 1, events.started[embedder.QueryAttemptExtra])
		require.Equal(t, 1, events.finished[embedder.QueryAttemptOriginal])
		require.Equal(t, 1, events.finished[embedder.QueryAttemptExtra])
		require.Equal(t, 7, events.tokens[embedder.QueryAttemptOriginal])
		require.Equal(t, 8, events.tokens[embedder.QueryAttemptExtra])
		require.Equal(t, embedder.QueryAttemptExtra, events.winner)
		require.Zero(t, events.inFlight)
	})
}

func TestQueryHedgerIneligibleInputsNeverLaunchExtra(t *testing.T) {
	for _, tc := range []struct {
		name  string
		cap   int
		input embedder.EmbedTextInput
	}{
		{"disabled", 0, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}},
		{"document", 4, embedder.EmbedTextInput{Texts: []string{"document"}, Task: embedder.TaskRetrievalDocument}},
		{"multiple texts", 4, embedder.EmbedTextInput{Texts: []string{"one", "two"}, Task: embedder.TaskRetrievalQuery}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				hedger, err := embedder.NewQueryHedger(time.Second, tc.cap, nil)
				require.NoError(t, err)
				originalStarted := make(chan struct{})
				extraStarted := make(chan struct{})
				want := embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{4}}}}
				result := make(chan struct {
					out embedder.EmbedTextOutput
					err error
				}, 1)
				go func() {
					out, err := hedger.Run(context.Background(), tc.input, "azure", func(context.Context) (embedder.EmbedTextOutput, error) {
						close(originalStarted)
						<-time.After(2 * time.Second)
						return want, nil
					}, func(context.Context) (embedder.EmbedTextOutput, error) {
						close(extraStarted)
						return embedder.EmbedTextOutput{}, errors.New("unexpected extra call")
					}, nil)
					result <- struct {
						out embedder.EmbedTextOutput
						err error
					}{out, err}
				}()
				<-originalStarted
				<-time.After(1500 * time.Millisecond)
				select {
				case <-extraStarted:
					t.Fatal("ineligible input launched an extra call")
				default:
				}
				got := <-result
				require.NoError(t, got.err)
				require.Equal(t, want, got.out)
			})
		})
	}
}

func TestQueryHedgerCallerCancellationBeforeDelay(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		started := make(chan struct{})
		result := make(chan error, 1)
		extraCalls := 0
		go func() {
			_, err := hedger.Run(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}, "vertex", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
				close(started)
				<-ctx.Done()
				return embedder.EmbedTextOutput{}, ctx.Err()
			}, func(context.Context) (embedder.EmbedTextOutput, error) {
				extraCalls++
				return embedder.EmbedTextOutput{}, nil
			}, nil)
			result <- err
		}()
		<-started
		cancel()
		require.ErrorIs(t, <-result, context.Canceled)
		require.Zero(t, extraCalls)
	})
}

func TestQueryHedgerExistingDeadlineCancelsBothAttempts(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		deadline, ok := ctx.Deadline()
		require.True(t, ok)
		seenDeadlines := make(chan time.Time, 2)
		attempt := func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			d, ok := ctx.Deadline()
			if ok {
				seenDeadlines <- d
			}
			<-ctx.Done()
			return embedder.EmbedTextOutput{}, ctx.Err()
		}
		_, err = hedger.Run(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}, "azure", attempt, attempt, nil)
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.Equal(t, deadline, <-seenDeadlines)
		require.Equal(t, deadline, <-seenDeadlines)
	})
}

func TestQueryHedgerBoundsProviderObservation(t *testing.T) {
	events := newHedgeEvents()
	hedger, err := embedder.NewQueryHedger(time.Second, 1, events)
	require.NoError(t, err)
	first := func(context.Context) (embedder.EmbedTextOutput, error) {
		return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{1}}}}, nil
	}
	_, err = hedger.Run(t.Context(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}, "tenant-provided-value", first, nil, nil)
	require.NoError(t, err)
	events.mu.Lock()
	defer events.mu.Unlock()
	require.Equal(t, "unknown", events.provider)
}

func TestQueryHedgerSimultaneousCompletionsDoNotBlock(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		events := newHedgeEvents()
		hedger, err := embedder.NewQueryHedger(time.Second, 1, events)
		require.NoError(t, err)
		release := make(chan struct{})
		input := embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}
		out, err := hedger.Run(context.Background(), input, "bedrock", func(context.Context) (embedder.EmbedTextOutput, error) {
			<-release
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{1}}}}, nil
		}, func(context.Context) (embedder.EmbedTextOutput, error) {
			close(release)
			return embedder.EmbedTextOutput{Embeddings: []embedder.Embedding{{Dense: []float32{2}}}}, nil
		}, nil)
		require.NoError(t, err)
		require.Contains(t, []float32{1, 2}, out.Embeddings[0].Dense[0])
		synctest.Wait()
		events.mu.Lock()
		defer events.mu.Unlock()
		require.Equal(t, 1, events.finished[embedder.QueryAttemptOriginal])
		require.Equal(t, 1, events.finished[embedder.QueryAttemptExtra])
		require.Zero(t, events.inFlight)
	})
}

func TestQueryHedgerClassifiesQuotaFailureWithoutTokens(t *testing.T) {
	events := newHedgeEvents()
	hedger, err := embedder.NewQueryHedger(time.Second, 1, events)
	require.NoError(t, err)
	quotaErr := errors.New("provider quota")
	_, err = hedger.Run(t.Context(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery}, "bedrock", func(context.Context) (embedder.EmbedTextOutput, error) {
		return embedder.EmbedTextOutput{}, quotaErr
	}, nil, func(err error) embedder.QueryAttemptOutcome {
		if errors.Is(err, quotaErr) {
			return embedder.QueryAttemptQuota
		}
		return embedder.QueryAttemptError
	})
	require.ErrorIs(t, err, quotaErr)
	events.mu.Lock()
	defer events.mu.Unlock()
	require.Equal(t, embedder.QueryAttemptQuota, events.outcomes[embedder.QueryAttemptOriginal])
	require.Zero(t, events.tokens[embedder.QueryAttemptOriginal])
}
