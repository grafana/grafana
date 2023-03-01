package state

import (
	"context"
	"math/rand"
	"net/url"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func BenchmarkGetOrCreateTest(b *testing.B) {
	cache := newCache()
	rule := models.AlertRuleGen(func(rule *models.AlertRule) {
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
	})()
	result := eval.ResultGen(func(r *eval.Result) {
		r.Values = map[string]eval.NumberValueCapture{
			"A": {
				Var:    "A",
				Labels: data.Labels{"instance": uuid.New().String()},
				Value:  ptr.Float64(rand.Float64()),
			},
		}
	})()

	ctx := context.Background()
	log := &logtest.Fake{}
	u, _ := url.Parse("http://localhost")
	// values := make([]int64, count)
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = cache.getOrCreate(ctx, log, rule, result, nil, u)
		}
	})
}

/* Results
goos: windows
goarch: amd64
pkg: github.com/grafana/grafana/pkg/services/ngalert/state
cpu: 11th Gen Intel(R) Core(TM) i9-11900H @ 2.50GHz
BenchmarkGetOrCreateTest
BenchmarkGetOrCreateTest-16         7894            150920 ns/op
PASS
*/
