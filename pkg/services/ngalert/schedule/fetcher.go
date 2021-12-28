package schedule

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (sch *schedule) fetchAllDetails(disabledOrgs []int64) []*models.AlertRule {
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
