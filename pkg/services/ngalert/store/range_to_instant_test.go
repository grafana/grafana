package store

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	promIsInstant    = true
	promIsNotInstant = false
	promExternalDS   = "some-external-ds"
)

func TestCanBeInstant(t *testing.T) {
	tcs := []struct {
		name                  string
		expected              bool
		expectedOptimizations []Optimization
		rule                  *models.AlertRule
	}{
		{
			name:                  "valid loki rule that can be migrated from range to instant",
			expected:              true,
			expectedOptimizations: []Optimization{{i: 0, t: datasources.DS_LOKI, RefID: "A"}},
			rule:                  createMigrateableLokiRule(t),
		},
		{
			name:                  "valid prom rule that can be migrated from range to instant",
			expected:              true,
			expectedOptimizations: []Optimization{{i: 0, t: datasources.DS_PROMETHEUS, RefID: "A"}},
			rule:                  createMigratablePromRule(t),
		},
		{
			name:                  "valid loki rule with external loki datasource",
			expected:              true,
			expectedOptimizations: []Optimization{{i: 0, t: datasources.DS_LOKI, RefID: "A"}},
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[0].DatasourceUID = "something-external"
			}),
		},
		{
			name:                  "valid prom rule with external prometheus datasource",
			expected:              true,
			expectedOptimizations: []Optimization{{i: 0, t: datasources.DS_PROMETHEUS, RefID: "A"}},
			rule: createMigratablePromRule(t, func(r *models.AlertRule) {
				r.Data[0].DatasourceUID = "something-external"
			}),
		},
		{
			name:                  "valid prom rule with missing datasource",
			expected:              true,
			expectedOptimizations: []Optimization{{i: 0, t: datasources.DS_PROMETHEUS, RefID: "A"}},
			rule:                  createMigratablePromRuleWithDefaultDS(t),
		},
		{
			name:     "valid prom rule with missing datasource and instant query",
			expected: false,
			rule: createMigratablePromRuleWithDefaultDS(t, func(r *models.AlertRule) {
				raw := make(map[string]any)
				err := json.Unmarshal(r.Data[0].Model, &raw)
				require.NoError(t, err)
				raw["range"] = false
				r.Data[0].Model, err = json.Marshal(raw)
				require.NoError(t, err)
			}),
		},
		{
			name:     "valid loki multi query rule with loki datasources",
			expected: true,
			expectedOptimizations: []Optimization{
				{i: 0, t: datasources.DS_LOKI, RefID: "TotalRequests"},
				{i: 1, t: datasources.DS_LOKI, RefID: "TotalErrors"},
			},
			rule: createMultiQueryMigratableLokiRule(t),
		},
		{
			name:     "valid prom multi query rule with prom datasources",
			expected: true,
			expectedOptimizations: []Optimization{
				{i: 0, t: datasources.DS_PROMETHEUS, RefID: "TotalRequests"},
				{i: 1, t: datasources.DS_PROMETHEUS, RefID: "TotalErrors"},
			},
			rule: createMultiQueryMigratablePromRule(t),
		},
		{
			name:     "invalid rule where the data array is too short to be migrateable",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data = []models.AlertQuery{r.Data[0]}
			}),
		},
		{
			name:     "invalid rule that is not a range query",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[0].QueryType = "something-else"
			}),
		},
		{
			name:     "invalid rule that has not last() as aggregation",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[1] = reducer(t, "B", "A", "avg")
			}),
		},
		{
			name:     "invalid rule that has not all reducers last()",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data = append(r.Data, reducer(t, "invalid-reducer", "A", "min"))
			}),
		},
		{
			name:     "invalid rule that has no aggregation",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[1].DatasourceUID = "something-else"
			}),
		},
		{
			name:     "invalid rule that has not last() pointing to range query",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				raw := make(map[string]any)
				err := json.Unmarshal(r.Data[1].Model, &raw)
				require.NoError(t, err)
				raw["expression"] = "C"
				r.Data[1].Model, err = json.Marshal(raw)
				require.NoError(t, err)
			}),
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			optimizations, canBe := canBeInstant(tc.rule.Data)
			require.Equal(t, tc.expected, canBe)
			require.Equal(t, tc.expectedOptimizations, optimizations)
		})
	}
}

func TestIntegrationMigrateLokiQueryToInstant(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	original := createMigrateableLokiRule(t)
	migrated := createMigrateableLokiRule(t, func(r *models.AlertRule) {
		r.Data[0] = lokiQuery(t, "A", "instant", "grafanacloud-logs")
	})

	optimizableIndices, canBeOptimized := canBeInstant(original.Data)
	require.True(t, canBeOptimized)
	require.NoError(t, migrateToInstant(original.Data, optimizableIndices))

	require.Equal(t, migrated.Data[0].QueryType, original.Data[0].QueryType)

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(migrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original.Data)
	require.False(t, canBeOptimized)
}

