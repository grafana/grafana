package schedule

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// updateSchedulableAlertRules updates the alert rules for the scheduler. It returns an error
// if the database is unavailable or the query returned an error.
func (sch *schedule) updateSchedulableAlertRules(ctx context.Context, disabledOrgs []int64) error {
	start := time.Now()
	defer func() {
		sch.metrics.UpdateSchedulableAlertRulesDuration.Observe(time.Since(start).Seconds())
	}()

	q := models.GetAlertRulesForSchedulingQuery{
		ExcludeOrgIDs: disabledOrgs,
	}
	// If the database is unavailable or the query returns an error then return
	// the alert rules from the most recent tick
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		return err
	}
	sch.schedulableAlertRules = q.Result
	return nil
}
