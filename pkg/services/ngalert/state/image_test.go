package state

import (
	"context"
	"errors"
	"math/rand"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/util"
)

func TestImageCaptureBackoffDuration(t *testing.T) {
	for _, tc := range []struct {
		retryCount int
		want       time.Duration
	}{
		{-1, 0}, {0, 0}, {1, 30 * time.Second}, {2, time.Minute},
		{3, 2 * time.Minute}, {6, 16 * time.Minute}, {7, 30 * time.Minute},
		{1_000_000, 30 * time.Minute},
	} {
		assert.Equalf(t, tc.want, imageCaptureBackoffDuration(tc.retryCount), "retryCount %d", tc.retryCount)
	}
}

func TestNewScreenshotAttempt(t *testing.T) {
	clk := clock.NewMock()

	t.Run("a successful capture clears the backoff", func(t *testing.T) {
		previous := newScreenshotAttempt(nil, rendering.ErrTimeout, clk.Now())
		require.NotNil(t, previous)
		assert.Nil(t, newScreenshotAttempt(previous, nil, clk.Now()))
	})

	t.Run("retryable errors accumulate and cap", func(t *testing.T) {
		var attempt *CaptureAttempt
		for _, want := range []int{1, 2, 3} {
			attempt = newScreenshotAttempt(attempt, rendering.ErrTimeout, clk.Now())
			assert.Equal(t, want, attempt.retryCount)
		}
		for range 100 {
			attempt = newScreenshotAttempt(attempt, rendering.ErrTimeout, clk.Now())
		}
		assert.Equal(t, imageCaptureBackoffMaxShift+1, attempt.retryCount)
		assert.Equal(t, imageCaptureBackoffMax, imageCaptureBackoffDuration(attempt.retryCount))
	})

	t.Run("timeouts are classified through the error chain", func(t *testing.T) {
		for _, err := range []error{context.DeadlineExceeded, rendering.ErrServerTimeout, rendering.ErrTimeout} {
			assert.True(t, IsRetryableError(err))
			assert.Equal(t, 1, newScreenshotAttempt(nil, err, clk.Now()).retryCount)
		}
		assert.False(t, IsRetryableError(context.Canceled))
	})

	t.Run("other errors do not back off", func(t *testing.T) {
		previous := newScreenshotAttempt(nil, rendering.ErrTimeout, clk.Now())
		attempt := newScreenshotAttempt(previous, errors.New("boom"), clk.Now())
		assert.Zero(t, attempt.retryCount)
		assert.True(t, attempt.readyForRetry(clk), "non-retryable errors retry on the next evaluation")
	})
}

func TestCaptureAttemptReadyForRetry(t *testing.T) {
	clk := clock.NewMock()
	assert.True(t, (*CaptureAttempt)(nil).readyForRetry(clk), "no attempt recorded yet")

	attempt := newScreenshotAttempt(nil, rendering.ErrTimeout, clk.Now())
	require.Equal(t, 1, attempt.retryCount)
	assert.False(t, attempt.readyForRetry(clk))
	clk.Add(imageCaptureBackoffBase - time.Second)
	assert.False(t, attempt.readyForRetry(clk))
	clk.Add(time.Second)
	assert.True(t, attempt.readyForRetry(clk))
}

func TestCacheCaptureAttempt(t *testing.T) {
	key := ngmodels.AlertRuleKey{OrgID: 1, UID: "rule"}
	clk := clock.NewMock()

	t.Run("missing entries read as no attempt", func(t *testing.T) {
		c := newCache()
		assert.Nil(t, c.getLastScreenshotAttempt(key), "unknown org")
		c.set(&State{OrgID: key.OrgID, AlertRuleUID: "other-rule"})
		assert.Nil(t, c.getLastScreenshotAttempt(key), "known org, unknown rule")
	})

	t.Run("setting an attempt creates the rule entry", func(t *testing.T) {
		c := newCache()
		attempt := newScreenshotAttempt(nil, rendering.ErrTimeout, clk.Now())
		c.setLastScreenshotAttempt(key, attempt)
		assert.Same(t, attempt, c.getLastScreenshotAttempt(key))
	})

	t.Run("replacing a rule's states keeps its backoff", func(t *testing.T) {
		// setNextStateForAll rebuilds the states map on no-data and error
		// evaluations, which must not drop the rule's backoff.
		c := newCache()
		attempt := newScreenshotAttempt(nil, rendering.ErrTimeout, clk.Now())
		c.setLastScreenshotAttempt(key, attempt)
		c.setRuleStates(key, ruleStates{states: make(map[data.Fingerprint]*State)})
		assert.Same(t, attempt, c.getLastScreenshotAttempt(key))
	})
}