func TestIntegrationMigrateMultiLokiQueryToInstant(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	original := createMultiQueryMigratableLokiRule(t)
	migrated := createMultiQueryMigratableLokiRule(t, func(r *models.AlertRule) {
		r.Data[0] = lokiQuery(t, "TotalRequests", "instant", "grafanacloud-logs")
		r.Data[1] = lokiQuery(t, "TotalErrors", "instant", "grafanacloud-logs")
	})

	_, canBeOptimized := canBeInstant(original.Data)
	require.True(t, canBeOptimized)

	optimizations, err := OptimizeAlertQueries(original.Data)
	require.NoError(t, err)

	require.Equal(t, optimizations[0].RefID, original.Data[0].RefID)
	require.Equal(t, optimizations[1].RefID, original.Data[1].RefID)

	require.Equal(t, migrated.Data[0].QueryType, original.Data[0].QueryType)
	require.Equal(t, migrated.Data[1].QueryType, original.Data[1].QueryType)

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(migrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	originalModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[1].Model, &originalModel))
	migratedModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(migrated.Data[1].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original.Data)
	require.False(t, canBeOptimized)
}

func TestIntegrationMigratePromQueryToInstant(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	original := createMigratablePromRule(t)
	migrated := createMigratablePromRule(t, func(r *models.AlertRule) {
		r.Data[0] = prometheusQuery(t, "A", promExternalDS, promIsInstant)
	})

	optimizableIndices, canBeOptimized := canBeInstant(original.Data)
	require.True(t, canBeOptimized)
	require.NoError(t, migrateToInstant(original.Data, optimizableIndices))

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(migrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original.Data)
	require.False(t, canBeOptimized)
}

func TestIntegrationMigrateMultiPromQueryToInstant(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	original := createMultiQueryMigratablePromRule(t)
	migrated := createMultiQueryMigratablePromRule(t, func(r *models.AlertRule) {
		r.Data[0] = prometheusQuery(t, "TotalRequests", promExternalDS, promIsInstant)
		r.Data[1] = prometheusQuery(t, "TotalErrors", promExternalDS, promIsInstant)
	})

	_, canBeOptimized := canBeInstant(original.Data)
	require.True(t, canBeOptimized)

	optimizations, err := OptimizeAlertQueries(original.Data)
	require.NoError(t, err)

	require.Equal(t, optimizations[0].RefID, original.Data[0].RefID)
	require.Equal(t, optimizations[1].RefID, original.Data[1].RefID)

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(migrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	originalModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[1].Model, &originalModel))
	migratedModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(migrated.Data[1].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original.Data)
	require.False(t, canBeOptimized)
}

func createMigrateableLokiRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			lokiQuery(t, "A", "range", "grafanacloud-logs"),
			reducer(t, "B", "A", "last"),
		},
	}
	for _, m := range muts {
		m(r)
	}
	return r
}

func createMultiQueryMigratableLokiRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			lokiQuery(t, "TotalRequests", "range", "grafanacloud-logs"),
			lokiQuery(t, "TotalErrors", "range", "grafanacloud-logs"),
			reducer(t, "TotalRequests_Last", "TotalRequests", "last"),
			reducer(t, "TotalErrors_Last", "TotalErrors", "last"),
		},
	}
	for _, m := range muts {
		m(r)
	}
	return r
}

func createMigratablePromRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			prometheusQuery(t, "A", promExternalDS, promIsNotInstant),
			reducer(t, "B", "A", "last"),
		},
	}
	for _, m := range muts {
		m(r)
	}
	return r
}

func createMigratablePromRuleWithDefaultDS(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			prometheusQueryWithoutDS(t, "A", grafanaCloudProm, promIsNotInstant),
			reducer(t, "B", "A", "last"),
		},
	}
	for _, m := range muts {
		m(r)
	}
	return r
}

func createMultiQueryMigratablePromRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			prometheusQuery(t, "TotalRequests", promExternalDS, promIsNotInstant),
			prometheusQuery(t, "TotalErrors", promExternalDS, promIsNotInstant),
			reducer(t, "TotalRequests_Last", "TotalRequests", "last"),
			reducer(t, "TotalErrors_Last", "TotalErrors", "last"),
		},
	}
	for _, m := range muts {
		m(r)
	}
	return r
}

func lokiQuery(t *testing.T, refID, queryType, datasourceUID string) models.AlertQuery {
	t.Helper()
	return models.CreateLokiQuery(refID, "1", 1000, 43200, queryType, datasourceUID)
}

func prometheusQuery(t *testing.T, refID, datasourceUID string, isInstant bool) models.AlertQuery {
	t.Helper()
	return models.CreatePrometheusQuery(refID, "1", 1000, 43200, isInstant, datasourceUID)
}

func prometheusQueryWithoutDS(t *testing.T, refID, datasourceUID string, isInstant bool) models.AlertQuery {
	t.Helper()
	return models.AlertQuery{
		RefID:         refID,
		DatasourceUID: datasourceUID,
		Model: []byte(fmt.Sprintf(`{
					"instant": %t,
					"range": %t,
					"editorMode": "code",
					"expr": "1",
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"refId": "%s"
				}`, isInstant, !isInstant, refID)),
	}
}

func reducer(t *testing.T, refID, exp, op string) models.AlertQuery {
	t.Helper()
	return models.CreateReduceExpression(refID, exp, op)
}
