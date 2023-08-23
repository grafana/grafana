package eval

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func BenchmarkEvaluate(b *testing.B) {
	var dataResp backend.QueryDataResponse
	seedDataResponse(&dataResp, 10000)
	var evaluator ConditionEvaluator = &conditionEvaluator{
		clock: clock.NewMock(),
		expressionService: &fakeExpressionService{
			hook: func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
				return &dataResp, nil
			},
		},
		condition: models.Condition{
			Condition: "B",
		},
	}
	for i := 0; i < b.N; i++ {
		_, err := evaluator.Evaluate(context.Background(), time.Now())
		if err != nil {
			b.Fatalf("Unexpected error: %s", err)
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
				data.NewField("Value", labels, []*float64{util.Pointer(1.0)}),
			},
		})
		b.Frames = append(b.Frames, &data.Frame{
			Fields: data.Fields{
				data.NewField("Value", labels, []*float64{util.Pointer(1.0)}),
			},
		})
		resps["A"], resps["B"] = a, b
	}
	r.Responses = resps
}
