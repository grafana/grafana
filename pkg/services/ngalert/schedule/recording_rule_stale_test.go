package schedule

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/setting"
)

type scriptedEvaluator struct {
	resp *backend.QueryDataResponse
	err  error
}

func (e *scriptedEvaluator) EvaluateRaw(context.Context, time.Time) (*backend.QueryDataResponse, error) {
	return e.resp, e.err
}

func (e *scriptedEvaluator) Evaluate(context.Context, time.Time) (eval.Results, error) {
	return nil, errors.New("not implemented")
}

type scriptedEvaluatorFactory struct{ ev *scriptedEvaluator }

func (f *scriptedEvaluatorFactory) Create(eval.EvaluationContext, models.Condition) (eval.ConditionEvaluator, error) {
	return f.ev, nil
}

type staleCall struct {
	dsUID  string
	name   string
	t      time.Time
	orgID  int64
	series []map[string]string
}

type staleHarness struct {
	t         *testing.T
	rule      *recordingRule
	ev        *scriptedEvaluator
	model     *models.AlertRule
	now       time.Time
	writes    int
	stale     []staleCall
	failWrite bool
	failStale bool
}

func newStaleHarness(t *testing.T) *staleHarness {
	t.Helper()

	h := &staleHarness{t: t, ev: &scriptedEvaluator{}, now: time.Unix(1_700_000_000, 0)}
	h.model = models.RuleGen.With(models.RuleGen.WithAllRecordingRules(), models.RuleGen.WithOrgID(123)).GenerateRef()
	h.model.Record.Metric = "my_metric"
	h.model.Record.TargetDatasourceUID = "ds-1"
	h.model.Record.From = "A"
	h.model.Labels = map[string]string{"rule": "label"}
	h.model.IsPaused = false

	fake := writer.FakeWriter{
		WriteFunc: func(context.Context, string, time.Time, data.Frames, int64, map[string]string) error {
			if h.failWrite {
				return errors.New("write failed")
			}
			h.writes++
			return nil
		},
		WriteStaleFunc: func(_ context.Context, dsUID, name string, ts time.Time, orgID int64, series []map[string]string) error {
			if h.failStale {
				return errors.New("stale write failed")
			}
			h.stale = append(h.stale, staleCall{dsUID: dsUID, name: name, t: ts, orgID: orgID, series: series})
			return nil
		},
	}

	h.rule = newRecordingRule(
		context.Background(),
		models.AlertRuleKeyWithGroup{},
		RetryConfig{MaxAttempts: 1},
		clock.NewMock(),
		&scriptedEvaluatorFactory{ev: h.ev},
		setting.RecordingRuleSettings{Enabled: true},
		log.NewNopLogger(),
		metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetSchedulerMetrics(),
		tracing.InitializeTracerForTest(),
		&dsAgnosticWriter{FakeWriter: fake},
		nil,
		nil,
	)
	return h
}

// FakeWriter rejects a non-empty data source UID, and these tests need one.
type dsAgnosticWriter struct{ writer.FakeWriter }

func (w *dsAgnosticWriter) WriteDatasource(ctx context.Context, _ string, name string, ts time.Time, frames data.Frames, orgID int64, extra map[string]string) error {
	return w.WriteFunc(ctx, name, ts, frames, orgID, extra)
}

func seriesResponse(series ...map[string]string) *backend.QueryDataResponse {
	frames := make(data.Frames, 0, len(series))
	for _, labels := range series {
		frames = append(frames, data.NewFrame("", data.NewField("Value", data.Labels(labels), []float64{1})).
			SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}))
	}
	return &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: frames}}}
}

func (h *staleHarness) tick() time.Time {
	h.t.Helper()
	h.now = h.now.Add(time.Minute)
	h.rule.doEvaluate(context.Background(), &Evaluation{scheduledAt: h.now, rule: h.model})
	return h.now
}

func (h *staleHarness) staleSeries(i int) []map[string]string {
	h.t.Helper()
	require.Greater(h.t, len(h.stale), i)
	return h.stale[i].series
}

