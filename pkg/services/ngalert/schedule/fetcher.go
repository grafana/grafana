package schedule

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (sch *schedule) getAlertRules(ctx context.Context, disabledOrgs []int64) []*models.SchedulableAlertRule {
	start := time.Now()
	defer func() {
		sch.metrics.GetAlertRulesDuration.Observe(time.Since(start).Seconds())
	}()

	q := models.GetAlertRulesForSchedulingQuery{
		ExcludeOrgIDs: disabledOrgs,
	}
	err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q)
	if err != nil {
		sch.log.Error("failed to fetch alert definitions", "err", err)
		return nil
	}
	return q.Result
}
