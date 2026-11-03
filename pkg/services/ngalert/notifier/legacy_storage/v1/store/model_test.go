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
			name:          "root route with object matchers",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "object_matchers": [["a", "=", "b"]]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "root route must not have any matchers",
		},
		{
			name:          "root route with active time intervals",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "active_time_intervals": ["t"]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "root route must not have any active time intervals",
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
		{
			name:          "invalid match_re label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "match_re": {"1bad": "x.*"}}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: `invalid label name "1bad"`,
		},
		{
			name:          "null match_re value",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "match_re": {"a": null}}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: `invalid regexp value for "a"`,
		},
		{
			name:          "duplicate group_by label in nested route",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "routes": [{"receiver": "empty", "group_by": ["a", "a"]}]}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: `duplicated label "a" in group_by`,
		},
		{
			name:          "wildcard and other labels in group_by in nested route",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "group_by": ["...", "a"]}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "cannot have wildcard group_by",
		},
		{
			name:          "zero group_interval in nested route",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "group_interval": "0s"}]}, "receivers": [{"name": "empty"}]}}`,
			wantErrSubstr: "group_interval cannot be zero",
		},
		{
			name:          "zero repeat_interval in nested route",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty", "routes": [{"receiver": "empty", "repeat_interval": "0s"}]}, "receivers": [{"name": "empty"}]}}`,
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
			name:          "invalid inhibit rule source_match_re label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "inhibit_rules": [{"source_match_re": {"1bad": "x.*"}}]}}`,
			wantErrSubstr: `invalid label name "1bad"`,
		},
		{
			name:          "invalid inhibit rule target_match_re label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}], "inhibit_rules": [{"target_match_re": {"1bad": "x.*"}}]}}`,
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

		// --- managed_routes - validated by AMConfigDB.UnmarshalJSON. A managed route is the root
		// of its own routing tree, so it needs a receiver and its routes get the usual checks.
		// It has no matchers or time intervals to validate.
		{
			name:          "managed route missing receiver",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {}}}`,
			wantErrSubstr: "root route must specify a default receiver",
		},

		{
			name:          "managed route with duplicate group_by label",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "group_by": ["a", "a"]}}}`,
			wantErrSubstr: `duplicated label "a" in group_by`,
		},
		{
			name:          "managed route with invalid match_re label name",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "routes": [{"receiver": "empty", "match_re": {"1bad": "x.*"}}]}}}`,
			wantErrSubstr: `invalid label name "1bad"`,
		},
		{
			name:          "managed route with wildcard and other labels in group_by",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "group_by": ["...", "a"]}}}`,
			wantErrSubstr: "cannot have wildcard group_by",
		},
		{
			name:          "managed route with zero group_interval",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "group_interval": "0s"}}}`,
			wantErrSubstr: "group_interval cannot be zero",
		},
		{
			name:          "managed route with zero repeat_interval",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "repeat_interval": "0s"}}}`,
			wantErrSubstr: "repeat_interval cannot be zero",
		},
		{
			name:          "managed route with invalid nested route",
			configJSON:    `{"alertmanager_config": {"route": {"receiver": "empty"}, "receivers": [{"name": "empty"}]}, "managed_routes": {"route1": {"receiver": "empty", "routes": [{"receiver": "empty", "group_by": ["a", "a"]}]}}}`,
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
				{"uid": "weekends-uid", "name": "weekends", "time_intervals": [{"weekdays": ["saturday", "sunday"]}]}
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
	assert.Equal(t, []string{"alertname"}, child.GroupByStr)
	assert.Equal(t, []string{"..."}, route.GroupByStr)

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
	assert.Equal(t, "weekends-uid", c.AlertmanagerConfig.TimeIntervals[0].UID)

	// AMConfigDB's own fields.
	require.Len(t, c.ExtraConfigs, 1)
	assert.Equal(t, "a", c.ExtraConfigs[0].Identifier)
	assert.Equal(t, map[string]string{"mimir.tmpl": "mimir content"}, c.ExtraConfigs[0].TemplateFiles)

	require.Contains(t, c.ManagedRoutes, "route1")
	managedRoute := c.ManagedRoutes["route1"]
	require.NotNil(t, managedRoute)
	assert.Equal(t, []string{"alertname"}, managedRoute.GroupByStr)

	require.Contains(t, c.ManagedInhibitionRules, "rule1")
	rule := c.ManagedInhibitionRules["rule1"]
	require.NotNil(t, rule)
	require.Len(t, rule.TargetMatchers, 1)
	assert.Equal(t, `cluster="prod"`, rule.TargetMatchers[0].String())
	require.Len(t, rule.SourceMatchers, 1)
	assert.Equal(t, `cluster="prod"`, rule.SourceMatchers[0].String())
	assert.Equal(t, []string{"alertname"}, rule.Equal)
}

// TestReceiverDB_UnmarshalJSON_NormalizesSettings locks in that integration settings are
// re-marshalled with sorted keys and no insignificant whitespace, which keeps calculated
// fingerprints and remote Alertmanager config hashes stable.
func TestReceiverDB_UnmarshalJSON_NormalizesSettings(t *testing.T) {
	var r ReceiverDB
	require.NoError(t, json.Unmarshal([]byte(`{
		"name": "r",
		"grafana_managed_receiver_configs": [
			{"uid": "u", "name": "r", "type": "email", "settings": {"b": 1,   "a": {"z": true, "y": "x"}}}
		]
	}`), &r))

	require.Len(t, r.GrafanaManagedReceivers, 1)
	assert.Equal(t, `{"a":{"y":"x","z":true},"b":1}`, string(r.GrafanaManagedReceivers[0].Settings))
}

func TestAllReceivers(t *testing.T) {
	t.Run("collects receivers recursively and skips empty", func(t *testing.T) {
		route := &RouteDB{Receiver: "a", Routes: []*RouteDB{
			{Receiver: "b", Routes: []*RouteDB{{Receiver: "c"}}},
			{},
		}}
		assert.Equal(t, []string{"a", "b", "c"}, allReceivers(route))
	})
	t.Run("nil route", func(t *testing.T) {
		assert.Empty(t, allReceivers(nil))
	})
}

// TestManagedRouteDB_IgnoresRootOnlyFields locks in that a managed route only holds the fields a
// root route can carry: anything else in a stored blob is dropped on decode.
func TestManagedRouteDB_IgnoresRootOnlyFields(t *testing.T) {
	var c AMConfigDB
	require.NoError(t, json.Unmarshal([]byte(`{
		"alertmanager_config": {"route": {"receiver": "a"}, "receivers": [{"name": "a"}]},
		"managed_routes": {"r": {
			"receiver": "a",
			"group_by": ["x"],
			"matchers": ["a=\"b\""],
			"mute_time_intervals": ["t"],
			"continue": true,
			"routes": [{"receiver": "a", "matchers": ["c=d"], "continue": true}]
		}}
	}`), &c))

	got, err := json.Marshal(c.ManagedRoutes["r"])
	require.NoError(t, err)
	assert.JSONEq(t, `{"receiver": "a", "group_by": ["x"], "routes": [{"receiver": "a", "matchers": ["c=\"d\""], "continue": true}]}`, string(got))
}