// A failed capture backs off for the whole rule. Retry history used to be kept per
// instance, so an instance that began alerting during the cooldown found no history
// of its own and captured again, defeating the backoff.
func TestProcessEvalResults_CaptureBackoffIsPerRule(t *testing.T) {
	gen := ngmodels.RuleGen
	rule := gen.With(
		gen.WithDashboardAndPanel(new(util.GenerateShortUID()), new(rand.Int63())),
		gen.WithLabels(nil),
		gen.WithFor(0),
	).Generate()

	images := &CountingImageService{Err: context.DeadlineExceeded}
	clk := clock.NewMock()
	mgr := NewManager(ManagerCfg{
		Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
		InstanceStore: &FakeInstanceStore{},
		Images:        images,
		Clock:         clk,
		Historian:     &FakeHistorian{},
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           &logtest.Fake{},
	}, NewNoopPersister())

	a := data.Labels{"instance_label": "a"}
	b := data.Labels{"instance_label": "b"}
	result := func(labels data.Labels, s eval.State) eval.Result {
		return eval.Result{State: s, Instance: labels, EvaluatedAt: clk.Now()}
	}
	process := func(results ...eval.Result) []StateTransition {
		transitions, _ := mgr.ProcessEvalResults(context.Background(), clk.Now(), &rule, results, nil, nil)
		return transitions
	}

	// b starts alerting and its capture times out.
	process(result(a, eval.Normal), result(b, eval.Alerting))
	require.Equal(t, 1, images.Called)

	// a starts alerting while the rule is still backing off.
	clk.Add(time.Second)
	for _, transition := range process(result(a, eval.Alerting), result(b, eval.Alerting)) {
		assert.Nil(t, transition.Image, "a failed capture leaves transitions without an image")
	}
	assert.Equal(t, 1, images.Called, "an instance that starts alerting must not bypass the rule's cooldown")

	// Once the backoff elapses the rule tries again, once for both instances.
	clk.Add(imageCaptureBackoffBase)
	process(result(a, eval.Alerting), result(b, eval.Alerting))
	assert.Equal(t, 2, images.Called)
}

