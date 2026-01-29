package ngalert

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/setting"
)

type testEvaluationCoordinator struct {
	updates chan bool
}

func newTestCoordinator(values ...bool) *testEvaluationCoordinator {
	ch := make(chan bool, len(values))
	for _, v := range values {
		ch <- v
	}
	return &testEvaluationCoordinator{updates: ch}
}

func (c *testEvaluationCoordinator) Updates(_ context.Context) <-chan bool {
	return c.updates
}

type testSchedule struct {
	started    atomic.Bool
	stopped    atomic.Bool
	startCount atomic.Int32

	// exitImmediately causes Run to return immediately without waiting for context
	exitImmediately atomic.Bool
}

func (s *testSchedule) Run(ctx context.Context) error {
	s.started.Store(true)
	s.startCount.Add(1)

	if s.exitImmediately.Load() {
		s.stopped.Store(true)
		return nil
	}

	<-ctx.Done()
	s.stopped.Store(true)
	return nil
}

func (s *testSchedule) Status(_ context.Context, _ models.AlertRuleKey) (models.RuleStatus, bool) {
	return models.RuleStatus{}, false
}

type evaluationLoop struct {
	t      *testing.T
	ng     *AlertNG
	sched  *testSchedule
	ctx    context.Context
	cancel context.CancelFunc
	done   chan error
}

func setupEvaluationLoop(t *testing.T, coordinator *testEvaluationCoordinator, opts ...alertNGOption) *evaluationLoop {
	t.Helper()
	return setupEvaluationLoopWithSchedule(t, coordinator, &testSchedule{}, opts...)
}

func setupEvaluationLoopWithSchedule(t *testing.T, coordinator *testEvaluationCoordinator, sched *testSchedule, opts ...alertNGOption) *evaluationLoop {
	t.Helper()
	ng := createTestAlertNG(sched, coordinator, opts...)
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	runner := &evaluationRunner{ng: ng}
	go func() { done <- runner.run(ctx) }()

	return &evaluationLoop{
		t:      t,
		ng:     ng,
		sched:  sched,
		ctx:    ctx,
		cancel: cancel,
		done:   done,
	}
}

func (h *evaluationLoop) stop() {
	h.t.Helper()
	h.cancel()
	require.NoError(h.t, <-h.done)
}

func waitStarted(t *testing.T, sched *testSchedule) {
	t.Helper()
	require.Eventually(t, func() bool {
		return sched.started.Load()
	}, time.Second, 10*time.Millisecond, "scheduler should start")
}

func waitStopped(t *testing.T, sched *testSchedule) {
	t.Helper()
	require.Eventually(t, func() bool {
		return sched.stopped.Load()
	}, time.Second, 10*time.Millisecond, "scheduler should stop")
}

func neverStarted(t *testing.T, sched *testSchedule) {
	t.Helper()
	require.Never(t, func() bool {
		return sched.started.Load()
	}, 100*time.Millisecond, 10*time.Millisecond, "scheduler should not start")
}

func TestEvaluationLifecycleRun(t *testing.T) {
	t.Run("does not start when shouldEvaluate is false", func(t *testing.T) {
		h := setupEvaluationLoop(t, newTestCoordinator(false))
		neverStarted(t, h.sched)
		h.stop()
	})

	t.Run("starts when shouldEvaluate is true", func(t *testing.T) {
		h := setupEvaluationLoop(t, newTestCoordinator(true))
		waitStarted(t, h.sched)
		h.stop()
	})

	t.Run("stops when becomes secondary", func(t *testing.T) {
		h := setupEvaluationLoop(t, newTestCoordinator(true, false))
		waitStarted(t, h.sched)
		waitStopped(t, h.sched)
		h.stop()
	})

	t.Run("starts when becomes primary", func(t *testing.T) {
		h := setupEvaluationLoop(t, newTestCoordinator(false, true))
		waitStarted(t, h.sched)
		h.stop()
	})
}

