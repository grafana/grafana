package ualert

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestMigrateAlertRuleQueries(t *testing.T) {
	tc := []struct {
		name      string
		input     []alertQuery
		expected  string
		err       error
		dsMapping map[string]*dsType
		dashboard *dashboard
	}{
		{
			name: "when a query has a sub query - it is extracted",
			input: []alertQuery{
				{
					DatasourceUID: "a",
					Model: toJson(simplejson.NewFromAny(map[string]interface{}{
						"targetFull": "thisisafullquery",
						"target":     "ahalfquery",
					})),
				},
			},
			expected:  `{"target":"thisisafullquery"}`,
			dsMapping: map[string]*dsType{"a": {Type: datasources.DS_GRAPHITE}},
			dashboard: &dashboard{},
		},
		{
			name: "when a query has a sub query that is not fully unwrapped, it unwraps it",
			input: []alertQuery{
				{
					DatasourceUID: "a",
					Model: toJson(simplejson.NewFromAny(map[string]interface{}{
						"refId":      "B",
						"targetFull": "alias(xxx, #A)",
						"target":     "alias(#A, #A)",
					})),
				},
			},
			expected:  `{"refId":"B", "target": "alias(xxx, xxx)"}`,
			dsMapping: map[string]*dsType{"a": {Type: datasources.DS_GRAPHITE}},
			dashboard: &dashboard{
				Data: simplejson.MustJson([]byte(`{"panels":[{"id":0,"targets":[{"refId":"A","target":"xxx"},{"refId":"B","target":"alias(#A, #A)"}]}]}`)),
			},
		},
		{
			name: "when a query does not have a sub query - it no-ops",
			input: []alertQuery{
				{
					DatasourceUID: "a",
					Model: toJson(simplejson.NewFromAny(map[string]interface{}{
						"target": "ahalfquery",
					})),
				},
			},
			expected:  `{"target":"ahalfquery"}`,
			dsMapping: map[string]*dsType{"a": {Type: datasources.DS_GRAPHITE}},
			dashboard: &dashboard{},
		},
		{
			name: "when query was hidden, it removes the flag",
			input: []alertQuery{
				{
					DatasourceUID: "a",
					Model: toJson(simplejson.NewFromAny(map[string]interface{}{
						"hide": true,
					})),
				},
			},
			expected:  `{}`,
			dsMapping: map[string]*dsType{"a": {Type: datasources.DS_GRAPHITE}},
			dashboard: &dashboard{},
		},
		{
			name: "a non graphite query should be returned normally",
			input: []alertQuery{
				{
					DatasourceUID: "a",
					Model: toJson(simplejson.NewFromAny(map[string]interface{}{
						"refId": "C",
						"model": []byte(`{"expr":"1","hide":false,"interval":"","legendFormat":"{{cluster}} usage","refId":"C"}`),
					})),
				},
			},
			// The model is base64 encoded, for local testing it can be decoded using "echo <model> | base64 -d"
			expected: `{
				"refId": "C",
				"model": "eyJleHByIjoiMSIsImhpZGUiOmZhbHNlLCJpbnRlcnZhbCI6IiIsImxlZ2VuZEZvcm1hdCI6Int7Y2x1c3Rlcn19IHVzYWdlIiwicmVmSWQiOiJDIn0="
			}`,
			dsMapping: map[string]*dsType{"a": {Type: datasources.DS_PROMETHEUS}},
			dashboard: &dashboard{},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := migrateAlertRuleQueries(log.NewNopLogger(), 0, tt.input, 0, tt.dashboard, tt.dsMapping)
			if tt.err != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.err.Error())
				return
			}

			require.NoError(t, err)
			r, err := queries[0].Model.MarshalJSON()
			require.NoError(t, err)
			require.JSONEq(t, tt.expected, string(r))
		})
	}
}

func toJson(json *simplejson.Json) json.RawMessage {
	b, err := json.MarshalJSON()
	if err != nil {
		panic(err)
	}
	return b
}

