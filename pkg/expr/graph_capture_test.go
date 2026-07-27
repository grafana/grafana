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
	res, err := s.ExecutePipeline(ctx, time.Now(), pl)
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
	require.NoError(t, byRef["A"].Error)

	require.Equal(t, "expression", byRef["B"].Type)
	require.Equal(t, "math", byRef["B"].Command)
	require.Equal(t, []string{"A"}, byRef["B"].InputRefIDs, "B consumes A")

	require.Equal(t, "expression", byRef["C"].Type)
	require.Equal(t, []string{"B"}, byRef["C"].InputRefIDs, "C consumes B")

	// The stages carry no frames of their own: every executed node is returned under its own refID,
	// which is where the diagnostics bundle reads a stage's output from. Assert that join holds for
	// every captured stage -- the capture is useless without it.
	for _, st := range stages {
		require.Contains(t, res.Responses, st.RefID, "stage %s has no response entry to join to", st.RefID)
	}

	// So a reader can walk A -> B -> C: each stage's inputs are the outputs of its InputRefIDs, and
	// the first stage whose output differs from its inputs is localizable.
	requireResponseValue(t, res, "A", 2.0)
	requireResponseValue(t, res, "B", 4.0)  // $A * 2
	requireResponseValue(t, res, "C", 14.0) // $B + 10
}

func TestExecutePipeline_capturesDependencyErrorStage(t *testing.T) {
	// A fails at the datasource; B depends on A, so B is never executed and carries a dependency error.
	resp := map[string]backend.DataResponse{"A": {Error: context.DeadlineExceeded}}
	queries := []Query{dsQueryA(), mathQuery("B", "$A * 2")}

	s, req := newMockQueryService(resp, queries)
	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	ctx, buf := exprcapture.WithCapture(context.Background())
	res, err := s.ExecutePipeline(ctx, time.Now(), pl)
	require.NoError(t, err)

	byRef := map[string]exprcapture.Stage{}
	for _, st := range buf.Stages() {
		byRef[st.RefID] = st
	}
	require.Error(t, byRef["A"].Error, "A carries the datasource failure")
	require.Error(t, byRef["B"].Error, "B carries a dependency error and did not run")
	require.Equal(t, []string{"A"}, byRef["B"].InputRefIDs)
	require.Empty(t, res.Responses["B"].Frames, "B produced no output")
}

// hiddenDSQueryA is dsQueryA with "hide": true -- the usual shape for a datasource query that only
// feeds an expression and is not drawn by the panel.
func hiddenDSQueryA() Query {
	q := dsQueryA()
	q.JSON = json.RawMessage(`{ "datasource": { "uid": "test" }, "hide": true, "intervalMs": 1000, "maxDataPoints": 1000 }`)
	return q
}

func TestTransformData_keepsHiddenNodesInResponseWhenCapturing(t *testing.T) {
	// A stage carries no output of its own, so every captured stage needs a response entry under the
	// same refID to join to. TransformData normally strips hidden refIDs from the response, which would
	// leave the hidden datasource stage -- the input side of the first expression, and the whole point
	// of the capture -- with nothing to join to. A capture buffer in context suppresses that filtering.
	dsDF := data.NewFrame("A",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"host": "a"}, []*float64{fptr(2.0)}),
	)
	resp := map[string]backend.DataResponse{"A": {Frames: data.Frames{dsDF}}}
	queries := []Query{hiddenDSQueryA(), mathQuery("B", "$A * 2")}

	t.Run("with a capture buffer the hidden node's output survives", func(t *testing.T) {
		s, req := newMockQueryService(resp, queries)
		s.cfg.ExpressionsEnabled = true

		ctx, buf := exprcapture.WithCapture(context.Background())
		res, err := s.TransformData(ctx, time.Now(), req)
		require.NoError(t, err)

		stages := buf.Stages()
		require.Len(t, stages, 2)
		for _, st := range stages {
			require.Contains(t, res.Responses, st.RefID, "stage %s has no response entry to join to", st.RefID)
		}
		// Both sides of the comparison a support engineer needs: A's raw value and B's derived one.
		requireResponseValue(t, res, "A", 2.0)
		requireResponseValue(t, res, "B", 4.0)
	})

	t.Run("without one the hidden node is still stripped", func(t *testing.T) {
		s, req := newMockQueryService(resp, queries)
		s.cfg.ExpressionsEnabled = true

		res, err := s.TransformData(context.Background(), time.Now(), req)
		require.NoError(t, err)
		require.NotContains(t, res.Responses, "A", "the normal query path must keep hiding hidden queries")
		require.Contains(t, res.Responses, "B")
	})
}

// unexecutableNode is a pipeline node that is not an ExecutableNode, which makes execute bail out with
// makeUnexpectedNodeTypeError while still returning the vars it accumulated.
type unexecutableNode struct{ refID string }

func (n *unexecutableNode) ID() int64                      { return 1 }
func (n *unexecutableNode) NodeType() NodeType             { return TypeCMDNode }
func (n *unexecutableNode) RefID() string                  { return n.refID }
func (n *unexecutableNode) String() string                 { return n.refID }
func (n *unexecutableNode) NeedsVars() []string            { return []string{} }
func (n *unexecutableNode) SetInputTo(string)              {}
func (n *unexecutableNode) IsInputTo() map[string]struct{} { return nil }
func (n *unexecutableNode) DisabledErr() error             { return nil }

func TestExecutePipeline_capturesStagesWhenExecutionFailsHard(t *testing.T) {
	// The DAG is worth more, not less, when the pipeline fails outright and produces no response at
	// all, so the capture must not sit behind ExecutePipeline's error return.
	s, _ := newMockQueryService(nil, nil)

	ctx, buf := exprcapture.WithCapture(context.Background())
	_, err := s.ExecutePipeline(ctx, time.Now(), DataPipeline{&unexecutableNode{refID: "A"}})
	require.Error(t, err, "an unexecutable node fails the pipeline")

	stages := buf.Stages()
	require.Len(t, stages, 1, "the pipeline's shape is captured despite the failure")
	require.Equal(t, "A", stages[0].RefID)
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

	// context.Background() carries no exprcapture buffer, so this buffer is unreachable from the
	// pipeline's context and must stay empty.
	_, unreachable := exprcapture.WithCapture(context.Background())
	_, err = s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)
	require.Empty(t, unreachable.Stages(), "a pipeline run without the buffer in its context records nothing")
}

// requireResponseValue asserts the single scalar/number value carried by a refID's output frame.
func requireResponseValue(t *testing.T, res *backend.QueryDataResponse, refID string, want float64) {
	t.Helper()
	frames := res.Responses[refID].Frames
	require.NotEmpty(t, frames, "no frames for refId %s", refID)
	for _, f := range frames {
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
	t.Fatalf("no float value field found for refId %s", refID)
}
