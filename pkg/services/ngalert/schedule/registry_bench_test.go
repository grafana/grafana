package schedule

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"testing"
	"uuid"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func BenchmarkRuleWithFolderFingerprint(b *testing.B) {
	gen := models.RuleGen
	withQueries := func(condition string, extra ...models.AlertQuery) func(rule *models.AlertRule) {
		return func(rule *models.AlertRule) {
			rule.Data = make([]models.AlertQuery, 0, 5+len(extra))
			for i := 0; i < rand.Intn(5)+1; i++ {
				rule.Data = append(rule.Data, gen.GenerateQuery())
			}
			rule.Data = append(rule.Data, extra...)
			if condition != "" {
				rule.Condition = condition
			}
		}
	}
	// threshold is used as the rule's condition, so Fingerprint hashes its referenced var instead of its model.
	threshold := models.AlertQuery{
		RefID:         "T",
		DatasourceUID: expr.DatasourceUID,
		Model:         json.RawMessage(`{"refId":"T","type":"threshold","expression":"A","datasource":{"type":"__expr__","uid":"__expr__"},"conditions":[{"evaluator":{"type":"gt","params":[10]},"unloadEvaluator":{"type":"lt","params":[5]}}]}`),
	}
	cases := map[string]func(rule *models.AlertRule){
		"generated queries":            withQueries(""),
		"threshold query as condition": withQueries("T", threshold),
	}
	for name, mutate := range cases {
		b.Run(name, func(b *testing.B) {
			rules := gen.With(mutate).GenerateManyRef(b.N)
			folder := uuid.NewV4().String()
			b.ReportAllocs()
			b.ResetTimer()
			var f fingerprint
			for i := 0; i < b.N; i++ {
				f = ruleWithFolder{rule: rules[i], folderTitle: folder}.Fingerprint()
			}
			b.StopTimer()
			_, _ = fmt.Fprint(io.Discard, f)
		})
	}
}
