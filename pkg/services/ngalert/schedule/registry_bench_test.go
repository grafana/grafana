package schedule

import (
	"fmt"
	"io"
	"math/rand"
	"testing"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func BenchmarkRuleWithFolderFingerprint(b *testing.B) {
	gen := models.RuleGen
	rules := gen.With(func(rule *models.AlertRule) {
		rule.Data = make([]models.AlertQuery, 0, 5)
		for i := 0; i < rand.Intn(5)+1; i++ {
			rule.Data = append(rule.Data, gen.GenerateQuery())
		}
	}).GenerateManyRef(b.N)
	folder := uuid.NewString()
	b.ReportAllocs()
	b.ResetTimer()
	var f fingerprint
	for i := 0; i < b.N; i++ {
		f = ruleWithFolder{rule: rules[i], folderTitle: folder}.Fingerprint()
	}
	b.StopTimer()
	_, _ = fmt.Fprint(io.Discard, f)
}
