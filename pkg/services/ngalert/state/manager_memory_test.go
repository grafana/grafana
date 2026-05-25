package state

import (
	"context"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

// staleValuesAssertHistorian fails the test if Record sees a stale (evicted) transition without
// the expected Values — proves Values must not be cleared before the historian runs.
type staleValuesAssertHistorian struct {
	t *testing.T
}

func (h *staleValuesAssertHistorian) Record(_ context.Context, _ history_model.RuleMeta, states []StateTransition) <-chan error {
	for _, tr := range states {
		if tr.State == nil || !tr.State.IsStale() {
			continue
		}
		require.NotNil(h.t, tr.State.Values)
		require.InDelta(h.t, 1.0, tr.State.Values["A"], 1e-9)
		require.InDelta(h.t, 2.0, tr.State.Values["B"], 1e-9)
	}
	ch := make(chan error)
	close(ch)
	return ch
}

func TestValuesAvailableToHistorianAfterEviction(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	clk := clock.NewMock()

	cfg := ManagerCfg{
		Metrics:       nil,
		ExternalURL:   nil,
		InstanceStore: nil,
		Images:        &NoopImageService{},
		Clock:         clk,
		Historian:     &staleValuesAssertHistorian{t: t},
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := NewManager(cfg, NewNoopPersister())

	rule := models.RuleGen.With(models.RuleGen.WithFor(0), models.RuleGen.WithMissingSeriesEvalsToResolve(1)).GenerateRef()

	a, b := 1.0, 2.0
	vals := map[string]eval.NumberValueCapture{
		"A": {Value: &a},
		"B": {Value: &b},
	}

	initResults := eval.Results{
		eval.ResultGen(eval.WithState(eval.Alerting), eval.WithLabels(data.Labels{"series": "x"}), eval.WithValues(vals))(),
		eval.ResultGen(eval.WithState(eval.Alerting), eval.WithLabels(data.Labels{"series": "y"}), eval.WithValues(vals))(),
	}
	st.ProcessEvalResults(ctx, clk.Now(), rule, initResults, nil, nil)

	clk.Add(time.Duration(rule.IntervalSeconds) * time.Second)
	// Only one series in this evaluation; the other becomes missing then stale and is evicted.
	nextResults := eval.Results{
		eval.ResultGen(eval.WithState(eval.Alerting), eval.WithLabels(data.Labels{"series": "x"}), eval.WithValues(vals))(),
	}

	transitions := st.ProcessEvalResults(ctx, clk.Now(), rule, nextResults, nil, nil)

	var sawStale bool
	for _, tr := range transitions {
		if tr.State == nil || !tr.State.IsStale() {
			continue
		}
		sawStale = true
		require.NotNil(t, tr.State.Values)
		require.InDelta(t, 1.0, tr.State.Values["A"], 1e-9)
		require.InDelta(t, 2.0, tr.State.Values["B"], 1e-9)
	}
	require.True(t, sawStale, "expected at least one stale evicted transition")

	ReleaseEvictedStaleTransitionValueMaps(transitions)

	for _, tr := range transitions {
		if tr.State == nil || !tr.State.IsStale() {
			continue
		}
		require.Nil(t, tr.State.Values)
		if tr.State.LatestResult != nil {
			require.Nil(t, tr.State.LatestResult.Values)
		}
	}
}

func TestProcessMissingSeriesStatesSkipsCurrentlyEvaluated(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	clk := clock.NewMock()

	cfg := ManagerCfg{
		Metrics:       nil,
		ExternalURL:   nil,
		InstanceStore: nil,
		Images:        &NoopImageService{},
		Clock:         clk,
		Historian:     nil,
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := NewManager(cfg, NewNoopPersister())
	rule := models.RuleGen.With(models.RuleGen.WithFor(0), models.RuleGen.WithMissingSeriesEvalsToResolve(1)).GenerateRef()

	results := eval.Results{
		newEvalResultWithValues(clk.Now(), data.Labels{"series": "a"}, 16),
		newEvalResultWithValues(clk.Now(), data.Labels{"series": "b"}, 16),
	}

	st.ProcessEvalResults(ctx, clk.Now(), rule, results, nil, nil)

	logger := log.New("test")
	_, staleCount := st.processMissingSeriesStates(logger, clk.Now(), rule, func(string) *models.Image { return nil })
	require.Equal(t, 0, staleCount)

	currentStates := st.GetStatesForRuleUID(ctx, rule.OrgID, rule.UID)
	require.Len(t, currentStates, 2)
}

func TestMemoryGrowthBoundedAcrossEvalCycles(t *testing.T) {
	ctx := context.Background()
	clk := clock.NewMock()

	cfg := ManagerCfg{
		Metrics:       nil,
		ExternalURL:   nil,
		InstanceStore: nil,
		Images:        &NoopImageService{},
		Clock:         clk,
		Historian:     nil,
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := NewManager(cfg, NewNoopPersister())
	rule := models.RuleGen.With(models.RuleGen.WithFor(0), models.RuleGen.WithMissingSeriesEvalsToResolve(1)).GenerateRef()

	runtime.GC()
	var ms1, ms2 runtime.MemStats
	runtime.ReadMemStats(&ms1)

	const cycles = 500
	const seriesPerCycle = 50
	const valuesPerSeries = 256

	for cycle := 0; cycle < cycles; cycle++ {
		clk.Add(time.Duration(rule.IntervalSeconds) * time.Second)
		limit := seriesPerCycle
		if cycle%2 == 1 {
			limit = seriesPerCycle / 2
		}
		results := make(eval.Results, 0, limit)
		for i := 0; i < limit; i++ {
			results = append(results, newEvalResultWithValues(clk.Now(), data.Labels{
				"series": seriesLabel(i),
				"cycle":  seriesLabel(cycle % 10),
			}, valuesPerSeries))
		}
		tr := st.ProcessEvalResults(ctx, clk.Now(), rule, results, nil, nil)
		ReleaseEvictedStaleTransitionValueMaps(tr)
		runtime.GC()
	}

	runtime.GC()
	runtime.ReadMemStats(&ms2)

	growth := ms2.HeapAlloc - ms1.HeapAlloc
	require.Less(t, int64(growth), int64(20*1024*1024), "heap should not grow >20MB over cycles")
}

func TestMemoryReleasedAfterFullPipeline(t *testing.T) {
	ctx := context.Background()
	clk := clock.NewMock()

	cfg := ManagerCfg{
		Metrics:       nil,
		ExternalURL:   nil,
		InstanceStore: nil,
		Images:        &NoopImageService{},
		Clock:         clk,
		Historian:     nil,
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := NewManager(cfg, NewNoopPersister())
	rule := models.RuleGen.With(models.RuleGen.WithFor(0), models.RuleGen.WithMissingSeriesEvalsToResolve(1)).GenerateRef()

	runtime.GC()
	var ms1, ms2 runtime.MemStats
	runtime.ReadMemStats(&ms1)

	const cycles = 200
	const nSeries = 100
	const valuesPerSeries = 64

	for c := 0; c < cycles; c++ {
		clk.Add(time.Duration(rule.IntervalSeconds) * time.Second)
		full := make(eval.Results, 0, nSeries)
		for i := 0; i < nSeries; i++ {
			full = append(full, newEvalResultWithValues(clk.Now(), data.Labels{
				"series": seriesLabel(i),
				"wave":   seriesLabel(c % 7),
			}, valuesPerSeries))
		}
		tr1 := st.ProcessEvalResults(ctx, clk.Now(), rule, full, nil, nil)
		ReleaseEvictedStaleTransitionValueMaps(tr1)

		clk.Add(time.Duration(rule.IntervalSeconds) * time.Second)
		// One series remains; the other nSeries-1 go missing and are evicted as stale on this tick.
		one := eval.Results{
			newEvalResultWithValues(clk.Now(), data.Labels{"series": "a", "wave": seriesLabel(c % 7)}, valuesPerSeries),
		}
		tr2 := st.ProcessEvalResults(ctx, clk.Now(), rule, one, nil, nil)
		ReleaseEvictedStaleTransitionValueMaps(tr2)
		runtime.GC()
	}

	runtime.GC()
	runtime.ReadMemStats(&ms2)

	growth := ms2.HeapAlloc - ms1.HeapAlloc
	require.Less(t, int64(growth), int64(30*1024*1024), "heap should not grow >30MB over churn with stale evictions")
}

func TestStaleStatesConcurrentSafety(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	clk := clock.NewMock()

	cfg := ManagerCfg{
		Metrics:       nil,
		ExternalURL:   nil,
		InstanceStore: nil,
		Images:        &NoopImageService{},
		Clock:         clk,
		Historian:     nil,
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
	}
	st := NewManager(cfg, NewNoopPersister())

	const workers = 10
	var wg sync.WaitGroup
	wg.Add(workers)

	for w := 0; w < workers; w++ {
		rule := models.RuleGen.With(
			models.RuleGen.WithFor(0),
			models.RuleGen.WithMissingSeriesEvalsToResolve(1),
		).GenerateRef()

		go func(rule *models.AlertRule, worker int) {
			defer wg.Done()
			now := clk.Now().Add(time.Duration(worker+1) * time.Second)
			results := eval.Results{
				newEvalResultWithValues(now, data.Labels{"series": "a"}, 64),
				newEvalResultWithValues(now, data.Labels{"series": "b"}, 64),
			}
			tr1 := st.ProcessEvalResults(ctx, now, rule, results, nil, nil)
			ReleaseEvictedStaleTransitionValueMaps(tr1)

			now2 := now.Add(time.Duration(rule.IntervalSeconds) * time.Second)
			tr2 := st.ProcessEvalResults(ctx, now2, rule, eval.Results{
				newEvalResultWithValues(now2, data.Labels{"series": "a"}, 64),
			}, nil, nil)
			ReleaseEvictedStaleTransitionValueMaps(tr2)
		}(rule, w)
	}

	wg.Wait()
}

func TestReleaseEvictedStaleTransitionValueMapsSkipsLiveStates(t *testing.T) {
	t.Parallel()

	s := &State{
		State:       eval.Alerting,
		StateReason: "",
		Values:      map[string]float64{"K": 1},
		LatestResult: &Evaluation{
			Values: map[string]float64{"K": 1},
		},
	}
	tr := StateTransition{State: s}
	ReleaseEvictedStaleTransitionValueMaps(StateTransitions{tr})
	require.Contains(t, s.Values, "K")
	require.Contains(t, s.LatestResult.Values, "K")

	s2 := &State{
		State:       eval.Normal,
		StateReason: models.StateReasonMissingSeries,
		Values:      map[string]float64{"K": 2},
		LatestResult: &Evaluation{
			Values: map[string]float64{"K": 2},
		},
	}
	tr2 := StateTransition{State: s2}
	ReleaseEvictedStaleTransitionValueMaps(StateTransitions{tr2})
	require.Nil(t, s2.Values)
	require.Nil(t, s2.LatestResult.Values)
}

func newEvalResultWithValues(evaluatedAt time.Time, labels data.Labels, n int) eval.Result {
	values := make(map[string]eval.NumberValueCapture, n)
	for i := 0; i < n; i++ {
		v := float64(i)
		values[seriesLabel(i)] = eval.NumberValueCapture{
			Var:    seriesLabel(i),
			Labels: labels.Copy(),
			Value:  &v,
			Type:   "reduce",
		}
	}
	return eval.Result{
		Instance:           labels,
		State:              eval.Alerting,
		Values:             values,
		EvaluatedAt:        evaluatedAt,
		EvaluationDuration: 5 * time.Millisecond,
		EvaluationString:   "",
	}
}

func seriesLabel(i int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz"
	if i >= 0 && i < len(letters) {
		return string(letters[i])
	}
	return "x" + string(rune('a'+(i%26)))
}
