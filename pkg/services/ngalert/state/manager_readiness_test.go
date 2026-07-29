package state_test

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type fakeOrgReader struct {
	orgs []int64
}

func (f fakeOrgReader) FetchOrgIds(_ context.Context) ([]int64, error) { return f.orgs, nil }

func newReadinessManager(t *testing.T, clk clock.Clock, requireWarm bool, timeout time.Duration) *state.Manager {
	t.Helper()
	cfg := state.ManagerCfg{
		Clock:           clk,
		Log:             log.NewNopLogger(),
		RequireWarm:     requireWarm,
		WarmGateTimeout: timeout,
	}
	return state.NewManager(cfg, state.NewNoopPersister())
}

func warm(t *testing.T, mgr *state.Manager) {
	t.Helper()
	mgr.Warm(context.Background(), fakeOrgReader{}, &state.FakeRuleReader{}, &state.FakeInstanceStore{})
}

func TestManager_Readiness_WarmNotRequired(t *testing.T) {
	mgr := newReadinessManager(t, clock.NewMock(), false, time.Minute)

	// When a warm is not required (vanilla Grafana default) the manager is ready immediately,
	// even before Warm.
	require.Equal(t, state.Ready, mgr.Ready())
}

func TestManager_Readiness_WarmRequired(t *testing.T) {
	clk := clock.NewMock()
	mgr := newReadinessManager(t, clk, true, time.Minute)

	// Before Warm: gated.
	require.Equal(t, state.NotReady, mgr.Ready())

	// After a successful Warm: ready.
	warm(t, mgr)
	require.Equal(t, state.Ready, mgr.Ready())
}

func TestManager_Readiness_GraceTimeout(t *testing.T) {
	clk := clock.NewMock()
	mgr := newReadinessManager(t, clk, true, time.Minute)

	require.Equal(t, state.NotReady, mgr.Ready())

	// Confirms ManagerCfg.WarmGateTimeout reaches the probe; exhaustive grace-window
	// timing is covered by the probe's own tests in readiness_test.go.
	clk.Add(time.Minute)
	require.Equal(t, state.TimedOut, mgr.Ready())
}

func TestManager_Readiness_ClearCacheResets(t *testing.T) {
	clk := clock.NewMock()
	mgr := newReadinessManager(t, clk, true, time.Minute)

	warm(t, mgr)
	require.Equal(t, state.Ready, mgr.Ready())

	mgr.ClearCache()
	require.Equal(t, state.NotReady, mgr.Ready())
}
