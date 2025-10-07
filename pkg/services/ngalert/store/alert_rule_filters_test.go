package store

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// TestMatchesRuleName tests the rule name (title) filtering with case-insensitive substring matching
func TestMatchesRuleName(t *testing.T) {
	tests := []struct {
		name      string
		ruleTitle string
		filter    string
		expected  bool
	}{
		{
			name:      "exact match",
			ruleTitle: "CPU Alert",
			filter:    "CPU Alert",
			expected:  true,
		},
		{
			name:      "case insensitive match",
			ruleTitle: "CPU Alert",
			filter:    "cpu alert",
			expected:  true,
		},
		{
			name:      "substring match",
			ruleTitle: "High CPU Alert",
			filter:    "cpu",
			expected:  true,
		},
		{
			name:      "substring at start",
			ruleTitle: "CPU Alert",
			filter:    "CPU",
			expected:  true,
		},
		{
			name:      "substring at end",
			ruleTitle: "High CPU",
			filter:    "CPU",
			expected:  true,
		},
		{
			name:      "no match",
			ruleTitle: "Memory Alert",
			filter:    "cpu",
			expected:  false,
		},
		{
			name:      "empty rule title",
			ruleTitle: "",
			filter:    "cpu",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				Title: tt.ruleTitle,
			}
			result := matchesRuleName(rule, tt.filter)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMatchesGroupName tests the rule group name filtering with case-insensitive substring matching
func TestMatchesGroupName(t *testing.T) {
	tests := []struct {
		name      string
		groupName string
		filter    string
		expected  bool
	}{
		{
			name:      "exact match",
			groupName: "Production Alerts",
			filter:    "Production Alerts",
			expected:  true,
		},
		{
			name:      "case insensitive match",
			groupName: "Production Alerts",
			filter:    "production alerts",
			expected:  true,
		},
		{
			name:      "substring match",
			groupName: "Production Alerts",
			filter:    "production",
			expected:  true,
		},
		{
			name:      "no match",
			groupName: "Development Alerts",
			filter:    "production",
			expected:  false,
		},
		{
			name:      "empty group name",
			groupName: "",
			filter:    "production",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				RuleGroup: tt.groupName,
			}
			result := matchesGroupName(rule, tt.filter)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMatchesNamespace tests the namespace (folder UID) filtering
func TestMatchesNamespace(t *testing.T) {
	tests := []struct {
		name         string
		namespaceUID string
		filter       string
		expected     bool
	}{
		{
			name:         "exact UID match",
			namespaceUID: "abc123",
			filter:       "abc123",
			expected:     true,
		},
		{
			name:         "case insensitive substring match",
			namespaceUID: "Production-Folder",
			filter:       "production",
			expected:     true,
		},
		{
			name:         "no match",
			namespaceUID: "dev-folder",
			filter:       "production",
			expected:     false,
		},
		{
			name:         "empty namespace",
			namespaceUID: "",
			filter:       "production",
			expected:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				NamespaceUID: tt.namespaceUID,
			}
			result := matchesNamespace(rule, tt.filter)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMatchesLabels tests the label matcher filtering
func TestMatchesLabels(t *testing.T) {
	tests := []struct {
		name     string
		labels   map[string]string
		matchers []string
		expected bool
	}{
		{
			name:     "exact match single label",
			labels:   map[string]string{"severity": "critical"},
			matchers: []string{"severity=critical"},
			expected: true,
		},
		{
			name:     "exact match multiple labels",
			labels:   map[string]string{"severity": "critical", "team": "backend"},
			matchers: []string{"severity=critical", "team=backend"},
			expected: true,
		},
		{
			name:     "not equal match - label exists with different value",
			labels:   map[string]string{"severity": "warning"},
			matchers: []string{"severity!=critical"},
			expected: true,
		},
		{
			name:     "not equal match - label doesn't exist",
			labels:   map[string]string{"team": "backend"},
			matchers: []string{"severity!=critical"},
			expected: true,
		},
		{
			name:     "not equal match fails - label has the value",
			labels:   map[string]string{"severity": "critical"},
			matchers: []string{"severity!=critical"},
			expected: false,
		},
		{
			name:     "regex match",
			labels:   map[string]string{"severity": "critical"},
			matchers: []string{"severity=~crit.*"},
			expected: true,
		},
		{
			name:     "regex match with pipe",
			labels:   map[string]string{"severity": "warning"},
			matchers: []string{"severity=~critical|warning|info"},
			expected: true,
		},
		{
			name:     "regex not match",
			labels:   map[string]string{"severity": "info"},
			matchers: []string{"severity!~critical|warning"},
			expected: true,
		},
		{
			name:     "regex not match fails",
			labels:   map[string]string{"severity": "critical"},
			matchers: []string{"severity!~critical|warning"},
			expected: false,
		},
		{
			name:     "no match - label missing",
			labels:   map[string]string{"team": "backend"},
			matchers: []string{"severity=critical"},
			expected: false,
		},
		{
			name:     "no match - value different",
			labels:   map[string]string{"severity": "warning"},
			matchers: []string{"severity=critical"},
			expected: false,
		},
		{
			name:     "multiple matchers - all must match",
			labels:   map[string]string{"severity": "critical", "team": "backend"},
			matchers: []string{"severity=critical", "team=frontend"},
			expected: false,
		},
		{
			name:     "nil labels map",
			labels:   nil,
			matchers: []string{"severity=critical"},
			expected: false,
		},
		{
			name:     "empty labels map",
			labels:   map[string]string{},
			matchers: []string{"severity=critical"},
			expected: false,
		},
		{
			name:     "complex regex with anchors",
			labels:   map[string]string{"environment": "production"},
			matchers: []string{"environment=~^prod.*"},
			expected: true,
		},
		{
			name:     "complex regex no match",
			labels:   map[string]string{"environment": "staging"},
			matchers: []string{"environment=~^prod.*"},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				Labels: tt.labels,
			}
			result := matchesLabels(rule, tt.matchers)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestParseLabelMatcher tests the label matcher parsing
func TestParseLabelMatcher(t *testing.T) {
	tests := []struct {
		name          string
		matcherStr    string
		expectedKey   string
		expectedValue string
		expectedEqual bool
		expectedRegex bool
		shouldCompile bool
	}{
		{
			name:          "exact match",
			matcherStr:    "severity=critical",
			expectedKey:   "severity",
			expectedValue: "critical",
			expectedEqual: true,
			expectedRegex: false,
		},
		{
			name:          "exact match with spaces",
			matcherStr:    "  severity = critical  ",
			expectedKey:   "severity",
			expectedValue: "critical",
			expectedEqual: true,
			expectedRegex: false,
		},
		{
			name:          "not equal",
			matcherStr:    "severity!=critical",
			expectedKey:   "severity",
			expectedValue: "critical",
			expectedEqual: false,
			expectedRegex: false,
		},
		{
			name:          "regex match",
			matcherStr:    "severity=~crit.*",
			expectedKey:   "severity",
			expectedValue: "crit.*",
			expectedEqual: true,
			expectedRegex: true,
			shouldCompile: true,
		},
		{
			name:          "regex not match",
			matcherStr:    "severity!~crit.*",
			expectedKey:   "severity",
			expectedValue: "crit.*",
			expectedEqual: false,
			expectedRegex: true,
			shouldCompile: true,
		},
		{
			name:          "key only - treated as existence check",
			matcherStr:    "severity",
			expectedKey:   "severity",
			expectedValue: "",
			expectedEqual: true,
			expectedRegex: true,
			shouldCompile: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher, err := parseLabelMatcher(tt.matcherStr)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedKey, matcher.key)
			assert.Equal(t, tt.expectedValue, matcher.value)
			assert.Equal(t, tt.expectedEqual, matcher.isEqual)
			assert.Equal(t, tt.expectedRegex, matcher.isRegex)
			if tt.shouldCompile {
				assert.NotNil(t, matcher.compiled)
			}
		})
	}
}

// TestMatchesDashboardUID tests the dashboard UID filtering
func TestMatchesDashboardUID(t *testing.T) {
	tests := []struct {
		name         string
		annotations  map[string]string
		dashboardUID string
		expected     bool
	}{
		{
			name: "dashboard annotation matches",
			annotations: map[string]string{
				ngmodels.DashboardUIDAnnotation: "dashboard-123",
			},
			dashboardUID: "dashboard-123",
			expected:     true,
		},
		{
			name: "dashboard annotation doesn't match",
			annotations: map[string]string{
				ngmodels.DashboardUIDAnnotation: "dashboard-123",
			},
			dashboardUID: "dashboard-456",
			expected:     false,
		},
		{
			name:         "no annotations",
			annotations:  nil,
			dashboardUID: "dashboard-123",
			expected:     false,
		},
		{
			name: "empty dashboard annotation",
			annotations: map[string]string{
				"other": "value",
			},
			dashboardUID: "dashboard-123",
			expected:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				Annotations: tt.annotations,
			}
			result := matchesDashboardUID(rule, tt.dashboardUID)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMatchesContactPoint tests the contact point (receiver) filtering
func TestMatchesContactPoint(t *testing.T) {
	tests := []struct {
		name                 string
		notificationSettings []ngmodels.NotificationSettings
		contactPoint         string
		expected             bool
	}{
		{
			name: "single receiver matches",
			notificationSettings: []ngmodels.NotificationSettings{
				{Receiver: "pagerduty"},
			},
			contactPoint: "pagerduty",
			expected:     true,
		},
		{
			name: "multiple receivers - first matches",
			notificationSettings: []ngmodels.NotificationSettings{
				{Receiver: "pagerduty"},
				{Receiver: "slack"},
			},
			contactPoint: "pagerduty",
			expected:     true,
		},
		{
			name: "multiple receivers - second matches",
			notificationSettings: []ngmodels.NotificationSettings{
				{Receiver: "pagerduty"},
				{Receiver: "slack"},
			},
			contactPoint: "slack",
			expected:     true,
		},
		{
			name: "no match",
			notificationSettings: []ngmodels.NotificationSettings{
				{Receiver: "pagerduty"},
			},
			contactPoint: "slack",
			expected:     false,
		},
		{
			name:                 "empty notification settings",
			notificationSettings: []ngmodels.NotificationSettings{},
			contactPoint:         "pagerduty",
			expected:             false,
		},
		{
			name:                 "nil notification settings",
			notificationSettings: nil,
			contactPoint:         "pagerduty",
			expected:             false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				NotificationSettings: tt.notificationSettings,
			}
			result := matchesContactPoint(rule, tt.contactPoint)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestIsPluginProvided tests the plugin rule detection
func TestIsPluginProvided(t *testing.T) {
	tests := []struct {
		name     string
		labels   map[string]string
		expected bool
	}{
		{
			name: "plugin rule with origin label",
			labels: map[string]string{
				GrafanaOriginLabel: "plugin-id",
			},
			expected: true,
		},
		{
			name: "plugin rule with origin label and other labels",
			labels: map[string]string{
				GrafanaOriginLabel: "plugin-id",
				"severity":         "critical",
			},
			expected: true,
		},
		{
			name: "non-plugin rule",
			labels: map[string]string{
				"severity": "critical",
			},
			expected: false,
		},
		{
			name:     "no labels",
			labels:   nil,
			expected: false,
		},
		{
			name:     "empty labels map",
			labels:   map[string]string{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				Labels: tt.labels,
			}
			result := isPluginProvided(rule)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMatchesDatasources tests the datasource UID filtering
func TestMatchesDatasources(t *testing.T) {
	tests := []struct {
		name           string
		queries        []ngmodels.AlertQuery
		datasourceUIDs []string
		expected       bool
		description    string
	}{
		{
			name: "single query matches",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
			},
			datasourceUIDs: []string{"prometheus-uid"},
			expected:       true,
			description:    "Rule with one query matching the filter",
		},
		{
			name: "multiple queries - first matches",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
				{DatasourceUID: "loki-uid"},
			},
			datasourceUIDs: []string{"prometheus-uid"},
			expected:       true,
			description:    "Rule with multiple queries, first one matches",
		},
		{
			name: "multiple queries - second matches",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
				{DatasourceUID: "loki-uid"},
			},
			datasourceUIDs: []string{"loki-uid"},
			expected:       true,
			description:    "Rule with multiple queries, second one matches",
		},
		{
			name: "multiple datasource filters - any matches",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
			},
			datasourceUIDs: []string{"graphite-uid", "prometheus-uid", "loki-uid"},
			expected:       true,
			description:    "Rule matches if any of the datasource filters match",
		},
		{
			name: "no match",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
			},
			datasourceUIDs: []string{"loki-uid"},
			expected:       false,
			description:    "Rule query doesn't match any filter",
		},
		{
			name: "expression datasource ignored (-100)",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "-100"},
			},
			datasourceUIDs: []string{"-100"},
			expected:       false,
			description:    "Expression datasources should be ignored",
		},
		{
			name: "expression datasource ignored (__expr__)",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "__expr__"},
			},
			datasourceUIDs: []string{"__expr__"},
			expected:       false,
			description:    "Expression datasources with __expr__ UID should be ignored",
		},
		{
			name: "mix of expression and real datasource - real matches",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "__expr__"},
				{DatasourceUID: "prometheus-uid"},
			},
			datasourceUIDs: []string{"prometheus-uid"},
			expected:       true,
			description:    "Rule with expression and real datasource, real one matches",
		},
		{
			name: "mix of expression and real datasource - no real match",
			queries: []ngmodels.AlertQuery{
				{DatasourceUID: "__expr__"},
				{DatasourceUID: "prometheus-uid"},
			},
			datasourceUIDs: []string{"loki-uid"},
			expected:       false,
			description:    "Rule with expression and real datasource, real one doesn't match",
		},
		{
			name:           "empty queries",
			queries:        []ngmodels.AlertQuery{},
			datasourceUIDs: []string{"prometheus-uid"},
			expected:       false,
			description:    "Rule with no queries doesn't match",
		},
		{
			name:           "nil queries",
			queries:        nil,
			datasourceUIDs: []string{"prometheus-uid"},
			expected:       false,
			description:    "Rule with nil queries doesn't match",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := &ngmodels.AlertRule{
				Data: tt.queries,
			}
			result := matchesDatasources(rule, tt.datasourceUIDs)
			assert.Equal(t, tt.expected, result, tt.description)
		})
	}
}

// TestMatchesAllFilters tests the composite filtering logic
func TestMatchesAllFilters(t *testing.T) {
	// Helper to create a pointer to int64
	int64Ptr := func(i int64) *int64 { return &i }

	tests := []struct {
		name     string
		rule     *ngmodels.AlertRule
		query    *ngmodels.ListAlertRulesExtendedQuery
		expected bool
	}{
		{
			name: "alerting rule type filter - matches",
			rule: &ngmodels.AlertRule{
				Title:  "CPU Alert",
				Record: nil, // alerting rule (no record)
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterAlerting,
			},
			expected: true,
		},
		{
			name: "alerting rule type filter - doesn't match recording",
			rule: &ngmodels.AlertRule{
				Title: "CPU Alert",
				Record: &ngmodels.Record{
					Metric: "cpu_usage",
				},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterAlerting,
			},
			expected: false,
		},
		{
			name: "recording rule type filter - matches",
			rule: &ngmodels.AlertRule{
				Title: "CPU Recording",
				Record: &ngmodels.Record{
					Metric: "cpu_usage",
				},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterRecording,
			},
			expected: true,
		},
		{
			name: "recording rule type filter - doesn't match alerting",
			rule: &ngmodels.AlertRule{
				Title:  "CPU Alert",
				Record: nil,
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterRecording,
			},
			expected: false,
		},
		{
			name: "namespace UIDs filter - matches",
			rule: &ngmodels.AlertRule{
				Title:        "CPU Alert",
				NamespaceUID: "folder-1",
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-1", "folder-2"},
				},
			},
			expected: true,
		},
		{
			name: "namespace UIDs filter - doesn't match",
			rule: &ngmodels.AlertRule{
				Title:        "CPU Alert",
				NamespaceUID: "folder-3",
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-1", "folder-2"},
				},
			},
			expected: false,
		},
		{
			name: "rule groups filter - matches",
			rule: &ngmodels.AlertRule{
				Title:     "CPU Alert",
				RuleGroup: "Production",
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					RuleGroups: []string{"Production", "Staging"},
				},
			},
			expected: true,
		},
		{
			name: "rule groups filter - doesn't match",
			rule: &ngmodels.AlertRule{
				Title:     "CPU Alert",
				RuleGroup: "Development",
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					RuleGroups: []string{"Production", "Staging"},
				},
			},
			expected: false,
		},
		{
			name: "rule name substring filter - matches",
			rule: &ngmodels.AlertRule{
				Title: "High CPU Alert",
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "cpu",
			},
			expected: true,
		},
		{
			name: "rule name substring filter - doesn't match",
			rule: &ngmodels.AlertRule{
				Title: "Memory Alert",
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "cpu",
			},
			expected: false,
		},
		{
			name: "dashboard and panel filter - both match",
			rule: &ngmodels.AlertRule{
				Title: "Dashboard Alert",
				Annotations: map[string]string{
					ngmodels.DashboardUIDAnnotation: "dashboard-123",
				},
				PanelID: int64Ptr(5),
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					DashboardUID: "dashboard-123",
					PanelID:      5,
				},
			},
			expected: true,
		},
		{
			name: "dashboard matches but panel doesn't",
			rule: &ngmodels.AlertRule{
				Title: "Dashboard Alert",
				Annotations: map[string]string{
					ngmodels.DashboardUIDAnnotation: "dashboard-123",
				},
				PanelID: int64Ptr(3),
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					DashboardUID: "dashboard-123",
					PanelID:      5,
				},
			},
			expected: false,
		},
		{
			name: "hide plugin rules - plugin rule filtered out",
			rule: &ngmodels.AlertRule{
				Title: "Plugin Alert",
				Labels: map[string]string{
					GrafanaOriginLabel: "some-plugin",
				},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				HidePluginRules: true,
			},
			expected: false,
		},
		{
			name: "hide plugin rules - non-plugin rule passes",
			rule: &ngmodels.AlertRule{
				Title: "Regular Alert",
				Labels: map[string]string{
					"severity": "critical",
				},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				HidePluginRules: true,
			},
			expected: true,
		},
		{
			name: "multiple filters - all match",
			rule: &ngmodels.AlertRule{
				Title:        "High CPU Alert",
				RuleGroup:    "Production",
				NamespaceUID: "folder-1",
				Labels: map[string]string{
					"severity": "critical",
					"team":     "backend",
				},
				Data: []ngmodels.AlertQuery{
					{DatasourceUID: "prometheus-uid"},
				},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-1"},
				},
				RuleType:       ngmodels.RuleTypeFilterAlerting,
				GroupName:      "prod",
				RuleName:       "cpu",
				Labels:         []string{"severity=critical", "team=backend"},
				DatasourceUIDs: []string{"prometheus-uid"},
			},
			expected: true,
		},
		{
			name: "multiple filters - one doesn't match",
			rule: &ngmodels.AlertRule{
				Title:        "High CPU Alert",
				RuleGroup:    "Production",
				NamespaceUID: "folder-1",
				Labels: map[string]string{
					"severity": "warning", // doesn't match critical
					"team":     "backend",
				},
				Data: []ngmodels.AlertQuery{
					{DatasourceUID: "prometheus-uid"},
				},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-1"},
				},
				RuleType:       ngmodels.RuleTypeFilterAlerting,
				GroupName:      "prod",
				RuleName:       "cpu",
				Labels:         []string{"severity=critical", "team=backend"},
				DatasourceUIDs: []string{"prometheus-uid"},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := matchesAllFilters(tt.rule, tt.query)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestApplyInMemoryFilters tests the full filtering pipeline
func TestApplyInMemoryFilters(t *testing.T) {
	// Helper to create a pointer to int64
	int64Ptr := func(i int64) *int64 { return &i }

	// Create a set of test rules
	rules := []*ngmodels.AlertRule{
		{
			ID:           1,
			Title:        "High CPU Alert",
			RuleGroup:    "Production",
			NamespaceUID: "folder-prod",
			Labels: map[string]string{
				"severity": "critical",
				"team":     "backend",
			},
			Data: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
			},
		},
		{
			ID:           2,
			Title:        "Low Memory Alert",
			RuleGroup:    "Production",
			NamespaceUID: "folder-prod",
			Labels: map[string]string{
				"severity": "warning",
				"team":     "backend",
			},
			Data: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
			},
		},
		{
			ID:           3,
			Title:        "Database Connection Alert",
			RuleGroup:    "Staging",
			NamespaceUID: "folder-staging",
			Labels: map[string]string{
				"severity": "critical",
				"team":     "database",
			},
			Data: []ngmodels.AlertQuery{
				{DatasourceUID: "postgres-uid"},
			},
		},
		{
			ID:           4,
			Title:        "CPU Recording Rule",
			RuleGroup:    "Recording",
			NamespaceUID: "folder-metrics",
			Record: &ngmodels.Record{
				Metric: "cpu:usage:rate5m",
			},
			Labels: map[string]string{
				"source": "prometheus",
			},
			Data: []ngmodels.AlertQuery{
				{DatasourceUID: "prometheus-uid"},
			},
		},
		{
			ID:           5,
			Title:        "Plugin Alert",
			RuleGroup:    "PluginRules",
			NamespaceUID: "folder-plugins",
			Labels: map[string]string{
				GrafanaOriginLabel: "some-plugin",
				"severity":         "info",
			},
			Data: []ngmodels.AlertQuery{
				{DatasourceUID: "plugin-datasource-uid"},
			},
		},
		{
			ID:           6,
			Title:        "Dashboard Panel Alert",
			RuleGroup:    "Dashboards",
			NamespaceUID: "folder-dashboards",
			Annotations: map[string]string{
				ngmodels.DashboardUIDAnnotation: "dashboard-123",
			},
			PanelID: int64Ptr(5),
			NotificationSettings: []ngmodels.NotificationSettings{
				{Receiver: "pagerduty"},
			},
		},
	}

	tests := []struct {
		name        string
		query       *ngmodels.ListAlertRulesExtendedQuery
		expectedIDs []int64
		description string
	}{
		{
			name:        "no filters - return all",
			query:       &ngmodels.ListAlertRulesExtendedQuery{},
			expectedIDs: []int64{1, 2, 3, 4, 5, 6},
			description: "With no filters, all rules should be returned",
		},
		{
			name: "filter by rule type - alerting only",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterAlerting,
			},
			expectedIDs: []int64{1, 2, 3, 5, 6},
			description: "Should return only alerting rules (non-recording)",
		},
		{
			name: "filter by rule type - recording only",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterRecording,
			},
			expectedIDs: []int64{4},
			description: "Should return only recording rules",
		},
		{
			name: "filter by namespace UID",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-prod"},
				},
			},
			expectedIDs: []int64{1, 2},
			description: "Should return only rules in the production folder",
		},
		{
			name: "filter by multiple namespace UIDs",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-prod", "folder-staging"},
				},
			},
			expectedIDs: []int64{1, 2, 3},
			description: "Should return rules from both folders",
		},
		{
			name: "filter by rule group name - substring",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				GroupName: "prod",
			},
			expectedIDs: []int64{1, 2},
			description: "Should match 'Production' group with substring 'prod'",
		},
		{
			name: "filter by rule name - substring",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "cpu",
			},
			expectedIDs: []int64{1, 4},
			description: "Should match rules with 'cpu' in the title",
		},
		{
			name: "filter by label - exact match",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=critical"},
			},
			expectedIDs: []int64{1, 3},
			description: "Should match rules with severity=critical label",
		},
		{
			name: "filter by label - multiple labels (AND)",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=critical", "team=backend"},
			},
			expectedIDs: []int64{1},
			description: "Should match rules with both labels",
		},
		{
			name: "filter by label - regex",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=~critical|warning"},
			},
			expectedIDs: []int64{1, 2, 3},
			description: "Should match rules with severity critical or warning",
		},
		{
			name: "filter by label - not equal",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity!=info"},
			},
			expectedIDs: []int64{1, 2, 3, 4},
			description: "Should match rules where severity is not info (or not set) - rule 6 has no severity label but also has no labels at all",
		},
		{
			name: "filter by datasource UID",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				DatasourceUIDs: []string{"prometheus-uid"},
			},
			expectedIDs: []int64{1, 2, 4},
			description: "Should match rules using prometheus datasource",
		},
		{
			name: "filter by multiple datasource UIDs",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				DatasourceUIDs: []string{"prometheus-uid", "postgres-uid"},
			},
			expectedIDs: []int64{1, 2, 3, 4},
			description: "Should match rules using either datasource",
		},
		{
			name: "hide plugin rules",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				HidePluginRules: true,
			},
			expectedIDs: []int64{1, 2, 3, 4, 6},
			description: "Should exclude rules with __grafana_origin label",
		},
		{
			name: "filter by dashboard UID",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					DashboardUID: "dashboard-123",
				},
			},
			expectedIDs: []int64{6},
			description: "Should match rules associated with dashboard",
		},
		{
			name: "filter by dashboard UID and panel ID",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					DashboardUID: "dashboard-123",
					PanelID:      5,
				},
			},
			expectedIDs: []int64{6},
			description: "Should match rules associated with specific dashboard panel",
		},
		{
			name: "filter by dashboard UID and wrong panel ID",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					DashboardUID: "dashboard-123",
					PanelID:      99,
				},
			},
			expectedIDs: []int64{},
			description: "Should not match when panel ID doesn't match",
		},
		{
			name: "filter by contact point",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ContactPointName: "pagerduty",
			},
			expectedIDs: []int64{6},
			description: "Should match rules using pagerduty contact point",
		},
		{
			name: "complex filter - multiple conditions",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-prod"},
				},
				RuleType:       ngmodels.RuleTypeFilterAlerting,
				Labels:         []string{"team=backend"},
				DatasourceUIDs: []string{"prometheus-uid"},
			},
			expectedIDs: []int64{1, 2},
			description: "Should match rules that satisfy all conditions",
		},
		{
			name: "complex filter - no matches",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-prod"},
				},
				Labels: []string{"team=database"}, // No prod rules have team=database
			},
			expectedIDs: []int64{},
			description: "Should return no rules when filters don't match",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := applyInMemoryFilters(rules, tt.query)

			actualIDs := make([]int64, len(result))
			for i, rule := range result {
				actualIDs[i] = rule.ID
			}

			assert.ElementsMatch(t, tt.expectedIDs, actualIDs, tt.description)
		})
	}
}

