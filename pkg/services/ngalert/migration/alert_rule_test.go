package migration

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/migration/legacymodels"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
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
			input:    simplejson.NewFromAny(map[string]any{"targetFull": "thisisafullquery", "target": "ahalfquery"}),
			expected: `{"target":"thisisafullquery"}`,
		},
		{
			name:     "when a query does not have a sub query - it no-ops",
			input:    simplejson.NewFromAny(map[string]any{"target": "ahalfquery"}),
			expected: `{"target":"ahalfquery"}`,
		},
		{
			name:     "when query was hidden, it removes the flag",
			input:    simplejson.NewFromAny(map[string]any{"hide": true}),
			expected: `{}`,
		},
		{
			name: "when prometheus both type query, convert to range",
			input: simplejson.NewFromAny(map[string]any{
				"datasource": map[string]string{
					"type": "prometheus",
				},
				"instant": true,
				"range":   true,
			}),
			expected: `{"datasource":{"type":"prometheus"},"instant":false,"range":true}`,
		},
		{
			name: "when prometheus instant type query, do nothing",
			input: simplejson.NewFromAny(map[string]any{
				"datasource": map[string]string{
					"type": "prometheus",
				},
				"instant": true,
			}),
			expected: `{"datasource":{"type":"prometheus"},"instant":true}`,
		},
		{
			name: "when non-prometheus with instant and range, do nothing",
			input: simplejson.NewFromAny(map[string]any{
				"datasource": map[string]string{
					"type": "something",
				},
				"instant": true,
				"range":   true,
			}),
			expected: `{"datasource":{"type":"something"},"instant":true,"range":true}`,
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			model, err := tt.input.Encode()
			require.NoError(t, err)
			queries, err := migrateAlertRuleQueries(&logtest.Fake{}, []models.AlertQuery{{Model: model}})
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
		alert               *legacymodels.Alert
		dashboard           string
		expectedLabels      data.Labels
		expectedAnnotations data.Labels
	}{
		{
			name: "when alert rule tags are a JSON array, they're ignored.",
			alert: &legacymodels.Alert{ID: 43, PanelID: 42, Message: "message", Settings: simplejson.NewFromAny(map[string]any{
				"alertRuleTags": []string{"one", "two", "three", "four"},
			})},
			dashboard:           "dashboard",
			expectedLabels:      data.Labels{},
			expectedAnnotations: data.Labels{models.DashboardUIDAnnotation: "dashboard", models.PanelIDAnnotation: "42", "message": "message"},
		},
		{
			name: "when alert rule tags are a JSON object",
			alert: &legacymodels.Alert{ID: 43, PanelID: 42, Message: "message", Settings: simplejson.NewFromAny(map[string]any{
				"alertRuleTags": map[string]any{"key": "value", "key2": "value2"},
			})}, dashboard: "dashboard",
			expectedLabels:      data.Labels{"key": "value", "key2": "value2"},
			expectedAnnotations: data.Labels{models.DashboardUIDAnnotation: "dashboard", models.PanelIDAnnotation: "42", "message": "message"},
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			labels, annotations := addLabelsAndAnnotations(&logtest.Fake{}, tc.alert, tc.dashboard)
			require.Equal(t, tc.expectedLabels, labels)
			require.Equal(t, tc.expectedAnnotations, annotations)
		})
	}
}

