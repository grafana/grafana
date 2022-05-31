package schedule

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// getAlertRules returns the most recent alert rules. If the database is unavailable
// or the query returned an error the alert rules from the most recent tick are returned
// along with the error.
func (sch *schedule) getAlertRules(ctx context.Context, disabledOrgs []int64) []*models.SchedulableAlertRule {
	start := time.Now()
	defer func() {
		sch.metrics.GetAlertRulesDuration.Observe(time.Since(start).Seconds())
	}()

	q := models.GetAlertRulesForSchedulingQuery{
		ExcludeOrgIDs: disabledOrgs,
	}

	// If the database is unavailable or the query returns an error then return
	// the alert rules from the most recent tick
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		sch.log.Error("failed to get most recent alert rules", "error", err)
		sch.metrics.GetAlertRulesFailures.Inc()

		sch.alertRulesMtx.Lock()
		defer sch.alertRulesMtx.Unlock()
		return sch.alertRules
	}

	sch.alertRulesMtx.Lock()
	sch.alertRules = q.Result
	sch.alertRulesMtx.Unlock()

	return q.Result
}
