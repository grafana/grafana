package schedule

import (
	"context"
	"fmt"
	"hash/fnv"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// hashUIDs returns a fnv64 hash of the UIDs for all alert rules.
// The order of the alert rules does not matter as hashUIDs sorts
// the UIDs in increasing order.
func hashUIDs(alertRules []*models.SchedulableAlertRule) uint64 {
	h := fnv.New64()
	for _, uid := range sortedUIDs(alertRules) {
		// We can ignore err as fnv64 does not return an error
		// nolint:errcheck,gosec
		h.Write([]byte(uid))
	}
	return h.Sum64()
}

// sortedUIDs returns a slice of sorted UIDs.
func sortedUIDs(alertRules []*models.SchedulableAlertRule) []string {
	uids := make([]string, 0, len(alertRules))
	for _, alertRule := range alertRules {
		uids = append(uids, alertRule.UID)
	}
	sort.Strings(uids)
	return uids
}

// updateSchedulableAlertRules updates the alert rules for the scheduler.
// It returns an error if the database is unavailable or the query returned
// an error.
func (sch *schedule) updateSchedulableAlertRules(ctx context.Context) error {
	start := time.Now()
	defer func() {
		sch.metrics.UpdateSchedulableAlertRulesDuration.Observe(
			time.Since(start).Seconds())
	}()

	q := models.GetAlertRulesForSchedulingQuery{}
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		return fmt.Errorf("failed to get alert rules: %w", err)
	}
	sch.log.Debug("alert rules fetched", "count", len(q.Result))
	sch.schedulableAlertRules.set(q.Result)
	return nil
}
