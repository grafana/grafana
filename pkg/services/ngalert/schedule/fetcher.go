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
func hashUIDs(alertRules []*models.AlertRule) uint64 {
	h := fnv.New64()
	for _, uid := range sortedUIDs(alertRules) {
		// We can ignore err as fnv64 does not return an error
		// nolint:errcheck,gosec
		h.Write([]byte(uid))
	}
	return h.Sum64()
}

// sortedUIDs returns a slice of sorted UIDs.
func sortedUIDs(alertRules []*models.AlertRule) []string {
	uids := make([]string, 0, len(alertRules))
	for _, alertRule := range alertRules {
		uids = append(uids, alertRule.UID)
	}
	sort.Strings(uids)
	return uids
}

// updateSchedulableAlertRules updates the alert rules for the scheduler.
// It returns diff that contains rule keys that were updated since the last poll,
// and an error if the database query encountered problems.
func (sch *schedule) updateSchedulableAlertRules(ctx context.Context) (diff, error) {
	start := time.Now()
	defer func() {
		sch.metrics.UpdateSchedulableAlertRulesDuration.Observe(
			time.Since(start).Seconds())
	}()

	if !sch.schedulableAlertRules.isEmpty() {
		keys, err := sch.ruleStore.GetAlertRulesKeysForScheduling(ctx)
		if err != nil {
			return diff{}, err
		}
		if !sch.schedulableAlertRules.needsUpdate(keys) {
			sch.log.Debug("No changes detected. Skip updating")
			return diff{}, nil
		}
	}
	// At this point, we know we need to re-fetch rules as there are changes.
	q := models.GetAlertRulesForSchedulingQuery{
		PopulateFolders: !sch.disableGrafanaFolder,
	}
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		return diff{}, fmt.Errorf("failed to get alert rules: %w", err)
	}
	d := sch.schedulableAlertRules.set(q.ResultRules, q.ResultFoldersTitles)
	sch.log.Debug("Alert rules fetched", "rulesCount", len(q.ResultRules), "foldersCount", len(q.ResultFoldersTitles), "updatedRules", len(d.updated))
	return d, nil
}