func TestProcessEvalResults_AsyncCaptureRetries(t *testing.T) {
	for _, captureErr := range []error{errors.New("renderer unavailable"), rendering.ErrTimeout} {
		t.Run(captureErr.Error(), func(t *testing.T) {
			gen := ngmodels.RuleGen
			rule := gen.With(gen.WithDashboardAndPanel(new("foo"), new(int64(1))), gen.WithLabels(nil), gen.WithFor(0), gen.WithKeepFiringFor(0)).Generate()
			rule.NoDataState = ngmodels.Alerting
			rule.MissingSeriesEvalsToResolve = new(int64(20))
			capture, complete := ngmodels.NewImageCapture()
			images := &CountingImageService{Image: &ngmodels.Image{Token: "first", ExpiresAt: time.Now().Add(24 * time.Hour), Capture: capture}}
			clk := clock.NewMock()
			mgr := NewManager(ManagerCfg{
				Metrics: metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(), InstanceStore: &FakeInstanceStore{},
				Images: images, Clock: clk, Historian: &FakeHistorian{}, Tracer: tracing.InitializeTracerForTest(), Log: &logtest.Fake{},
			}, NewNoopPersister())
			process := func(labels ...string) []StateTransition {
				var results eval.Results
				for _, label := range labels {
					results = append(results, eval.Result{State: eval.Alerting, Instance: data.Labels{"instance": label}, EvaluatedAt: clk.Now()})
				}
				transitions, err := mgr.ProcessEvalResults(context.Background(), clk.Now(), &rule, results, nil, nil)
				require.NoError(t, err)
				return transitions
			}
			process("a", "b")
			require.Equal(t, 1, images.Called)
			_, err := mgr.ProcessEvalResults(context.Background(), clk.Now(), &rule,
				eval.Results{{State: eval.NoData, EvaluatedAt: clk.Now()}}, nil, nil)
			require.NoError(t, err)
			complete(ngmodels.Image{}, captureErr, clk.Now())
			capture, complete = ngmodels.NewImageCapture()
			images.Image = &ngmodels.Image{Token: "second", ExpiresAt: time.Now().Add(24 * time.Hour), Capture: capture}
			labels := []string{"a", "b"}
			if IsRetryableError(captureErr) {
				labels = []string{"new", "a"}
			}
			for _, transition := range process(labels...) {
				if IsRetryableError(captureErr) {
					require.Nil(t, transition.Image, "failed pending images must be discarded during backoff")
				} else {
					require.NotNil(t, transition.Image, "non-timeout failures must retry on the next evaluation")
					require.Equal(t, images.Image, transition.Image)
				}
			}
			attempt := mgr.cache.getLastScreenshotAttempt(rule.GetKey())
			require.NotNil(t, attempt)
			if IsRetryableError(captureErr) {
				require.Equal(t, 1, images.Called)
				require.Equal(t, 1, attempt.retryCount, "shared instances must count one failure")
				labels = []string{"new", "a", "b"}
				process(labels...)
				require.Equal(t, 1, images.Called, "new instances must obey the rule's backoff")
				require.Equal(t, 1, mgr.cache.getLastScreenshotAttempt(rule.GetKey()).retryCount, "an omitted instance must not recount its failure")
				clk.Add(imageCaptureBackoffBase)
				process(labels...)
			}
			require.Equal(t, 2, images.Called)
			if IsRetryableError(captureErr) {
				require.Equal(t, 1, mgr.cache.getLastScreenshotAttempt(rule.GetKey()).retryCount, "pending retries must retain backoff history")
				complete(ngmodels.Image{}, captureErr, clk.Now())
				process(labels...)
				require.Equal(t, 2, mgr.cache.getLastScreenshotAttempt(rule.GetKey()).retryCount)
				clk.Add(time.Minute - time.Second)
				process(labels...)
				require.Equal(t, 2, images.Called)
				clk.Add(time.Second)
				capture, complete = ngmodels.NewImageCapture()
				images.Image = &ngmodels.Image{Token: "third", ExpiresAt: time.Now().Add(24 * time.Hour), Capture: capture}
				process(labels...)
				require.Equal(t, 3, images.Called)
			}
			completed := *images.Image
			completed.Capture = nil
			completed.Path = "foo.png"
			completed.URL = "https://example.com/foo.png"
			complete(completed, nil, clk.Now())
			// A retained completion must survive the one-minute panel cache TTL.
			clk.Add(2 * time.Minute)
			for _, transition := range process(labels...) {
				require.Equal(t, completed, *transition.Image)
			}
			require.Nil(t, mgr.cache.getLastScreenshotAttempt(rule.GetKey()))
		})
	}
}

func TestProcessEvalResults_AsyncCaptureResolution(t *testing.T) {
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithDashboardAndPanel(new("foo"), new(int64(1))), gen.WithLabels(nil), gen.WithFor(0), gen.WithKeepFiringFor(0)).Generate()
	capture, complete := ngmodels.NewImageCapture()
	images := &CountingImageService{Image: &ngmodels.Image{Token: "first", ExpiresAt: time.Now().Add(24 * time.Hour), Capture: capture}}
	clk := clock.NewMock()
	mgr := NewManager(ManagerCfg{
		Metrics: metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(), InstanceStore: &FakeInstanceStore{},
		Images: images, Clock: clk, Historian: &FakeHistorian{}, Tracer: tracing.InitializeTracerForTest(), Log: &logtest.Fake{},
	}, NewNoopPersister())
	process := func(state eval.State) []StateTransition {
		transitions, err := mgr.ProcessEvalResults(context.Background(), clk.Now(), &rule, eval.Results{
			{State: state, Instance: data.Labels{"instance": "a"}, EvaluatedAt: clk.Now()},
			{State: state, Instance: data.Labels{"instance": "b"}, EvaluatedAt: clk.Now()},
		}, nil, nil)
		require.NoError(t, err)
		return transitions
	}
	transitions := process(eval.Alerting)
	otherCapture, completeOther := ngmodels.NewImageCapture()
	transitions[1].Image = &ngmodels.Image{Token: "other", Capture: otherCapture}
	first := ngmodels.Image{Token: "first", URL: "https://example.com/first.png", ExpiresAt: time.Now().Add(24 * time.Hour)}
	other := ngmodels.Image{Token: "other", URL: "https://example.com/other.png", ExpiresAt: time.Now().Add(24 * time.Hour)}
	complete(first, nil, clk.Now())
	completeOther(other, nil, clk.Now())
	transitions = process(eval.Alerting)
	require.Equal(t, first, *transitions[0].Image)
	require.Equal(t, other, *transitions[1].Image)
	require.Equal(t, 1, images.Called, "refreshing completion must not capture again")
	resolvedCapture, completeResolved := ngmodels.NewImageCapture()
	images.Image = &ngmodels.Image{Token: "resolved", Capture: resolvedCapture}
	for _, transition := range process(eval.Normal) {
		require.Equal(t, *images.Image, *transition.Image)
	}
	require.Equal(t, 2, images.Called, "resolution must still request its own screenshot")
	resolved := ngmodels.Image{Token: "resolved", URL: "https://example.com/resolved.png"}
	completeResolved(resolved, nil, clk.Now())
	for _, transition := range process(eval.Normal) {
		require.Equal(t, resolved, *transition.Image)
	}
	require.Equal(t, 2, images.Called, "a resolution capture must not queue another resolution capture")
}

