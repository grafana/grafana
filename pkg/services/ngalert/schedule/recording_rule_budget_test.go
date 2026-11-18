package schedule

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// assertAccounting checks the invariant behind the budget: a rule holds one slot per remembered
// series, failed markers waiting for a retry included.
func (h *staleHarness) assertAccounting() {
	h.t.Helper()
	require.Equal(h.t, h.rule.written.size(), h.rule.held, "held is the number of remembered series")
	total := h.rule.held
	for _, peer := range h.peers {
		total += peer.rule.held
	}
	require.EqualValues(h.t, total, h.rule.budget.Used(), "the budget counts what its rules remember")
}

func assertSharedAccounting(t *testing.T, budget *state.SeriesBudget, harnesses ...*staleHarness) {
	t.Helper()
	total := 0
	for _, h := range harnesses {
		require.Equal(t, h.rule.written.size(), h.rule.held)
		total += h.rule.held
	}
	require.EqualValues(t, total, budget.Used(), "the budget counts the series of all rules")
}

func (h *staleHarness) trackedInstances() []string {
	var out []string
	for _, set := range h.rule.written {
		for _, labels := range set {
			out = append(out, labels["instance"])
		}
	}
	return out
}

func instance(name string) map[string]string { return map[string]string{"instance": name} }

