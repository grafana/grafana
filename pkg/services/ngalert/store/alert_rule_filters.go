package store

import (
	"regexp"
	"strings"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// filterLiteRuleUIDs applies filters to lite rules and returns matching UIDs in input order
func filterLiteRuleUIDs(liteRules []*ngmodels.AlertRuleLite, query *ngmodels.ListAlertRulesExtendedQuery) []string {
	if !hasAnyFilters(query) && query.RuleType == ngmodels.RuleTypeFilterAll {
		// No filters: return all UIDs
		uids := make([]string, 0, len(liteRules))
		for _, lr := range liteRules {
			uids = append(uids, lr.UID)
		}
		return uids
	}
	uids := make([]string, 0, len(liteRules))
	for _, lr := range liteRules {
		if matchesAllFiltersLite(lr, query) {
			uids = append(uids, lr.UID)
		}
	}
	return uids
}

func matchesAllFiltersLite(rule *ngmodels.AlertRuleLite, query *ngmodels.ListAlertRulesExtendedQuery) bool {
	// RuleType
	if query.RuleType != ngmodels.RuleTypeFilterAll {
		isRecording := rule.IsRecording
		if query.RuleType == ngmodels.RuleTypeFilterRecording && !isRecording {
			return false
		}
		if query.RuleType == ngmodels.RuleTypeFilterAlerting && isRecording {
			return false
		}
	}
	// NamespaceUIDs
	if len(query.NamespaceUIDs) > 0 {
		found := false
		for _, uid := range query.NamespaceUIDs {
			if rule.NamespaceUID == uid {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	// RuleGroups exact
	if len(query.RuleGroups) > 0 {
		found := false
		for _, g := range query.RuleGroups {
			if rule.RuleGroup == g {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	// Namespace string
	if query.Namespace != "" && !containsCaseInsensitive(rule.NamespaceUID, query.Namespace) {
		return false
	}
	// Group name substring
	if query.GroupName != "" && !containsCaseInsensitive(rule.RuleGroup, query.GroupName) {
		return false
	}
	// Rule name substring
	if query.RuleName != "" && !containsCaseInsensitive(rule.Title, query.RuleName) {
		return false
	}
	// Labels
	if len(query.Labels) > 0 {
		if !matchesLabelsLite(rule.Labels, query.Labels) {
			return false
		}
	}
	// Dashboard UID and panel
	if query.DashboardUID != "" {
		if rule.DashboardUID == nil || *rule.DashboardUID != query.DashboardUID {
			return false
		}
		if query.PanelID != 0 {
			if rule.PanelID == nil || *rule.PanelID != query.PanelID {
				return false
			}
		}
	}
	// Receiver/contact point
	if query.ReceiverName != "" || query.ContactPointName != "" {
		name := query.ReceiverName
		if name == "" {
			name = query.ContactPointName
		}
		if !sliceContainsCI(rule.ReceiverNames, name) {
			return false
		}
	}
	// Hide plugin rules by label
	if query.HidePluginRules {
		if rule.Labels == nil {
			return false
		}
		if _, ok := rule.Labels[GrafanaOriginLabel]; ok {
			return false
		}
	}
	// Datasource UIDs filter (lite)
	if len(query.DatasourceUIDs) > 0 {
		if len(rule.DatasourceUIDs) == 0 {
			return false
		}
		match := false
		for _, f := range query.DatasourceUIDs {
			for _, ds := range rule.DatasourceUIDs {
				if ds == f {
					match = true
					break
				}
			}
			if match {
				break
			}
		}
		if !match {
			return false
		}
	}
	return true
}

func matchesLabelsLite(labels map[string]string, matchers []string) bool {
	if labels == nil {
		return false
	}
	for _, matcherStr := range matchers {
		matcher, err := parseLabelMatcher(matcherStr)
		if err != nil {
			continue
		}
		if !matcher.Matches(labels) {
			return false
		}
	}
	return true
}

func sliceContainsCI(arr []string, needle string) bool {
	needle = strings.ToLower(needle)
	for _, v := range arr {
		if strings.ToLower(v) == needle {
			return true
		}
	}
	return false
}

const (
	// GrafanaOriginLabel is the label key used to identify plugin-provided rules
	GrafanaOriginLabel = "__grafana_origin"
)

// applyInMemoryFilters applies all configured filters to the given rules
// and returns only the rules that match all filter criteria
func applyInMemoryFilters(rules []*ngmodels.AlertRule, query *ngmodels.ListAlertRulesExtendedQuery) []*ngmodels.AlertRule {
	if !hasAnyFilters(query) {
		return rules
	}

	result := make([]*ngmodels.AlertRule, 0, len(rules))
	for _, rule := range rules {
		if matchesAllFilters(rule, query) {
			result = append(result, rule)
		}
	}
	return result
}

// hasAnyFilters checks if any filters are configured in the query
func hasAnyFilters(query *ngmodels.ListAlertRulesExtendedQuery) bool {
	return query.RuleType != ngmodels.RuleTypeFilterAll ||
		len(query.NamespaceUIDs) > 0 ||
		len(query.RuleGroups) > 0 ||
		query.Namespace != "" ||
		query.GroupName != "" ||
		query.RuleName != "" ||
		len(query.Labels) > 0 ||
		query.DashboardUID != "" ||
		query.PanelID != 0 ||
		query.ReceiverName != "" ||
		query.ContactPointName != "" ||
		query.HidePluginRules ||
		len(query.DatasourceUIDs) > 0
}

// matchesAllFilters checks if a rule matches all configured filters
func matchesAllFilters(rule *ngmodels.AlertRule, query *ngmodels.ListAlertRulesExtendedQuery) bool {
	// RuleType filter (alerting vs recording)
	if query.RuleType != ngmodels.RuleTypeFilterAll {
		ruleIsRecording := rule.Record != nil
		if query.RuleType == ngmodels.RuleTypeFilterRecording && !ruleIsRecording {
			return false
		}
		if query.RuleType == ngmodels.RuleTypeFilterAlerting && ruleIsRecording {
			return false
		}
	}

	// NamespaceUIDs filter (from base query)
	if len(query.NamespaceUIDs) > 0 {
		found := false
		for _, uid := range query.NamespaceUIDs {
			if rule.NamespaceUID == uid {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// RuleGroups filter (from base query - exact match on rule group names)
	if len(query.RuleGroups) > 0 {
		found := false
		for _, groupName := range query.RuleGroups {
			if rule.RuleGroup == groupName {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Namespace filter (extended query - for name-based filtering)
	if query.Namespace != "" && !matchesNamespace(rule, query.Namespace) {
		return false
	}

	// Group name filter
	if query.GroupName != "" && !matchesGroupName(rule, query.GroupName) {
		return false
	}

	// Rule name filter
	if query.RuleName != "" && !matchesRuleName(rule, query.RuleName) {
		return false
	}

	// Label matchers filter
	if len(query.Labels) > 0 && !matchesLabels(rule, query.Labels) {
		return false
	}

	// Dashboard UID filter
	if query.DashboardUID != "" {
		if !matchesDashboardUID(rule, query.DashboardUID) {
			return false
		}
		// Also check PanelID if specified
		if query.PanelID != 0 {
			if rule.PanelID == nil || *rule.PanelID != query.PanelID {
				return false
			}
		}
	}

	// Receiver name filter (from base query)
	if query.ReceiverName != "" && !matchesContactPoint(rule, query.ReceiverName) {
		return false
	}

	// Contact point filter (from extended query)
	if query.ContactPointName != "" && !matchesContactPoint(rule, query.ContactPointName) {
		return false
	}

	// Plugin rules filter
	if query.HidePluginRules && isPluginProvided(rule) {
		return false
	}

	// Datasource UIDs filter
	if len(query.DatasourceUIDs) > 0 && !matchesDatasources(rule, query.DatasourceUIDs) {
		return false
	}

	return true
}

// matchesNamespace checks if the rule's namespace (folder UID) matches the filter
// Supports both exact UID match and case-insensitive substring match
func matchesNamespace(rule *ngmodels.AlertRule, namespace string) bool {
	if rule.NamespaceUID == "" {
		return false
	}
	// Try exact match first (for UID)
	if rule.NamespaceUID == namespace {
		return true
	}
	// Case-insensitive substring match (for folder name)
	return containsCaseInsensitive(rule.NamespaceUID, namespace)
}

// matchesGroupName checks if the rule's group name matches the filter
// Uses case-insensitive substring matching
func matchesGroupName(rule *ngmodels.AlertRule, groupName string) bool {
	if rule.RuleGroup == "" {
		return false
	}
	return containsCaseInsensitive(rule.RuleGroup, groupName)
}

// matchesRuleName checks if the rule's title matches the filter
// Uses case-insensitive substring matching
func matchesRuleName(rule *ngmodels.AlertRule, ruleName string) bool {
	if rule.Title == "" {
		return false
	}
	return containsCaseInsensitive(rule.Title, ruleName)
}

// matchesLabels checks if the rule's labels match all provided label matchers
// Supports formats: "key=value", "key!=value", "key=~regex", "key!~regex"
func matchesLabels(rule *ngmodels.AlertRule, matchers []string) bool {
	if rule.Labels == nil {
		return false
	}

	for _, matcherStr := range matchers {
		matcher, err := parseLabelMatcher(matcherStr)
		if err != nil {
			// Skip invalid matchers
			continue
		}

		if !matcher.Matches(rule.Labels) {
			return false
		}
	}

	return true
}

// matchesDashboardUID checks if the rule is associated with the given dashboard
func matchesDashboardUID(rule *ngmodels.AlertRule, dashboardUID string) bool {
	if rule.Annotations == nil {
		return false
	}
	return rule.Annotations[ngmodels.DashboardUIDAnnotation] == dashboardUID
}

// matchesContactPoint checks if the rule uses the specified contact point
func matchesContactPoint(rule *ngmodels.AlertRule, contactPoint string) bool {
	if rule.NotificationSettings == nil || len(rule.NotificationSettings) == 0 {
		return false
	}
	// Check if any of the notification settings has this receiver
	for _, ns := range rule.NotificationSettings {
		if ns.Receiver == contactPoint {
			return true
		}
	}
	return false
}

// isPluginProvided checks if the rule is provided by a plugin
// Plugin-provided rules have the __grafana_origin label set
func isPluginProvided(rule *ngmodels.AlertRule) bool {
	if rule.Labels == nil {
		return false
	}
	_, hasOriginLabel := rule.Labels[GrafanaOriginLabel]
	return hasOriginLabel
}

// containsCaseInsensitive checks if haystack contains needle (case-insensitive)
func containsCaseInsensitive(haystack, needle string) bool {
	return strings.Contains(
		strings.ToLower(haystack),
		strings.ToLower(needle),
	)
}

// labelMatcher represents a label matching operation
type labelMatcher struct {
	key      string
	value    string
	isRegex  bool
	isEqual  bool // true for = or =~, false for != or !~
	compiled *regexp.Regexp
}

// Matches checks if the given labels satisfy this matcher
func (m *labelMatcher) Matches(labels map[string]string) bool {
	labelValue, exists := labels[m.key]

	if m.isRegex {
		if m.compiled == nil {
			return false
		}
		matches := m.compiled.MatchString(labelValue)
		if m.isEqual {
			return matches
		}
		return !matches
	}

	// Exact match
	if m.isEqual {
		return exists && labelValue == m.value
	}
	return !exists || labelValue != m.value
}

// parseLabelMatcher parses a label matcher string
// Formats: "key=value", "key!=value", "key=~regex", "key!~regex"
func parseLabelMatcher(matcherStr string) (*labelMatcher, error) {
	matcherStr = strings.TrimSpace(matcherStr)

	// Try regex matchers first (=~ and !~)
	if idx := strings.Index(matcherStr, "=~"); idx > 0 {
		key := strings.TrimSpace(matcherStr[:idx])
		value := strings.TrimSpace(matcherStr[idx+2:])
		compiled, err := regexp.Compile(value)
		if err != nil {
			// If regex is invalid, treat as exact match
			return &labelMatcher{
				key:     key,
				value:   value,
				isRegex: false,
				isEqual: true,
			}, nil
		}
		return &labelMatcher{
			key:      key,
			value:    value,
			isRegex:  true,
			isEqual:  true,
			compiled: compiled,
		}, nil
	}

	if idx := strings.Index(matcherStr, "!~"); idx > 0 {
		key := strings.TrimSpace(matcherStr[:idx])
		value := strings.TrimSpace(matcherStr[idx+2:])
		compiled, err := regexp.Compile(value)
		if err != nil {
			// If regex is invalid, treat as exact not-match
			return &labelMatcher{
				key:     key,
				value:   value,
				isRegex: false,
				isEqual: false,
			}, nil
		}
		return &labelMatcher{
			key:      key,
			value:    value,
			isRegex:  true,
			isEqual:  false,
			compiled: compiled,
		}, nil
	}

	// Try exact matchers (= and !=)
	if idx := strings.Index(matcherStr, "!="); idx > 0 {
		return &labelMatcher{
			key:     strings.TrimSpace(matcherStr[:idx]),
			value:   strings.TrimSpace(matcherStr[idx+2:]),
			isRegex: false,
			isEqual: false,
		}, nil
	}

	if idx := strings.Index(matcherStr, "="); idx > 0 {
		return &labelMatcher{
			key:     strings.TrimSpace(matcherStr[:idx]),
			value:   strings.TrimSpace(matcherStr[idx+1:]),
			isRegex: false,
			isEqual: true,
		}, nil
	}

	// If no operator found, treat as a simple key matcher (key exists)
	return &labelMatcher{
		key:      matcherStr,
		value:    "",
		isRegex:  true,
		isEqual:  true,
		compiled: regexp.MustCompile(".*"), // Match any value
	}, nil
}

// matchesDatasources checks if the rule queries any of the specified datasources
func matchesDatasources(rule *ngmodels.AlertRule, datasourceUIDs []string) bool {
	if len(rule.Data) == 0 {
		return false
	}

	// Extract datasource UIDs from rule queries
	for _, query := range rule.Data {
		// Skip expression datasources (UID -100 or __expr__)
		if query.DatasourceUID == "-100" || query.DatasourceUID == "__expr__" {
			continue
		}

		// Check if this datasource is in the filter list
		for _, filterUID := range datasourceUIDs {
			if query.DatasourceUID == filterUID {
				return true
			}
		}
	}

	return false
}
