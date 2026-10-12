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
		previous := newScreenshotAttempt(nil, rendering.ErrTimeout, clk)
		require.NotNil(t, previous)
		assert.Nil(t, newScreenshotAttempt(previous, nil, clk))
	})

	t.Run("retryable errors accumulate and cap", func(t *testing.T) {
		var attempt *CaptureAttempt
		for _, want := range []int{1, 2, 3} {
			attempt = newScreenshotAttempt(attempt, rendering.ErrTimeout, clk)
			assert.Equal(t, want, attempt.retryCount)
		}
		for range 100 {
			attempt = newScreenshotAttempt(attempt, rendering.ErrTimeout, clk)
		}
		assert.Equal(t, imageCaptureBackoffMaxShift+1, attempt.retryCount)
		assert.Equal(t, imageCaptureBackoffMax, imageCaptureBackoffDuration(attempt.retryCount))
	})

	t.Run("timeouts are classified through the error chain", func(t *testing.T) {
		for _, err := range []error{context.DeadlineExceeded, rendering.ErrServerTimeout, rendering.ErrTimeout} {
			assert.True(t, IsRetryableError(err))
			assert.Equal(t, 1, newScreenshotAttempt(nil, err, clk).retryCount)
		}
		assert.False(t, IsRetryableError(context.Canceled))
	})

	t.Run("other errors do not back off", func(t *testing.T) {
		previous := newScreenshotAttempt(nil, rendering.ErrTimeout, clk)
		attempt := newScreenshotAttempt(previous, errors.New("boom"), clk)
		assert.Zero(t, attempt.retryCount)
		assert.True(t, attempt.readyForRetry(clk), "non-retryable errors retry on the next evaluation")
	})
}

func TestCaptureAttemptReadyForRetry(t *testing.T) {
	clk := clock.NewMock()
	assert.True(t, (*CaptureAttempt)(nil).readyForRetry(clk), "no attempt recorded yet")

	attempt := newScreenshotAttempt(nil, rendering.ErrTimeout, clk)
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
		attempt := newScreenshotAttempt(nil, rendering.ErrTimeout, clk)
		c.setLastScreenshotAttempt(key, attempt)
		assert.Same(t, attempt, c.getLastScreenshotAttempt(key))
	})

	t.Run("replacing a rule's states keeps its backoff", func(t *testing.T) {
		// setNextStateForAll rebuilds the states map on no-data and error
		// evaluations, which must not drop the rule's backoff.
		c := newCache()
		attempt := newScreenshotAttempt(nil, rendering.ErrTimeout, clk)
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
