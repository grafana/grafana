package schedule

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// updateSchedulableAlertRules updates the alert rules for the scheduler.
// It returns an error if the database is unavailable or the query returned
// an error.
func (sch *schedule) updateSchedulableAlertRules(ctx context.Context, disabledOrgs []int64) error {
	start := time.Now()
	defer func() {
		sch.metrics.UpdateSchedulableAlertRulesDuration.Observe(
			time.Since(start).Seconds())
	}()

	q := models.GetAlertRulesForSchedulingQuery{
		ExcludeOrgIDs: disabledOrgs,
	}
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		defer sch.metrics.UpdateSchedulableAlertRulesFailures.Inc()
		return fmt.Errorf("failed to get alert rules: %w", err)
	}
	sch.schedulableAlertRules = q.Result
	sch.metrics.SchedulableAlertRules.Set(float64(len(q.Result)))
	return nil
}