func TestRecordingRuleSeriesBudget(t *testing.T) {
	t.Run("past the budget series are written but get no marker, and the evaluation does not fail", func(t *testing.T) {
		h := newStaleHarness(t)
		budget := state.NewSeriesBudget(2)
		h.rule.budget = budget

		h.ev.resp = seriesResponse(instance("a"), instance("b"), instance("c"))
		h.tick()
		require.Equal(t, 1, h.writes, "all three series were sent in one write")
		require.Equal(t, "ok", h.rule.Status().Health)
		require.NoError(t, h.rule.Status().LastError)
		require.EqualValues(t, 2, budget.Used())
		require.EqualValues(t, 2, testutil.ToFloat64(h.rule.metrics.RecordingRuleTrackedSeries))
		require.EqualValues(t, 1, testutil.ToFloat64(h.rule.metrics.RecordingRuleUntrackedSeries))
		tracked := h.trackedInstances()
		require.Len(t, tracked, 2)

		h.ev.resp = noDataResponse()
		h.tick()
		require.Len(t, h.stale, 1)
		staled := make([]string, 0, 2)
		for _, labels := range h.staleSeries(0) {
			staled = append(staled, labels["instance"])
		}
		require.ElementsMatch(t, tracked, staled, "only the tracked series are staled, the untracked one is not")
		require.Zero(t, budget.Used(), "and their room is back")
		require.Zero(t, testutil.ToFloat64(h.rule.metrics.RecordingRuleTrackedSeries))
	})

	t.Run("an untracked series that is still output is tracked once room frees up", func(t *testing.T) {
		h := newStaleHarness(t)
		budget := state.NewSeriesBudget(2)
		h.rule.budget = budget
		h.ev.resp = seriesResponse(instance("a"), instance("b"), instance("c"))
		h.tick()
		tracked := h.trackedInstances()

		var untracked string
		for _, name := range []string{"a", "b", "c"} {
			if name != tracked[0] && name != tracked[1] {
				untracked = name
			}
		}
		h.ev.resp = seriesResponse(instance(untracked))
		h.tick()
		require.Equal(t, []string{untracked}, h.trackedInstances(), "the two that left released room before the new one asked for it")
		require.Len(t, h.stale, 1)
		require.EqualValues(t, 1, budget.Used())
	})

	t.Run("an untracked series that is still refused is counted again on each evaluation", func(t *testing.T) {
		h := newStaleHarness(t)
		h.rule.budget = state.NewSeriesBudget(1)
		h.ev.resp = seriesResponse(instance("a"), instance("b"))
		h.tick()
		h.tick()
		h.tick()
		require.EqualValues(t, 3, testutil.ToFloat64(h.rule.metrics.RecordingRuleUntrackedSeries))
	})

	t.Run("rules share one budget", func(t *testing.T) {
		budget := state.NewSeriesBudget(3)
		h1, h2 := newStaleHarness(t), newStaleHarness(t)
		h1.rule.budget, h2.rule.budget = budget, budget
		h1.peers, h2.peers = []*staleHarness{h2}, []*staleHarness{h1}

		h1.ev.resp = seriesResponse(instance("a"), instance("b"))
		h2.ev.resp = seriesResponse(instance("c"), instance("d"))
		h1.tick()
		h2.tick()
		assertSharedAccounting(t, budget, h1, h2)
		require.EqualValues(t, 3, budget.Used())
		require.Equal(t, 2, h1.rule.held)
		require.Equal(t, 1, h2.rule.held, "the second rule got what was left")
	})

	t.Run("a failed data write does not leak a reservation, and the retry admits", func(t *testing.T) {
		h := newStaleHarness(t)
		budget := state.NewSeriesBudget(10)
		h.rule.budget = budget
		h.ev.resp = seriesResponse(instance("a"))
		h.tick()

		h.ev.resp = seriesResponse(instance("a"), instance("b"))
		h.failWrite = true
		h.tick()
		require.EqualValues(t, 1, budget.Used(), "b was not remembered, so it holds nothing")

		h.failWrite = false
		h.tick()
		require.EqualValues(t, 2, budget.Used())
	})

	t.Run("every way a series is forgotten gives its room back", func(t *testing.T) {
		stale := foreignError{"temporarily unavailable"}

		for name, run := range map[string]func(t *testing.T, h *staleHarness){
			"vanished and marked": func(t *testing.T, h *staleHarness) {
				h.ev.resp = seriesResponse(instance("a"))
				h.tick()
				require.EqualValues(t, 1, h.rule.budget.Used())
			},
			"marker rejected for good": func(t *testing.T, h *staleHarness) {
				h.failStale, h.staleErr = true, foreignError{"err-mimir-max-active-series"}
				h.ev.resp = seriesResponse(instance("a"))
				h.tick()
				require.EqualValues(t, 1, h.rule.budget.Used(), "b is dropped, not retained")
			},
			"retry age reached": func(t *testing.T, h *staleHarness) {
				h.rule.cfg.StaleMarkerMaxAge = 2 * time.Minute
				h.failStale, h.staleErr = true, stale
				h.ev.resp = seriesResponse(instance("a"))
				h.tick()
				require.EqualValues(t, 2, h.rule.budget.Used(), "a failed marker still holds its room")
				h.tick()
				h.tick()
				require.EqualValues(t, 1, h.rule.budget.Used())
			},
			"the series comes back": func(t *testing.T, h *staleHarness) {
				h.failStale, h.staleErr = true, stale
				h.ev.resp = seriesResponse(instance("a"))
				h.tick()
				h.ev.resp = seriesResponse(instance("a"), instance("b"))
				h.tick()
				require.EqualValues(t, 2, h.rule.budget.Used())
			},
			"no data": func(t *testing.T, h *staleHarness) {
				h.ev.resp = noDataResponse()
				h.tick()
				require.Zero(t, h.rule.budget.Used())
			},
		} {
			t.Run(name, func(t *testing.T) {
				h := newStaleHarness(t)
				h.rule.budget = state.NewSeriesBudget(10)
				h.ev.resp = seriesResponse(instance("a"), instance("b"))
				h.tick()
				require.EqualValues(t, 2, h.rule.budget.Used())
				run(t, h)
			})
		}
	})

	t.Run("stopping the rule for any reason gives all its room back", func(t *testing.T) {
		for name, reason := range map[string]error{
			"deleted":   errRuleDeleted,
			"restarted": errRuleRestarted,
			"moved":     errors.New("not owned"),
			"cancelled": context.Canceled,
		} {
			for _, markersFail := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s, markers failing %v", name, markersFail), func(t *testing.T) {
					budget := state.NewSeriesBudget(10)
					h, other := newStaleHarness(t), newStaleHarness(t)
					h.rule.budget, other.rule.budget = budget, budget
					h.peers, other.peers = []*staleHarness{other}, []*staleHarness{h}
					other.ev.resp = seriesResponse(instance("x"))
					other.tick()
					h.ev.resp = seriesResponse(instance("a"), instance("b"))
					h.tick()
					require.EqualValues(t, 3, budget.Used())

					h.failStale, h.staleErr = markersFail, foreignError{"temporarily unavailable"}
					h.stop(reason)
					require.EqualValues(t, 1, budget.Used(), "only the other rule's series is left")
					assertSharedAccounting(t, budget, h, other)
				})
			}
		}
	})

	t.Run("every evaluation that refuses a series warns", func(t *testing.T) {
		h := newStaleHarness(t)
		h.rule.budget = state.NewSeriesBudget(1)
		logger := &logtest.Fake{}
		target := seriesTarget{dsUID: "ds-1", orgID: 1, name: "m"}
		h.rule.commitWritten(writtenSeries{target: {1: data.Labels{"i": "kept"}}}, logger)
		require.Zero(t, logger.WarnLogs.Calls, "nothing was refused yet")

		for i := range 4 {
			next := writtenSeries{target: {1: data.Labels{"i": "kept"}, data.Fingerprint(100 + i): data.Labels{"i": "refused"}}}
			h.rule.commitWritten(next, logger)
		}
		require.Equal(t, 4, logger.WarnLogs.Calls)
		require.EqualValues(t, 4, testutil.ToFloat64(h.rule.metrics.RecordingRuleUntrackedSeries))
		h.assertAccounting()
	})
}