func TestProcessEvalResults_ResolutionWhileCapturePending(t *testing.T) {
	for _, captureErr := range []error{nil, errors.New("renderer unavailable"), rendering.ErrTimeout} {
		name := "success"
		if captureErr != nil {
			name = captureErr.Error()
		}
		t.Run(name, func(t *testing.T) {
			gen := ngmodels.RuleGen
			rule := gen.With(gen.WithDashboardAndPanel(new("foo"), new(int64(1))), gen.WithLabels(nil), gen.WithFor(0), gen.WithKeepFiringFor(0)).Generate()
			clk := clock.NewMock()
			capture, complete := ngmodels.NewImageCapture()
			pending := &ngmodels.Image{Token: "firing", Capture: capture, ExpiresAt: time.Now().Add(24 * time.Hour)}
			images := &CountingImageService{Image: pending}
			mgr := NewManager(ManagerCfg{
				Metrics: metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(), InstanceStore: &FakeInstanceStore{},
				Images: images, Clock: clk, Historian: &FakeHistorian{}, Tracer: tracing.InitializeTracerForTest(), Log: &logtest.Fake{},
			}, NewNoopPersister())
			process := func(state eval.State) []StateTransition {
				transitions, err := mgr.ProcessEvalResults(context.Background(), clk.Now(), &rule, eval.Results{
					{State: state, Instance: data.Labels{"instance": "a"}, EvaluatedAt: clk.Now()},
					{State: state, Instance: data.Labels{"instance": "b"}, EvaluatedAt: clk.Now()},
				}, nil, nil)
				require.NoError(t, err)
				return transitions
			}
			process(eval.Alerting)
			clk.Add(time.Second)
			process(eval.Normal)
			require.Equal(t, 1, images.Called, "the firing capture is still in progress")
			complete(ngmodels.Image{Token: "firing", Path: "firing.png"}, captureErr, clk.Now())
			images.Image = &ngmodels.Image{Token: "resolved", Path: "resolved.png"}
			if IsRetryableError(captureErr) {
				process(eval.Normal)
				require.Equal(t, 1, images.Called, "deferred resolution must honor the rule's backoff")
				clk.Add(imageCaptureBackoffBase)
			}
			transitions := process(eval.Normal)
			require.Equal(t, 2, images.Called, "a pending firing capture must not consume the resolution request")
			for _, transition := range transitions {
				require.Equal(t, images.Image, transition.Image)
			}
			process(eval.Normal)
			require.Equal(t, 2, images.Called, "a completed resolution request must not repeat")
		})
	}
}

func TestProcessEvalResults_AsyncBackoffStartsAtFailure(t *testing.T) {
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithDashboardAndPanel(new("foo"), new(int64(1))), gen.WithLabels(nil), gen.WithFor(0)).Generate()
	clk := clock.NewMock()
	capture, complete := ngmodels.NewImageCapture()
	images := &CountingImageService{Image: &ngmodels.Image{Token: "first", Capture: capture}}
	mgr := NewManager(ManagerCfg{
		Metrics: metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(), InstanceStore: &FakeInstanceStore{},
		Images: images, Clock: clk, Historian: &FakeHistorian{}, Tracer: tracing.InitializeTracerForTest(), Log: &logtest.Fake{},
	}, NewNoopPersister())
	process := func() {
		_, err := mgr.ProcessEvalResults(context.Background(), clk.Now(), &rule, eval.Results{
			{State: eval.Alerting, Instance: data.Labels{"instance": "a"}, EvaluatedAt: clk.Now()},
		}, nil, nil)
		require.NoError(t, err)
	}
	process()
	clk.Add(30 * time.Second)
	complete(ngmodels.Image{}, rendering.ErrTimeout, clk.Now())
	clk.Add(30 * time.Second)
	images.Image = &ngmodels.Image{Token: "retry", Path: "retry.png"}
	process()
	require.Equal(t, 2, images.Called, "the first backoff elapsed before this evaluation")
}
