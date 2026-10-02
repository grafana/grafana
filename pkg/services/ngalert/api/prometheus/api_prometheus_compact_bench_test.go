package api

import (
	"fmt"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
)

func BenchmarkPrepareRuleGroupStatusesV2_CompactOnly(b *testing.B) {
	for _, n := range []int{100, 500, 1000} {
		store := &fakeRuleGroupReader{rules: makeRules(n)}
		m := &countingMutator{}
		q := url.Values{}
		q.Set("compact", "true")
		q.Set("group_limit", fmt.Sprintf("%d", n+1))
		opts := makeOpts(q)

		b.Run(fmt.Sprintf("rules=%d", n), func(b *testing.B) {
			for b.Loop() {
				m.calls = 0
				PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, opts, m.mutate, nil)
			}
		})
	}
}
