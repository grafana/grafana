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

func (sch *schedule) updateRulesMetrics(alertRules []*models.AlertRule) {
	rulesPerOrg := make(map[int64]int64)                // orgID -> count
	orgsPaused := make(map[int64]int64)                 // orgID -> count
	orgsNfSettings := make(map[int64]int64)             // orgID -> count
	groupsPerOrg := make(map[int64]map[string]struct{}) // orgID -> set of groups
	for _, rule := range alertRules {
		rulesPerOrg[rule.OrgID]++

		if rule.IsPaused {
			orgsPaused[rule.OrgID]++
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

	for orgID, numRules := range rulesPerOrg {
		numRulesPaused := orgsPaused[orgID]
		numRulesNfSettings := orgsNfSettings[orgID]
		sch.metrics.GroupRules.WithLabelValues(fmt.Sprint(orgID), metrics.AlertRuleActiveLabelValue).Set(float64(numRules - numRulesPaused))
		sch.metrics.GroupRules.WithLabelValues(fmt.Sprint(orgID), metrics.AlertRulePausedLabelValue).Set(float64(numRulesPaused))
		sch.metrics.SimpleNotificationRules.WithLabelValues(fmt.Sprint(orgID)).Set(float64(numRulesNfSettings))
	}

	for orgID, groups := range groupsPerOrg {
		sch.metrics.Groups.WithLabelValues(fmt.Sprint(orgID)).Set(float64(len(groups)))
	}

	// While these are the rules that we iterate over, at the moment there's no 100% guarantee that they'll be
	// scheduled as rules could be removed before we get a chance to evaluate them.
	sch.metrics.SchedulableAlertRules.Set(float64(len(alertRules)))
	sch.metrics.SchedulableAlertRulesHash.Set(float64(hashUIDs(alertRules)))
}
