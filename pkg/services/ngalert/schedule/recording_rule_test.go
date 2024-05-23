package schedule

import (
	context "context"
	"testing"
	"time"

	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestRecordingRule(t *testing.T) {
	gen := models.RuleGen.With(models.RuleGen.WithRecordingRules())

	t.Run("when rule evaluation is not stopped", func(t *testing.T) {

	})

	t.Run("when rule evaluation is stopped", func(t *testing.T) {
		t.Run("eval should do nothing", func(t *testing.T) {
			r := blankRuleForTests(context.Background())
			r.Stop(nil)
			ev := &Evaluation{
				scheduledAt: time.Now(),
				rule:        gen.GenerateRef(),
				folderTitle: util.GenerateShortUID(),
			}
		})
	})

	t.Run("should be thread-safe", func(t *testing.T) {

	})
}

func blankRecordingRuleForTests(ctx context.Context) *recordingRule {
	return newRecordingRule(context.Background(), 0, nil, nil, nil, nil)
}
