package schedule

import (
	"fmt"
	"hash/fnv"
	"sort"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	models "github.com/grafana/grafana/pkg/services/ngalert/models"
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

// updateRulesMetrics updates metrics for alert rules.
// Keeps a state in the schedule between calls to delete metrics for rules that are no longer present.
func (sch *schedule) updateRulesMetrics(alertRules []*models.AlertRule) {
	rulesPerOrgFolderGroup := make(map[models.AlertRuleGroupKeyWithFolderFullpath]int64)       // AlertRuleGroupKeyWithFolderFullpath -> count
	rulesPerOrgFolderGroupPaused := make(map[models.AlertRuleGroupKeyWithFolderFullpath]int64) // AlertRuleGroupKeyWithFolderFullpath -> count
	orgsNfSettings := make(map[int64]int64)                                                    // orgID -> count
	groupsPerOrg := make(map[int64]map[string]struct{})                                        // orgID -> set of groups

	// Remember what orgs and alert groups we process in the current update metrics call,
	// so we can delete metrics for orgs and groups that are no longer present in the new state.
	updateMetricsForOrgsAndGroups := map[int64]map[models.AlertRuleGroupKeyWithFolderFullpath]struct{}{} // orgID -> set of AlertRuleGroupWithFolderTitle

	for _, rule := range alertRules {
		key := models.AlertRuleGroupKeyWithFolderFullpath{
			AlertRuleGroupKey: rule.GetGroupKey(),
			FolderFullpath:    sch.schedulableAlertRules.folderTitles[rule.GetFolderKey()],
		}
		rulesPerOrgFolderGroup[key]++

		if _, ok := updateMetricsForOrgsAndGroups[rule.OrgID]; !ok {
			updateMetricsForOrgsAndGroups[rule.OrgID] = make(map[models.AlertRuleGroupKeyWithFolderFullpath]struct{})
		}
		updateMetricsForOrgsAndGroups[rule.OrgID][key] = struct{}{}

		if rule.IsPaused {
			rulesPerOrgFolderGroupPaused[key]++
		}

		if len(rule.NotificationSettings) > 0 {
			orgsNfSettings[rule.OrgID]++
		}

		orgGroups, ok := groupsPerOrg[rule.OrgID]
		if !ok {
			orgGroups = make(map[string]struct{})
			groupsPerOrg[rule.OrgID] = orgGroups
		}
		orgGroups[rule.RuleGroup] = struct{}{}
	}

	for key, numRules := range rulesPerOrgFolderGroup {
		numRulesPaused := rulesPerOrgFolderGroupPaused[key]
		ruleGroupLabelValue := makeRuleGroupLabelValue(key)
		sch.metrics.GroupRules.WithLabelValues(fmt.Sprint(key.OrgID), metrics.AlertRuleActiveLabelValue, ruleGroupLabelValue).Set(float64(numRules - numRulesPaused))
		sch.metrics.GroupRules.WithLabelValues(fmt.Sprint(key.OrgID), metrics.AlertRulePausedLabelValue, ruleGroupLabelValue).Set(float64(numRulesPaused))
	}

	for orgID := range updateMetricsForOrgsAndGroups {
		sch.metrics.SimpleNotificationRules.WithLabelValues(fmt.Sprint(orgID)).Set(float64(orgsNfSettings[orgID]))
		sch.metrics.Groups.WithLabelValues(fmt.Sprint(orgID)).Set(float64(len(groupsPerOrg[orgID])))
	}

	// While these are the rules that we iterate over, at the moment there's no 100% guarantee that they'll be
	// scheduled as rules could be removed before we get a chance to evaluate them.
	sch.metrics.SchedulableAlertRules.Set(float64(len(alertRules)))
	sch.metrics.SchedulableAlertRulesHash.Set(float64(hashUIDs(alertRules)))

	// Delete metrics for rule groups and orgs that are no longer present in the new state
	for orgID, alertRuleGroupsMap := range sch.lastUpdatedMetricsForOrgsAndGroups {
		if orgOrGroupDeleted(updateMetricsForOrgsAndGroups, orgID, nil) {
			sch.metrics.SimpleNotificationRules.DeleteLabelValues(fmt.Sprint(orgID))
			sch.metrics.Groups.DeleteLabelValues(fmt.Sprint(orgID))
		}

		for key := range alertRuleGroupsMap {
			if orgOrGroupDeleted(updateMetricsForOrgsAndGroups, orgID, &key) {
				ruleGroupLabelValue := makeRuleGroupLabelValue(key)
				sch.metrics.GroupRules.DeleteLabelValues(fmt.Sprint(key.AlertRuleGroupKey.OrgID), metrics.AlertRuleActiveLabelValue, ruleGroupLabelValue)
				sch.metrics.GroupRules.DeleteLabelValues(fmt.Sprint(key.AlertRuleGroupKey.OrgID), metrics.AlertRulePausedLabelValue, ruleGroupLabelValue)
			}
		}
	}

	// update the call state
	sch.lastUpdatedMetricsForOrgsAndGroups = updateMetricsForOrgsAndGroups
}

// makeRuleGroupLabelValue returns a string that can be used as a label (rule_group) value for alert rule group metrics.
func makeRuleGroupLabelValue(key models.AlertRuleGroupKeyWithFolderFullpath) string {
	return fmt.Sprintf("%s;%s", key.FolderFullpath, key.AlertRuleGroupKey.RuleGroup)
}

// orgOrGroupDeleted returns true if the org or group is no longer present in the new update metrics state.
func orgOrGroupDeleted(updateMetrics map[int64]map[models.AlertRuleGroupKeyWithFolderFullpath]struct{}, orgID int64, alertRuleGroupKey *models.AlertRuleGroupKeyWithFolderFullpath) bool {
	if _, ok := updateMetrics[orgID]; !ok {
		return true
	}

	if alertRuleGroupKey != nil {
		if _, ok := updateMetrics[orgID][*alertRuleGroupKey]; !ok {
			return true
		}
	}

	return false
}