func noDataResponse() *backend.QueryDataResponse {
	return &backend.QueryDataResponse{Responses: backend.Responses{"A": {}}}
}

// A rule is stopped while Run is going, as in production: Run starts before the first
// evaluation, so anything that captures written at the start of Run sees nothing.
func TestRecordingRuleSeriesBudgetReleasedWhenRunStops(t *testing.T) {
	for name, reason := range map[string]error{
		"deleted":   errRuleDeleted,
		"restarted": errRuleRestarted,
		"moved":     errors.New("not owned"),
		"cancelled": context.Canceled,
	} {
		for _, markersFail := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s, markers failing %v", name, markersFail), func(t *testing.T) {
				budget := state.NewSeriesBudget(10)
				h := newStaleHarness(t)
				h.rule.budget = budget

				done := make(chan error, 1)
				go func() { done <- h.rule.Run() }()

				evaluate := func() {
					evaluated := make(chan struct{})
					h.now = h.now.Add(time.Minute)
					sent, _ := h.rule.Eval(&Evaluation{scheduledAt: h.now, rule: h.model, afterEval: func() { close(evaluated) }})
					require.True(t, sent)
					<-evaluated
				}

				h.ev.resp = seriesResponse(instance("a"), instance("b"))
				evaluate()
				h.ev.resp = seriesResponse(instance("a"))
				h.failStale, h.staleErr = true, foreignError{"temporarily unavailable"}
				evaluate()
				require.EqualValues(t, 2, budget.Used(), "b is kept for a retry and holds its room")

				h.failStale = markersFail
				h.rule.Stop(reason)
				require.NoError(t, <-done)

				require.EqualValues(t, 0, budget.Used())
				require.Zero(t, h.rule.held)
			})
		}
	}
}

func TestRecordingRuleTrackedSeriesGaugeFollowsStops(t *testing.T) {
	budget := state.NewSeriesBudget(10)
	h, other := newStaleHarness(t), newStaleHarness(t)
	h.rule.budget, other.rule.budget = budget, budget
	other.rule.metrics = h.rule.metrics
	h.peers, other.peers = []*staleHarness{other}, []*staleHarness{h}
	gauge := func() float64 { return testutil.ToFloat64(h.rule.metrics.RecordingRuleTrackedSeries) }

	h.ev.resp = seriesResponse(instance("a"), instance("b"))
	other.ev.resp = seriesResponse(instance("c"))
	h.tick()
	other.tick()
	require.EqualValues(t, 3, gauge())

	h.stop(context.Canceled)
	require.EqualValues(t, 1, budget.Used())
	require.EqualValues(t, 1, gauge(), "the gauge is updated when a rule stops, without another evaluation")
}

func TestRecordingRuleTrackedSeriesGaugeFollowsDrops(t *testing.T) {
	h := newStaleHarness(t)
	h.rule.budget = state.NewSeriesBudget(10)
	h.ev.resp = seriesResponse(instance("a"), instance("b"))
	h.tick()

	h.ev.resp = seriesResponse(instance("a"))
	h.failStale, h.staleErr = true, foreignError{"err-mimir-max-active-series"}
	h.failWrite = true
	h.tick()
	require.EqualValues(t, 1, h.rule.budget.Used(), "b was dropped even though the data write failed")
	require.EqualValues(t, 1, testutil.ToFloat64(h.rule.metrics.RecordingRuleTrackedSeries), "and the gauge says so")
}
