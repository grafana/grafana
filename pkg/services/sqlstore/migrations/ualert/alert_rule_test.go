package ualert

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestMigrateAlertRuleQueries(t *testing.T) {
	tc := []struct {
		name     string
		input    *simplejson.Json
		expected string
		err      error
	}{
		{
			name:     "when a query has a sub query - it is extracted",
			input:    simplejson.NewFromAny(map[string]interface{}{"targetFull": "thisisafullquery", "target": "ahalfquery"}),
			expected: `{"target":"thisisafullquery"}`,
		},
		{
			name:     "when a query does not have a sub query - it no-ops",
			input:    simplejson.NewFromAny(map[string]interface{}{"target": "ahalfquery"}),
			expected: `{"target":"ahalfquery"}`,
		},
		{
			name:     "when query was hidden, it removes the flag",
			input:    simplejson.NewFromAny(map[string]interface{}{"hide": true}),
			expected: `{}`,
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			model, err := tt.input.Encode()
			require.NoError(t, err)
			queries, err := migrateAlertRuleQueries([]alertQuery{{Model: model}})
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
