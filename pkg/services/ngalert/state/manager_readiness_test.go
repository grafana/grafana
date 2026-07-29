package state_test

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type fakeOrgReader struct {
	orgs []int64
}

func (f fakeOrgReader) FetchOrgIds(_ context.Context) ([]int64, error) { return f.orgs, nil }

func newReadinessManager(t *testing.T, clk clock.Clock, gate bool, timeout time.Duration) *state.Manager {
	t.Helper()
	cfg := state.ManagerCfg{
		Clock:                     clk,
		Log:                       log.NewNopLogger(),
		GateEvaluationUntilWarmed: gate,
		WarmGateTimeout:           timeout,
	}
	return state.NewManager(cfg, state.NewNoopPersister())
}

func warm(t *testing.T, mgr *state.Manager) {
	t.Helper()
	mgr.Warm(context.Background(), fakeOrgReader{}, &state.FakeRuleReader{}, &state.FakeInstanceStore{})
}

func TestManager_EvaluationReadiness_GateDisabled(t *testing.T) {
	mgr := newReadinessManager(t, clock.NewMock(), false, time.Minute)

	// With gating off (vanilla Grafana default) the manager starts ready, so evaluation is never
	// gated, even before Warm.
	require.True(t, mgr.IsWarmed())
	require.Equal(t, state.ReadinessWarmed, mgr.EvaluationReadiness(&ngmodels.AlertRule{}))
}

func TestManager_EvaluationReadiness_GateEnabled(t *testing.T) {
	clk := clock.NewMock()
	mgr := newReadinessManager(t, clk, true, time.Minute)

	// Before Warm: gated.
	require.Equal(t, state.ReadinessNotWarmed, mgr.EvaluationReadiness(&ngmodels.AlertRule{}))
	require.False(t, mgr.IsWarmed())

	// After a successful Warm: ready.
	warm(t, mgr)
	require.True(t, mgr.IsWarmed())
	require.Equal(t, state.ReadinessWarmed, mgr.EvaluationReadiness(&ngmodels.AlertRule{}))
}

func TestManager_EvaluationReadiness_GraceTimeout(t *testing.T) {
	clk := clock.NewMock()
	mgr := newReadinessManager(t, clk, true, time.Minute)

	require.Equal(t, state.ReadinessNotWarmed, mgr.EvaluationReadiness(&ngmodels.AlertRule{}))

	// Once the grace window elapses without a successful Warm, evaluation proceeds (degraded).
	clk.Add(time.Minute)
	require.Equal(t, state.ReadinessTimedOut, mgr.EvaluationReadiness(&ngmodels.AlertRule{}))
	require.False(t, mgr.IsWarmed(), "timeout must not report the cache as warmed")
}
