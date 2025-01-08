package state

import (
	"context"
	"math/rand"
	"net/url"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func BenchmarkGetOrCreateTest(b *testing.B) {
	cache := newCache()
	rule := models.RuleGen.With(func(rule *models.AlertRule) {
		for i := 0; i < 2; i++ {
			rule.Labels = data.Labels{
				"label-1": "{{ $value }}",
				"label-2": "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
			}
			rule.Annotations = data.Labels{
				"anno-1": "{{ $value }}",
				"anno-2": "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
			}
		}
	}).GenerateRef()
	result := eval.ResultGen(func(r *eval.Result) {
		r.Values = map[string]eval.NumberValueCapture{
			"A": {
				Var:    "A",
				Labels: data.Labels{"instance": uuid.New().String()},
				Value:  func(f float64) *float64 { return &f }(rand.Float64()),
			},
		}
	})()
	ctx := context.Background()
	log := &logtest.Fake{}
	u, _ := url.Parse("http://localhost")
	// values := make([]int64, count)
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = cache.create(ctx, log, rule, result, nil, u)
		}
	})
}