func TestMakeAlertRule(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	dashboard := dashboards.Dashboard{ID: 1, UID: "dashboarduid", Title: "dashboardname"}
	t.Run("when mapping rule names", func(t *testing.T) {
		t.Run("leaves basic names untouched", func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			da := createTestDashAlert()

			ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)

			require.NoError(t, err)
			require.Equal(t, da.Name, ar.Title)
		})
	})

	t.Run("alert is not paused", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()

		ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)
		require.NoError(t, err)
		require.False(t, ar.IsPaused)
	})

	t.Run("paused dash alert is paused", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()
		da.State = "paused"

		ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)
		require.NoError(t, err)
		require.True(t, ar.IsPaused)
	})

	t.Run("use default if execution of NoData is not known", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()
		da.Settings.Set("noDataState", uuid.NewString())

		ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)
		require.Nil(t, err)
		require.Equal(t, models.NoData, ar.NoDataState)
	})

	t.Run("use default if execution of Error is not known", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()
		da.Settings.Set("executionErrorState", uuid.NewString())

		ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)
		require.Nil(t, err)
		require.Equal(t, models.ErrorErrState, ar.ExecErrState)
	})

	t.Run("migrate message template", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()
		da.Message = "Instance ${instance} is down"

		ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)
		require.Nil(t, err)
		expected :=
			"{{- $mergedLabels := mergeLabelValues $values -}}\n" +
				"Instance {{$mergedLabels.instance}} is down"
		require.Equal(t, expected, ar.Annotations["message"])
	})

	t.Run("create unique group from dashboard title and humanized interval", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()
		da.PanelID = 42

		intervalTests := []struct {
			interval int64
			expected string
		}{
			{interval: 10, expected: "10s"},
			{interval: 30, expected: "30s"},
			{interval: 60, expected: "1m"},
			{interval: 120, expected: "2m"},
			{interval: 3600, expected: "1h"},
			{interval: 7200, expected: "2h"},
			{interval: 86400, expected: "1d"},
			{interval: 172800, expected: "2d"},
			{interval: 604800, expected: "1w"},
			{interval: 1209600, expected: "2w"},
			{interval: 31536000, expected: "1y"},
			{interval: 63072000, expected: "2y"},
			{interval: 60 + 30, expected: "1m30s"},
			{interval: 3600 + 10, expected: "1h10s"},
			{interval: 3600 + 60, expected: "1h1m"},
			{interval: 3600 + 60 + 10, expected: "1h1m10s"},
			{interval: 86400 + 10, expected: "1d10s"},
			{interval: 86400 + 60, expected: "1d1m"},
			{interval: 86400 + 3600, expected: "1d1h"},
			{interval: 86400 + 3600 + 60, expected: "1d1h1m"},
			{interval: 86400 + 3600 + 10, expected: "1d1h10s"},
			{interval: 86400 + 60 + 10, expected: "1d1m10s"},
			{interval: 86400 + 3600 + 60 + 10, expected: "1d1h1m10s"},
			{interval: 604800 + 86400 + 3600 + 60 + 10, expected: "8d1h1m10s"},
			{interval: 31536000 + 604800 + 86400 + 3600 + 60 + 10, expected: "373d1h1m10s"},
		}

		for _, test := range intervalTests {
			t.Run(fmt.Sprintf("interval %ds should be %s", test.interval, test.expected), func(t *testing.T) {
				da.Frequency = test.interval

				ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &dashboard)

				require.NoError(t, err)
				require.Equal(t, fmt.Sprintf("%s - %s", dashboard.Title, test.expected), ar.RuleGroup)
			})
		}
	})

	t.Run("truncate dashboard name part of rule group if too long", func(t *testing.T) {
		service := NewTestMigrationService(t, sqlStore, nil)
		m := service.newOrgMigration(1)
		da := createTestDashAlert()
		longNamedDashboard := dashboards.Dashboard{UID: "dashboarduid", Title: strings.Repeat("a", store.AlertRuleMaxRuleGroupNameLength-1)}

		ar, err := m.migrateAlert(context.Background(), &logtest.Fake{}, da, &longNamedDashboard)

		require.NoError(t, err)
		require.Len(t, ar.RuleGroup, store.AlertRuleMaxRuleGroupNameLength)
		suffix := fmt.Sprintf(" - %ds", ar.IntervalSeconds)
		require.Equal(t, fmt.Sprintf("%s%s", strings.Repeat("a", store.AlertRuleMaxRuleGroupNameLength-len(suffix)), suffix), ar.RuleGroup)
	})
}

func createTestDashAlert() *legacymodels.Alert {
	return &legacymodels.Alert{
		OrgID:    1,
		ID:       1,
		Name:     "test",
		Settings: simplejson.New(),
	}
}