// TestContainsCaseInsensitive tests the case-insensitive string matching utility
func TestContainsCaseInsensitive(t *testing.T) {
	tests := []struct {
		name     string
		haystack string
		needle   string
		expected bool
	}{
		{
			name:     "exact match",
			haystack: "Production",
			needle:   "Production",
			expected: true,
		},
		{
			name:     "case insensitive match",
			haystack: "Production",
			needle:   "production",
			expected: true,
		},
		{
			name:     "substring match",
			haystack: "Production Alerts",
			needle:   "prod",
			expected: true,
		},
		{
			name:     "no match",
			haystack: "Production",
			needle:   "staging",
			expected: false,
		},
		{
			name:     "empty needle",
			haystack: "Production",
			needle:   "",
			expected: true,
		},
		{
			name:     "empty haystack",
			haystack: "",
			needle:   "prod",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsCaseInsensitive(tt.haystack, tt.needle)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestHasAnyFilters tests the filter detection logic
func TestHasAnyFilters(t *testing.T) {
	tests := []struct {
		name     string
		query    *ngmodels.ListAlertRulesExtendedQuery
		expected bool
	}{
		{
			name:     "no filters",
			query:    &ngmodels.ListAlertRulesExtendedQuery{},
			expected: false,
		},
		{
			name: "rule type filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterAlerting,
			},
			expected: true,
		},
		{
			name: "namespace UIDs filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-1"},
				},
			},
			expected: true,
		},
		{
			name: "rule groups filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					RuleGroups: []string{"Production"},
				},
			},
			expected: true,
		},
		{
			name: "namespace name filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Namespace: "production",
			},
			expected: true,
		},
		{
			name: "group name filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				GroupName: "alerts",
			},
			expected: true,
		},
		{
			name: "rule name filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "cpu",
			},
			expected: true,
		},
		{
			name: "labels filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=critical"},
			},
			expected: true,
		},
		{
			name: "dashboard UID filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					DashboardUID: "dashboard-123",
				},
			},
			expected: true,
		},
		{
			name: "panel ID filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					PanelID: 5,
				},
			},
			expected: true,
		},
		{
			name: "receiver name filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					ReceiverName: "pagerduty",
				},
			},
			expected: true,
		},
		{
			name: "contact point name filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ContactPointName: "slack",
			},
			expected: true,
		},
		{
			name: "hide plugin rules",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				HidePluginRules: true,
			},
			expected: true,
		},
		{
			name: "datasource UIDs filter",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				DatasourceUIDs: []string{"prometheus-uid"},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := hasAnyFilters(tt.query)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestFilteringWithPagination tests that filters work correctly with pagination
func TestFilteringWithPagination(t *testing.T) {
	// Create a larger set of test rules to test pagination
	rules := make([]*ngmodels.AlertRule, 50)
	for i := 0; i < 50; i++ {
		folderIdx := (i % 3) + 1
		severityIdx := i % 3
		rules[i] = &ngmodels.AlertRule{
			ID:           int64(i + 1),
			Title:        fmt.Sprintf("Alert %d", i+1),
			RuleGroup:    fmt.Sprintf("Group %d", (i%5)+1),
			NamespaceUID: fmt.Sprintf("folder-%d", folderIdx),
			Labels: map[string]string{
				"severity": []string{"critical", "warning", "info"}[severityIdx],
				"team":     []string{"backend", "frontend", "platform"}[severityIdx],
			},
		}
	}

	tests := []struct {
		name          string
		query         *ngmodels.ListAlertRulesExtendedQuery
		expectedCount int
		description   string
		checkFirstID  int64
		checkLastID   int64
	}{
		{
			name: "filter by label - results should be filtered before considering count",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=critical"},
			},
			expectedCount: 17, // 50/3 = ~17 rules with critical severity
			description:   "Should return all rules matching the label filter",
			checkFirstID:  1, // First rule has severity=critical
		},
		{
			name: "filter by group - multiple groups match",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				GroupName: "Group 1",
			},
			expectedCount: 10, // 50/5 = 10 rules per group
			description:   "Should return all rules in Group 1",
		},
		{
			name: "filter by namespace - multiple namespaces match",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
					NamespaceUIDs: []string{"folder-1", "folder-2"},
				},
			},
			expectedCount: 34, // ~2/3 of rules in folder-1 and folder-2
			description:   "Should return all rules in specified folders",
		},
		{
			name: "combined filters - narrow down results",
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleType: ngmodels.RuleTypeFilterAlerting,
				Labels:   []string{"severity=critical"},
			},
			expectedCount: 17, // All alerting rules (50) with critical severity = 17
			description:   "Should apply both rule type and label filters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := applyInMemoryFilters(rules, tt.query)
			assert.Equal(t, tt.expectedCount, len(result), tt.description)

			if tt.checkFirstID > 0 && len(result) > 0 {
				assert.Equal(t, tt.checkFirstID, result[0].ID, "First rule ID should match")
			}
			if tt.checkLastID > 0 && len(result) > 0 {
				assert.Equal(t, tt.checkLastID, result[len(result)-1].ID, "Last rule ID should match")
			}
		})
	}
}