func TestRecordingRuleStaleMarkers(t *testing.T) {
	a := map[string]string{"instance": "a"}
	b := map[string]string{"instance": "b"}
	withRuleLabels := func(m map[string]string) map[string]string {
		return map[string]string{"instance": m["instance"], "rule": "label"}
	}

	t.Run("series that stops being output is staled once at the tick it is missing", func(t *testing.T) {
		h := newStaleHarness(t)

		h.ev.resp = seriesResponse(a, b)
		h.tick()
		require.Empty(t, h.stale)

		h.ev.resp = seriesResponse(a)
		ts := h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, "ds-1", h.stale[0].dsUID)
		require.Equal(t, "my_metric", h.stale[0].name)
		require.Equal(t, int64(123), h.stale[0].orgID)
		require.Equal(t, ts, h.stale[0].t)
		require.Equal(t, []map[string]string{withRuleLabels(b)}, h.staleSeries(0), "marker carries the full written label set")

		h.tick()
		require.Len(t, h.stale, 1, "an already staled series is not staled again")
	})

	t.Run("series that comes back is not staled", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()
		h.ev.resp = seriesResponse(a)
		h.tick()
		require.Len(t, h.stale, 1)

		h.ev.resp = seriesResponse(a, b)
		h.tick()
		h.ev.resp = seriesResponse(a, b)
		h.tick()
		require.Len(t, h.stale, 1)
	})

	t.Run("no data stales every series and clears state", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()

		h.ev.resp = &backend.QueryDataResponse{Responses: backend.Responses{"A": {}}}
		ts := h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, ts, h.stale[0].t)
		require.ElementsMatch(t, []map[string]string{withRuleLabels(a), withRuleLabels(b)}, h.staleSeries(0))

		h.tick()
		require.Len(t, h.stale, 1, "state was cleared, nothing left to stale")
	})

	t.Run("a response that cannot be read keeps state and writes no markers", func(t *testing.T) {
		for name, resp := range map[string]*backend.QueryDataResponse{
			"no responses":        {Responses: backend.Responses{}},
			"refID not in result": {Responses: backend.Responses{"B": {}}},
		} {
			t.Run(name, func(t *testing.T) {
				h := newStaleHarness(t)
				h.ev.resp = seriesResponse(a)
				h.tick()

				h.ev.resp = resp
				h.tick()
				require.Empty(t, h.stale)

				h.ev.resp = seriesResponse()
				h.ev.resp.Responses["A"] = backend.DataResponse{Frames: data.Frames{}}
				h.tick()
				require.Len(t, h.stale, 1, "state was kept, so a later empty result still stales the series")
			})
		}
	})

	t.Run("query errors keep state and write no markers", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a)
		h.tick()

		h.ev.resp = nil
		h.ev.err = errors.New("query failed")
		h.tick()
		require.Equal(t, "error", h.rule.Status().Health)

		h.ev.err = nil
		h.ev.resp = &backend.QueryDataResponse{Responses: backend.Responses{"A": {Error: errors.New("query failed")}}}
		h.tick()
		require.Empty(t, h.stale)

		h.ev.resp = seriesResponse(b)
		h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, []map[string]string{withRuleLabels(a)}, h.staleSeries(0), "a was still tracked after the failed evaluations")
	})

	t.Run("failed write keeps the previous state and writes no markers", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()

		h.ev.resp = seriesResponse(a)
		h.failWrite = true
		h.tick()
		require.Empty(t, h.stale)
		require.Equal(t, "error", h.rule.Status().Health)

		h.failWrite = false
		ts := h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, ts, h.stale[0].t)
		require.Equal(t, []map[string]string{withRuleLabels(b)}, h.staleSeries(0))
	})

	t.Run("failed marker write does not fail the evaluation and is tried again", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()

		h.ev.resp = seriesResponse(a)
		h.failStale = true
		h.tick()
		require.Empty(t, h.stale)
		require.Equal(t, "ok", h.rule.Status().Health)
		require.NoError(t, h.rule.Status().LastError)

		h.failStale = false
		ts := h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, ts, h.stale[0].t, "the retry uses the later tick, so it is never older than the series' last sample")
		require.Equal(t, []map[string]string{withRuleLabels(b)}, h.staleSeries(0))
	})

	t.Run("failed marker write is dropped if the series came back", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()

		h.ev.resp = seriesResponse(a)
		h.failStale = true
		h.tick()

		h.failStale = false
		h.ev.resp = seriesResponse(a, b)
		h.tick()
		h.ev.resp = seriesResponse(a, b)
		h.tick()
		require.Empty(t, h.stale)
	})

	t.Run("changing metric, labels or target stales the old series where they were written", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a)
		h.tick()

		h.model.Record.Metric = "renamed_metric"
		h.model.Record.TargetDatasourceUID = "ds-2"
		h.model.Labels = map[string]string{"rule": "changed"}
		h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, "ds-1", h.stale[0].dsUID)
		require.Equal(t, "my_metric", h.stale[0].name)
		require.Equal(t, []map[string]string{withRuleLabels(a)}, h.staleSeries(0))

		h.tick()
		require.Len(t, h.stale, 1)
	})

	t.Run("pausing stales series on the first paused tick only", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a)
		h.tick()
		writes := h.writes

		h.model.IsPaused = true
		ts := h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, ts, h.stale[0].t)
		require.Equal(t, []map[string]string{withRuleLabels(a)}, h.staleSeries(0))

		h.tick()
		require.Len(t, h.stale, 1)
		require.Equal(t, writes, h.writes, "a paused rule writes nothing")
	})

	t.Run("a restarted rule has no state and writes no markers", func(t *testing.T) {
		restarted := newStaleHarness(t)
		restarted.ev.resp = seriesResponse(a)
		restarted.tick()
		require.Empty(t, restarted.stale)
	})
}

func TestLabelSetKey(t *testing.T) {
	require.Equal(t, labelSetKey(map[string]string{"a": "1", "b": "2"}), labelSetKey(map[string]string{"b": "2", "a": "1"}))
	require.NotEqual(t,
		labelSetKey(map[string]string{"a": "1b2"}),
		labelSetKey(map[string]string{"a": "1", "b": "2"}),
		"values that look like other labels do not collide",
	)
}
