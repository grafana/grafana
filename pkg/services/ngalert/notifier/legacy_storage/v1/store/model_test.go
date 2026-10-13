package store

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAMConfigDB_UnmarshalJSON_Validation locks in that AMConfigDB.UnmarshalJSON still runs
// every check this JSON blob used to get "for free" by decoding "alertmanager_config" through
// definition.PostableApiAlertingConfig directly.
func TestAMConfigDB_UnmarshalJSON_Validation(t *testing.T) {
	tc := []struct {
		name          string
		configJSON    string
		wantErrSubstr string
	}{
		// --- no route / root route shape ---
		{
			name:          "no alertmanager_config at all",
			configJSON:    `{}`,
			wantErrSubstr: "no route provided in config",
		},
		{
			name:          "alertmanager_config present but no route",
			configJSON:    `{"alertmanager_config": {}}`,
			wantErrSubstr: "no routes provided",
		},
		{
			name:          "root route missing receiver",
			configJSON:    `{"alertmanager_config": {"route": {}}}`,
			wantErrSubstr: "root route must specify a default receiver",
		},
		{
			name:          "root route with matchers",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "matchers": ["a=\"b\""]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "root route must not have any matchers",
		},
		{
			name:          "root route with mute time intervals",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "mute_time_intervals": ["t"]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "root route must not have any mute time intervals",
		},
		{
			name:          "continue in root route",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "continue": true}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "cannot have continue in root route",
		},

		// --- group_by ---
		{
			name:          "duplicate group_by label",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "group_by": ["a", "a"]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: `duplicated label "a" in group_by`,
		},
		{
			name:          "wildcard and other labels in group_by",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "group_by": ["a", "..."]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "cannot have wildcard group_by",
		},
		{
			name:          "zero group_interval",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "group_interval": "0s"}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "group_interval cannot be zero",
		},
		{
			name:          "zero repeat_interval",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "repeat_interval": "0s"}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "repeat_interval cannot be zero",
		},

		// --- alertmanager_config.inhibit_rules (imported/Mimir-style, unnamed) ---
		{
			name:          "invalid inhibit rule source_match label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "inhibit_rules": [{"source_match": {"1bad": "x"}}]}}`,
			wantErrSubstr: `invalid label name "1bad"`,
		},
		{
			name:          "invalid inhibit rule target_match label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "inhibit_rules": [{"target_match": {"1bad": "x"}}]}}`,
			wantErrSubstr: `invalid label name "1bad"`,
		},
		{
			name:          "invalid inhibit rule equal label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "inhibit_rules": [{"equal": [""]}]}}`,
			wantErrSubstr: `invalid label name "" in equal list`,
		},

		// --- time_intervals / mute_time_intervals names ---
		{
			name:          "missing mute time interval name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "mute_time_intervals": [{"time_intervals": []}]}}`,
			wantErrSubstr: "missing name in mute time interval",
		},
		{
			name:          "missing time interval name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "time_intervals": [{"time_intervals": []}]}}`,
			wantErrSubstr: "missing name in time interval",
		},
		{
			name:          "duplicate mute time interval name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "mute_time_intervals": [{"name": "dup", "time_intervals": []}, {"name": "dup", "time_intervals": []}]}}`,
			wantErrSubstr: `mute time interval "dup" is not unique`,
		},
		{
			name:          "duplicate time interval name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "time_intervals": [{"name": "dup", "time_intervals": []}, {"name": "dup", "time_intervals": []}]}}`,
			wantErrSubstr: `time interval "dup" is not unique`,
		},
		{
			name:          "duplicate name across mute and active time interval lists",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "mute_time_intervals": [{"name": "dup", "time_intervals": []}], "time_intervals": [{"name": "dup", "time_intervals": []}]}}`,
			wantErrSubstr: `time interval "dup" is not unique`,
		},

		// --- route references to time intervals / receivers ---
		{
			name:          "unknown mute time interval reference",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "mute_time_intervals": ["missing"]}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: `undefined mute time interval "missing" used in route`,
		},
		{
			name:          "unknown active time interval reference",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "active_time_intervals": ["missing"]}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: `undefined active time interval "missing" used in route`,
		},
		{
			name:          "unknown receiver reference",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "unknown"}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "unexpected receiver (unknown) is undefined",
		},

		// --- fields AlertingConfigDB.UnmarshalJSON never sees (extra_config, managed_inhibition_rules) ---
		{
			name:          "more than one extra config",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "extra_config": [{"identifier": "a"}, {"identifier": "b"}]}`,
			wantErrSubstr: "only one extra config is supported",
		},
		{
			name:          "invalid managed inhibition rule equal label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_inhibition_rules": {"rule1": {"name": "rule1", "equal": [""]}}}`,
			wantErrSubstr: `invalid label name "" in equal list`,
		},

		// --- managed_routes (ManagedRoutesDB) - decoded via a YAML divert, since its values
		// (definition.Route) only define UnmarshalYAML, not UnmarshalJSON. Confirms a managed
		// route still goes through the same per-node ValidateChild checks a regular route does.
		{
			name:          "managed route with duplicate group_by label",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "group_by": ["a", "a"]}}}`,
			wantErrSubstr: `duplicated label "a" in group_by`,
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			c := &AMConfigDB{}
			err := json.Unmarshal([]byte(tt.configJSON), c)
			require.Error(t, err)
			assert.ErrorContains(t, err, tt.wantErrSubstr)
		})
	}
}

