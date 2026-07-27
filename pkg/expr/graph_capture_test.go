package expr

import (
	"context"
	"testing"
	"time"

	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/exprcapture"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func fptr(f float64) *float64 { return &f }

// dsQueryA is a datasource query for refID A returning whatever the mock endpoint holds for "A".
func dsQueryA() Query {
	return Query{
		RefID: "A",
		DataSource: &datasources.DataSource{
			OrgID: 1,
			UID:   "test",
			Type:  "test",
		},
		JSON:      json.RawMessage(`{ "datasource": { "uid": "test" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		TimeRange: AbsoluteTimeRange{From: time.Time{}, To: time.Time{}},
	}
}

func mathQuery(refID, expression string) Query {
	return Query{
		RefID:      refID,
		DataSource: dataSourceModel(),
		JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "` + expression + `" }`),
	}
}

func TestExecutePipeline_capturesExpressionStages(t *testing.T) {
	dsDF := data.NewFrame("A",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"host": "a"}, []*float64{fptr(2.0)}),
	)
	resp := map[string]backend.DataResponse{"A": {Frames: data.Frames{dsDF}}}

	// A (datasource) -> B = $A * 2 -> C = $B + 10. A three-stage chain so a reader can localize which
	// stage changed the data.
	queries := []Query{dsQueryA(), mathQuery("B", "$A * 2"), mathQuery("C", "$B + 10")}

	s, req := newMockQueryService(resp, queries)
	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	ctx, buf := exprcapture.WithCapture(context.Background())
	_, err = s.ExecutePipeline(ctx, time.Now(), pl)
	require.NoError(t, err)

	stages := buf.Stages()
	require.Len(t, stages, 3, "one stage per pipeline node")

	byRef := map[string]exprcapture.Stage{}
	for _, st := range stages {
		byRef[st.RefID] = st
	}

	require.Equal(t, "datasource", byRef["A"].Type)
	require.Equal(t, "test", byRef["A"].Command)
	require.Empty(t, byRef["A"].InputRefIDs, "the datasource node consumes no other node")
	require.NotEmpty(t, byRef["A"].Frames, "the datasource node's output frames are captured")
	require.NoError(t, byRef["A"].Error)

	require.Equal(t, "expression", byRef["B"].Type)
	require.Equal(t, "math", byRef["B"].Command)
	require.Equal(t, []string{"A"}, byRef["B"].InputRefIDs, "B consumes A")
	require.NotEmpty(t, byRef["B"].Frames)

	require.Equal(t, "expression", byRef["C"].Type)
	require.Equal(t, []string{"B"}, byRef["C"].InputRefIDs, "C consumes B")
	require.NotEmpty(t, byRef["C"].Frames)

	// The captured chain lets a reader walk A -> B -> C: each stage's inputs are the outputs of its
	// InputRefIDs, so the first stage whose output differs from its inputs is localizable.
	requireStageValue(t, byRef["A"], 2.0)
	requireStageValue(t, byRef["B"], 4.0)  // $A * 2
	requireStageValue(t, byRef["C"], 14.0) // $B + 10
}

func TestExecutePipeline_capturesDependencyErrorStage(t *testing.T) {
	// A fails at the datasource; B depends on A, so B is never executed and carries a dependency error.
	resp := map[string]backend.DataResponse{"A": {Error: context.DeadlineExceeded}}
	queries := []Query{dsQueryA(), mathQuery("B", "$A * 2")}

	s, req := newMockQueryService(resp, queries)
	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	ctx, buf := exprcapture.WithCapture(context.Background())
	_, err = s.ExecutePipeline(ctx, time.Now(), pl)
	require.NoError(t, err)

	byRef := map[string]exprcapture.Stage{}
	for _, st := range buf.Stages() {
		byRef[st.RefID] = st
	}
	require.Error(t, byRef["A"].Error, "A carries the datasource failure")
	require.Error(t, byRef["B"].Error, "B carries a dependency error and did not run")
	require.Empty(t, byRef["B"].Frames, "B produced no output")
	require.Equal(t, []string{"A"}, byRef["B"].InputRefIDs)
}

func TestExecutePipeline_noCaptureWithoutBuffer(t *testing.T) {
	// Without a capture buffer in context the pipeline runs normally and records nothing.
	resp := map[string]backend.DataResponse{"A": {Frames: data.Frames{
		data.NewFrame("A", data.NewField("value", nil, []*float64{fptr(1.0)})),
	}}}
	queries := []Query{dsQueryA(), mathQuery("B", "$A * 2")}

	s, req := newMockQueryService(resp, queries)
	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	// context.Background() carries no exprcapture buffer.
	_, err = s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)
	require.Nil(t, exprcapture.FromContext(context.Background()))
}

// requireStageValue asserts the single scalar/number value carried by a stage's output frame.
func requireStageValue(t *testing.T, stage exprcapture.Stage, want float64) {
	t.Helper()
	require.NotEmpty(t, stage.Frames)
	for _, f := range stage.Frames {
		for _, field := range f.Fields {
			if field.Type() != data.FieldTypeNullableFloat64 && field.Type() != data.FieldTypeFloat64 {
				continue
			}
			if field.Len() == 0 {
				continue
			}
			v, ok := field.ConcreteAt(field.Len() - 1)
			if !ok {
				continue
			}
			require.InDelta(t, want, v.(float64), 0.0001)
			return
		}
	}
	t.Fatalf("no float value field found in stage %s", stage.RefID)
}