// TestFilteringEdgeCases tests edge cases in filtering logic
func TestFilteringEdgeCases(t *testing.T) {
	tests := []struct {
		name        string
		rules       []*ngmodels.AlertRule
		query       *ngmodels.ListAlertRulesExtendedQuery
		expectedIDs []int64
		description string
	}{
		{
			name:  "empty rules list",
			rules: []*ngmodels.AlertRule{},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "test",
			},
			expectedIDs: []int64{},
			description: "Should return empty list when no rules provided",
		},
		{
			name:  "nil rules list",
			rules: nil,
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "test",
			},
			expectedIDs: []int64{},
			description: "Should handle nil rules gracefully",
		},
		{
			name: "rule with nil labels - label filter present",
			rules: []*ngmodels.AlertRule{
				{ID: 1, Title: "Rule 1", Labels: nil},
				{ID: 2, Title: "Rule 2", Labels: map[string]string{"severity": "critical"}},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=critical"},
			},
			expectedIDs: []int64{2},
			description: "Should filter out rules with nil labels when label filter is present",
		},
		{
			name: "rule with empty labels map - label filter present",
			rules: []*ngmodels.AlertRule{
				{ID: 1, Title: "Rule 1", Labels: map[string]string{}},
				{ID: 2, Title: "Rule 2", Labels: map[string]string{"severity": "critical"}},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"severity=critical"},
			},
			expectedIDs: []int64{2},
			description: "Should filter out rules with empty labels when label filter is present",
		},
		{
			name: "rule with empty namespace",
			rules: []*ngmodels.AlertRule{
				{ID: 1, Title: "Rule 1", NamespaceUID: ""},
				{ID: 2, Title: "Rule 2", NamespaceUID: "folder-1"},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Namespace: "folder",
			},
			expectedIDs: []int64{2},
			description: "Should filter out rules with empty namespace",
		},
		{
			name: "rule with empty group name",
			rules: []*ngmodels.AlertRule{
				{ID: 1, Title: "Rule 1", RuleGroup: ""},
				{ID: 2, Title: "Rule 2", RuleGroup: "Production"},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				GroupName: "prod",
			},
			expectedIDs: []int64{2},
			description: "Should filter out rules with empty group name",
		},
		{
			name: "rule with empty title",
			rules: []*ngmodels.AlertRule{
				{ID: 1, Title: ""},
				{ID: 2, Title: "CPU Alert"},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				RuleName: "cpu",
			},
			expectedIDs: []int64{2},
			description: "Should filter out rules with empty title",
		},
		{
			name: "invalid label matcher - should be skipped",
			rules: []*ngmodels.AlertRule{
				{ID: 1, Title: "Rule 1", Labels: map[string]string{"severity": "critical"}},
			},
			query: &ngmodels.ListAlertRulesExtendedQuery{
				Labels: []string{"invalid-matcher-no-operator"},
			},
			expectedIDs: []int64{1},
			description: "Invalid matchers should be treated as existence checks and match any rule with labels",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := applyInMemoryFilters(tt.rules, tt.query)

			actualIDs := make([]int64, len(result))
			for i, rule := range result {
				actualIDs[i] = rule.ID
			}

			assert.ElementsMatch(t, tt.expectedIDs, actualIDs, tt.description)
		})
	}
}
