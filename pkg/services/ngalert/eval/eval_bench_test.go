package eval

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func BenchmarkEvaluate(b *testing.B) {
	var dataResp backend.QueryDataResponse
	seedDataResponse(&dataResp, 10000)
	var evaluator ConditionEvaluator = &conditionEvaluator{
		expressionService: &fakeExpressionService{
			hook: func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
				return &dataResp, nil
			},
		},
		condition: models.Condition{
			Condition: "B",
		},
	}
	for range b.N {
		_, err := evaluator.Evaluate(context.Background(), time.Now())
		if err != nil {
			b.Fatalf("Unexpected error: %s", err)
		}
	}
}

// BenchmarkCaptureMatching measures attaching captures to condition frames, the step
// that dominates evaluation CPU when rules return many series.
//
// The exact case is the fast path: a capture and its condition frame have the same label
// fingerprint. The superset and subset cases miss that lookup, so the matcher projects
// labels onto the label names the two sides share. A binary math expression produces the
// superset shape in practice, because its result takes the wider of its two operand
// label sets.
func BenchmarkCaptureMatching(b *testing.B) {
	shapes := []struct {
		name string
		// extra is how many labels are added to the capture side, and drop says whether
		// one of its labels is removed.
		extra int
		drop  bool
	}{
		{name: "exact"},
		{name: "superset", extra: 1},
		{name: "subset", drop: true},
	}
	for _, shape := range shapes {
		for _, n := range []int{2000, 8000} {
			b.Run(fmt.Sprintf("%s/%d", shape.name, n), func(b *testing.B) {
				condition := models.Condition{Condition: "B", Data: []models.AlertQuery{
					{RefID: "A", DatasourceUID: expr.DatasourceUID},
					{RefID: "B", DatasourceUID: expr.DatasourceUID},
				}}
				var resp backend.QueryDataResponse
				seedCaptureResponse(&resp, n, shape.extra, shape.drop)

				b.ReportAllocs()
				b.ResetTimer() // building the response above is not part of the measurement
				for range b.N {
					queryDataResponseToExecutionResults(condition, &resp)
				}
			})
		}
	}
}

func seedDataResponse(r *backend.QueryDataResponse, n int) {
	resps := make(backend.Responses, n)
	for i := 0; i < n; i++ {
		labels := data.Labels{
			"foo": strconv.Itoa(i),
			"bar": strconv.Itoa(i + 1),
		}
		a, b := resps["A"], resps["B"]
		a.Frames = append(a.Frames, &data.Frame{
			Fields: data.Fields{
				data.NewField("Time", labels, []time.Time{time.Now()}),
				data.NewField("Value", labels, []*float64{new(1.0)}),
			},
		})
		b.Frames = append(b.Frames, &data.Frame{
			Fields: data.Fields{
				data.NewField("Value", labels, []*float64{new(1.0)}),
			},
		})
		resps["A"], resps["B"] = a, b
	}
	r.Responses = resps
}

// seedCaptureResponse builds n single value frames for refID A and n for refID B, the
// condition. Every single value frame becomes a capture, so each condition frame finds
// an exact match among the captures of B, then looks for the capture of A of the same
// series. Adding or dropping a label on the A side changes its fingerprint, so that
// second lookup misses and takes the fallback.
func seedCaptureResponse(r *backend.QueryDataResponse, n, extra int, drop bool) {
	resps := make(backend.Responses, 2)
	a, b := resps["A"], resps["B"]
	for i := range n {
		conditionLabels := data.Labels{
			"foo":      strconv.Itoa(i),
			"bar":      strconv.Itoa(i + 1),
			"instance": strconv.Itoa(i + 2),
		}
		captureLabels := conditionLabels.Copy()
		for j := range extra {
			captureLabels["extra"+strconv.Itoa(j)] = strconv.Itoa(i)
		}
		if drop {
			delete(captureLabels, "instance")
		}
		a.Frames = append(a.Frames, &data.Frame{
			RefID:  "A",
			Fields: data.Fields{data.NewField("Value", captureLabels, []*float64{new(1.0)})},
		})
		b.Frames = append(b.Frames, &data.Frame{
			RefID:  "B",
			Fields: data.Fields{data.NewField("Value", conditionLabels, []*float64{new(1.0)})},
		})
	}
	resps["A"], resps["B"] = a, b
	r.Responses = resps
}