// TestEvaluationLifecycle_SchedulerExitsUnexpectedly verifies that if the scheduler
// exits without context cancellation (a bug), the evaluation loop returns an error
// rather than silently stopping.
func TestEvaluationLifecycle_SchedulerExitsUnexpectedly(t *testing.T) {
	sched := &testSchedule{exitImmediately: atomic.Bool{}}
	sched.exitImmediately.Store(true)
	h := setupEvaluationLoopWithSchedule(t, newTestCoordinator(true), sched)
	defer h.cancel()

	select {
	case err := <-h.done:
		require.ErrorContains(t, err, "stopped unexpectedly")
	case <-time.After(time.Second):
		t.Fatal("expected error but loop kept running")
	}
}

func TestEvaluationRunner_StartStopIdempotency(t *testing.T) {
	t.Run("Start is idempotent when already running", func(t *testing.T) {
		h := setupEvaluationLoop(t, newTestCoordinator(true, true))
		waitStarted(t, h.sched)
		initialCount := h.sched.startCount.Load()
		time.Sleep(50 * time.Millisecond)
		require.Equal(t, initialCount, h.sched.startCount.Load(), "scheduler should not restart")
		h.stop()
	})

	t.Run("Stop is idempotent when not running", func(t *testing.T) {
		h := setupEvaluationLoop(t, newTestCoordinator(false, false, false))
		neverStarted(t, h.sched)
		h.stop()
	})
}

// TestEvaluationRunner_PersisterIsActive verifies that after the evaluation loop starts,
// the state persister is functional and saves alert instances when evaluation results
// are processed.
func TestEvaluationRunner_PersisterIsActive(t *testing.T) {
	fakeStore := &state.FakeInstanceStore{}
	clk := clock.NewMock()
	stateManagerCfg := state.ManagerCfg{
		Metrics:                 metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
		InstanceStore:           fakeStore,
		Images:                  &state.NotAvailableImageService{},
		Clock:                   clk,
		Historian:               &state.FakeHistorian{},
		Tracer:                  tracing.InitializeTracerForTest(),
		Log:                     log.NewNopLogger(),
		MaxStateSaveConcurrency: 1,
	}
	stateManager := state.NewManager(stateManagerCfg, state.NewSyncStatePersisiter(log.NewNopLogger(), stateManagerCfg))

	h := setupEvaluationLoop(t, newTestCoordinator(true),
		withStateManager(stateManager),
	)
	waitStarted(t, h.sched)

	// Process an evaluation result to trigger state persistence
	rule := models.RuleGen.GenerateRef()
	now := clk.Now()
	results := eval.GenerateResults(1, eval.ResultGen(eval.WithEvaluatedAt(now)))
	_ = h.ng.stateManager.ProcessEvalResults(h.ctx, now, rule, results, make(data.Labels), nil)

	var saveCount int
	for _, op := range fakeStore.RecordedOps() {
		if _, ok := op.(models.AlertInstance); ok {
			saveCount++
		}
	}
	require.Greater(t, saveCount, 0, "persister should save alert instance")

	h.stop()
}

type alertNGOption func(*AlertNG)

func withStateManager(mgr *state.Manager) alertNGOption {
	return func(ng *AlertNG) {
		ng.stateManager = mgr
	}
}

func createTestAlertNG(sched *testSchedule, coordinator *testEvaluationCoordinator, opts ...alertNGOption) *AlertNG {
	defaultCfg := state.ManagerCfg{
		Log:                       log.NewNopLogger(),
		StatePeriodicSaveInterval: time.Minute,
	}

	stateManager := state.NewManager(defaultCfg, state.NewNoopPersister())

	ng := &AlertNG{
		Cfg: &setting.Cfg{
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				BaseInterval:              50 * time.Millisecond,
				StatePeriodicSaveInterval: time.Minute,
			},
		},
		Log:                   log.NewNopLogger(),
		FeatureToggles:        featuremgmt.WithFeatures(),
		schedule:              sched,
		stateManager:          stateManager,
		evaluationCoordinator: coordinator,
	}

	for _, opt := range opts {
		opt(ng)
	}

	return ng
}