func TestAddMigrationInfo(t *testing.T) {
	tt := []struct {
		name                string
		tagsJSON            string
		expectedLabels      map[string]string
		expectedAnnotations map[string]string
	}{
		{
			name:                "when alert rule tags are a JSON array, they're ignored.",
			tagsJSON:            `{ "alertRuleTags": ["one", "two", "three", "four"] }`,
			expectedLabels:      map[string]string{},
			expectedAnnotations: map[string]string{"__alertId__": "0", "__dashboardUid__": "", "__panelId__": "0"},
		},
		{
			name:                "when alert rule tags are a JSON object",
			tagsJSON:            `{ "alertRuleTags": { "key": "value", "key2": "value2" } }`,
			expectedLabels:      map[string]string{"key": "value", "key2": "value2"},
			expectedAnnotations: map[string]string{"__alertId__": "0", "__dashboardUid__": "", "__panelId__": "0"},
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			var settings dashAlertSettings
			require.NoError(t, json.Unmarshal([]byte(tc.tagsJSON), &settings))

			labels, annotations := addMigrationInfo(&dashAlert{ParsedSettings: &settings})
			require.Equal(t, tc.expectedLabels, labels)
			require.Equal(t, tc.expectedAnnotations, annotations)
		})
	}
}

func TestMakeAlertRule(t *testing.T) {
	t.Run("when mapping rule names", func(t *testing.T) {
		t.Run("leaves basic names untouched", func(t *testing.T) {
			m := newTestMigration(t)
			da := createTestDashAlert()
			cnd := createTestDashAlertCondition()

			ar, err := m.makeAlertRule(cnd, da, "folder")

			require.NoError(t, err)
			require.Equal(t, da.Name, ar.Title)
			require.Equal(t, ar.Title, ar.RuleGroup)
		})

		t.Run("truncates very long names to max length", func(t *testing.T) {
			m := newTestMigration(t)
			da := createTestDashAlert()
			da.Name = strings.Repeat("a", DefaultFieldMaxLength+1)
			cnd := createTestDashAlertCondition()

			ar, err := m.makeAlertRule(cnd, da, "folder")

			require.NoError(t, err)
			require.Len(t, ar.Title, DefaultFieldMaxLength)
			parts := strings.SplitN(ar.Title, "_", 2)
			require.Len(t, parts, 2)
			require.Greater(t, len(parts[1]), 8, "unique identifier should be longer than 9 characters")
			require.Equal(t, DefaultFieldMaxLength-1, len(parts[0])+len(parts[1]), "truncated name + underscore + unique identifier should together be DefaultFieldMaxLength")
			require.Equal(t, ar.Title, ar.RuleGroup)
		})
	})

	t.Run("alert is not paused", func(t *testing.T) {
		m := newTestMigration(t)
		da := createTestDashAlert()
		cnd := createTestDashAlertCondition()

		ar, err := m.makeAlertRule(cnd, da, "folder")
		require.NoError(t, err)
		require.False(t, ar.IsPaused)
	})

	t.Run("paused dash alert is paused", func(t *testing.T) {
		m := newTestMigration(t)
		da := createTestDashAlert()
		da.State = "paused"
		cnd := createTestDashAlertCondition()

		ar, err := m.makeAlertRule(cnd, da, "folder")
		require.NoError(t, err)
		require.True(t, ar.IsPaused)
	})

	t.Run("paused dash alert is silenced", func(t *testing.T) {
		m := newTestMigration(t)
		da := createTestDashAlert()
		da.State = "paused"
		cnd := createTestDashAlertCondition()

		ar, err := m.makeAlertRule(cnd, da, "folder")
		require.NoError(t, err)

		n, v := getLabelForPauseSilenceMatching()
		require.Equal(t, ar.Labels[n], v)
	})

	t.Run("keep last state error dash alert is silenced", func(t *testing.T) {
		m := newTestMigration(t)
		da := createTestDashAlert()
		da.ParsedSettings.ExecutionErrorState = "keep_state"
		cnd := createTestDashAlertCondition()

		ar, err := m.makeAlertRule(cnd, da, "folder")
		require.NoError(t, err)

		n, v := getLabelForErrorSilenceMatching()
		require.Equal(t, ar.Labels[n], v)
	})

	t.Run("keep last state nodata dash alert is silenced", func(t *testing.T) {
		m := newTestMigration(t)
		da := createTestDashAlert()
		da.ParsedSettings.NoDataState = "keep_state"
		cnd := createTestDashAlertCondition()

		ar, err := m.makeAlertRule(cnd, da, "folder")
		require.NoError(t, err)

		n, v := getLabelForNoDataSilenceMatching()
		require.Equal(t, ar.Labels[n], v)
	})
}

func createTestDashAlert() dashAlert {
	return dashAlert{
		Id:             1,
		Name:           "test",
		ParsedSettings: &dashAlertSettings{},
	}
}

func createTestDashAlertCondition() condition {
	return condition{
		Condition: "A",
	}
}