// TestAMConfigDB_UnmarshalJSON_Valid exercises a config touching every field on AMConfigDB and
// every check in TestAMConfigDB_UnmarshalJSON_Validation above without tripping any of them, to
// confirm the validation chain doesn't just reject everything and that every field actually
// decodes (not just the ones with their own validation).
func TestAMConfigDB_UnmarshalJSON_Valid(t *testing.T) {
	const configJSON = `{
		"template_files": {
			"legacy.tmpl": "legacy content"
		},
		"managed_templates": {
			"welcome": {"name": "welcome", "content": "hi", "kind": "grafana"}
		},
		"alertmanager_config": {
			"route": {
				"receiver": "default",
				"group_by": ["..."],
				"routes": [
					{
						"receiver": "other",
						"matchers": ["severity=\"critical\""],
						"mute_time_intervals": ["weekends"],
						"active_time_intervals": ["weekends"],
						"group_by": ["alertname"],
						"group_wait": "30s",
						"group_interval": "5m",
						"repeat_interval": "4h"
					}
				]
			},
			"receivers": [
				{
					"name": "default",
					"grafana_managed_receiver_configs": [
						{
							"uid": "u1",
							"name": "integration-1",
							"type": "email",
							"disableResolveMessage": false,
							"settings": {"addresses": "test@example.com"},
							"secureSettings": {"password": "encrypted"}
						}
					]
				},
				{"name": "other"}
			],
			"inhibit_rules": [
				{
					"source_match": {"severity": "critical"},
					"source_match_re": {"alertname": "^Node.*"},
					"source_matchers": ["cluster=\"prod\""],
					"target_match": {"severity": "warning"},
					"target_match_re": {"alertname": "^Node.*"},
					"target_matchers": ["cluster=\"prod\""],
					"equal": ["alertname"]
				}
			],
			"time_intervals": [
				{"name": "weekends", "time_intervals": [{"weekdays": ["saturday", "sunday"]}]}
			]
		},
		"extra_config": [
			{
				"identifier": "a",
				"template_files": {"mimir.tmpl": "mimir content"},
				"alertmanager_config": "route:\n  receiver: default\n",
				"managed_by": "manual"
			}
		],
		"managed_routes": {
			"route1": {"receiver": "default", "group_by": ["alertname"]}
		},
		"managed_inhibition_rules": {
			"rule1": {
				"name": "rule1",
				"source_matchers": ["cluster=\"prod\""],
				"target_matchers": ["cluster=\"prod\""],
				"equal": ["alertname"],
				"provenance": "api"
			}
		}
	}`

	c := &AMConfigDB{}
	require.NoError(t, json.Unmarshal([]byte(configJSON), c))

	// template_files / managed_templates.
	assert.Equal(t, map[string]string{"legacy.tmpl": "legacy content"}, c.TemplateFiles)
	require.Contains(t, c.ManagedTemplates, "welcome")
	assert.Equal(t, "hi", c.ManagedTemplates["welcome"].Content)

	// alertmanager_config / AlertingConfigDB.
	route := c.AlertmanagerConfig.Route
	require.NotNil(t, route)
	assert.Equal(t, "default", route.Receiver)
	require.Len(t, route.Routes, 1)

	child := route.Routes[0]
	assert.Equal(t, "other", child.Receiver)
	// GroupBy is derived from GroupByStr by Route.Validate (ValidateChild) at decode time - not
	// itself persisted (`json:"-"`) - so this also confirms that ran.
	require.Len(t, child.GroupBy, 1)
	assert.Equal(t, "alertname", string(child.GroupBy[0]))
	assert.False(t, child.GroupByAll)

	// The wildcard group_by on the root resolves to GroupByAll, not a literal "..." entry.
	assert.Empty(t, route.GroupBy)
	assert.True(t, route.GroupByAll)

	require.Len(t, c.AlertmanagerConfig.Receivers, 2)
	require.Len(t, c.AlertmanagerConfig.Receivers[0].GrafanaManagedReceivers, 1)
	assert.Equal(t, "integration-1", c.AlertmanagerConfig.Receivers[0].GrafanaManagedReceivers[0].Name)

	require.Len(t, c.AlertmanagerConfig.InhibitRules, 1)
	ir := c.AlertmanagerConfig.InhibitRules[0]
	assert.Equal(t, map[string]string{"severity": "critical"}, ir.SourceMatch)
	require.Contains(t, ir.SourceMatchRE, "alertname")
	assert.True(t, ir.SourceMatchRE["alertname"].MatchString("NodeDown"))
	require.Len(t, ir.SourceMatchers, 1)
	assert.Equal(t, `cluster="prod"`, ir.SourceMatchers[0].String())

	require.Len(t, c.AlertmanagerConfig.TimeIntervals, 1)
	assert.Equal(t, "weekends", c.AlertmanagerConfig.TimeIntervals[0].Name)

	// AMConfigDB's own fields.
	require.Len(t, c.ExtraConfigs, 1)
	assert.Equal(t, "a", c.ExtraConfigs[0].Identifier)
	assert.Equal(t, map[string]string{"mimir.tmpl": "mimir content"}, c.ExtraConfigs[0].TemplateFiles)

	require.Contains(t, c.ManagedRoutes, "route1")
	managedRoute := c.ManagedRoutes["route1"]
	require.NotNil(t, managedRoute)
	require.Len(t, managedRoute.GroupBy, 1)
	assert.Equal(t, "alertname", string(managedRoute.GroupBy[0]))

	require.Contains(t, c.ManagedInhibitionRules, "rule1")
	rule := c.ManagedInhibitionRules["rule1"]
	require.NotNil(t, rule)
	require.Len(t, rule.TargetMatchers, 1)
	assert.Equal(t, `cluster="prod"`, rule.TargetMatchers[0].String())
	require.Len(t, rule.SourceMatchers, 1)
	assert.Equal(t, `cluster="prod"`, rule.SourceMatchers[0].String())
	assert.Equal(t, []string{"alertname"}, rule.Equal)
}
