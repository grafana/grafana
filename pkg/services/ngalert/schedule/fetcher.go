package schedule

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"time"
)

func (sch *schedule) getAlertRules(disabledOrgs []int64) []*models.AlertRule {
	start := time.Now()
	defer func() {
		sch.metrics.GetAlertRulesDuration.Observe(time.Since(start).Seconds())
	}()

	q := models.ListAlertRulesQuery{
		ExcludeOrgs: disabledOrgs,
	}
	err := sch.ruleStore.GetAlertRulesForScheduling(&q)
	if err != nil {
		sch.log.Error("failed to fetch alert definitions", "err", err)
		return nil
	}
	return q.Result
}
