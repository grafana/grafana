package store

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	promIsInstant    = true
	promIsNotInstant = false
)

func TestCanBeInstant(t *testing.T) {
	tcs := []struct {
		name                  string
		expected              bool
		expectedOptimizations []optimization
		rule                  *models.AlertRule
	}{
		{
			name:                  "valid loki rule that can be migrated from range to instant",
			expected:              true,
			expectedOptimizations: []optimization{{i: 0, t: datasources.DS_LOKI}},
			rule:                  createMigrateableLokiRule(t),
		},
		{
			name:                  "valid prom rule that can be migrated from range to instant",
			expected:              true,
			expectedOptimizations: []optimization{{i: 0, t: datasources.DS_PROMETHEUS}},
			rule:                  createMigrateablePromRule(t),
		},
		{
			name:                  "valid loki rule with external loki datasource",
			expected:              true,
			expectedOptimizations: []optimization{{i: 0, t: datasources.DS_LOKI}},
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[0].DatasourceUID = "something-external"
			}),
		},
		{
			name:                  "valid prom rule with external loki prometheus",
			expected:              true,
			expectedOptimizations: []optimization{{i: 0, t: datasources.DS_PROMETHEUS}},
			rule: createMigrateablePromRule(t, func(r *models.AlertRule) {
				r.Data[0].DatasourceUID = "something-external"
			}),
		},
		{
			name:     "valid loki multi query rule with loki datasources",
			expected: true,
			expectedOptimizations: []optimization{
				{i: 0, t: datasources.DS_LOKI},
				{i: 1, t: datasources.DS_LOKI},
			},
			rule: createMultiQueryMigratableLokiRule(t),
		},
		{
			name:     "valid prom multi query rule with prom datasources",
			expected: true,
			expectedOptimizations: []optimization{
				{i: 0, t: datasources.DS_PROMETHEUS},
				{i: 1, t: datasources.DS_PROMETHEUS},
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
			optimizations, canBe := canBeInstant(tc.rule)
			require.Equal(t, tc.expected, canBe)
			require.Equal(t, tc.expectedOptimizations, optimizations)
		})
	}
}

func TestMigrateLokiQueryToInstant(t *testing.T) {
	original := createMigrateableLokiRule(t)
	mirgrated := createMigrateableLokiRule(t, func(r *models.AlertRule) {
		r.Data[0] = lokiQuery(t, "A", "instant", "grafanacloud-logs")
	})

	optimizableIndices, canBeOptimized := canBeInstant(original)
	require.True(t, canBeOptimized)
	require.NoError(t, migrateToInstant(original, optimizableIndices))

	require.Equal(t, mirgrated.Data[0].QueryType, original.Data[0].QueryType)

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(mirgrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original)
	require.False(t, canBeOptimized)
}

func TestMigrateMultiLokiQueryToInstant(t *testing.T) {
	original := createMultiQueryMigratableLokiRule(t)
	mirgrated := createMultiQueryMigratableLokiRule(t, func(r *models.AlertRule) {
		r.Data[0] = lokiQuery(t, "TotalRequests", "instant", "grafanacloud-logs")
		r.Data[1] = lokiQuery(t, "TotalErrors", "instant", "grafanacloud-logs")
	})

	optimizableIndices, canBeOptimized := canBeInstant(original)
	require.True(t, canBeOptimized)
	require.NoError(t, migrateToInstant(original, optimizableIndices))

	require.Equal(t, mirgrated.Data[0].QueryType, original.Data[0].QueryType)
	require.Equal(t, mirgrated.Data[1].QueryType, original.Data[1].QueryType)

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(mirgrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	originalModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[1].Model, &originalModel))
	migratedModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(mirgrated.Data[1].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original)
	require.False(t, canBeOptimized)
}

func TestMigratePromQueryToInstant(t *testing.T) {
	original := createMigrateablePromRule(t)
	mirgrated := createMigrateablePromRule(t, func(r *models.AlertRule) {
		r.Data[0] = promethesQuery(t, "A", "grafanacloud-prom", promIsInstant)
	})

	optimizableIndices, canBeOptimized := canBeInstant(original)
	require.True(t, canBeOptimized)
	require.NoError(t, migrateToInstant(original, optimizableIndices))

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(mirgrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original)
	require.False(t, canBeOptimized)
}

func TestMigrateMultiPromQueryToInstant(t *testing.T) {
	original := createMultiQueryMigratablePromRule(t)
	mirgrated := createMultiQueryMigratablePromRule(t, func(r *models.AlertRule) {
		r.Data[0] = promethesQuery(t, "TotalRequests", "grafanacloud-prom", promIsInstant)
		r.Data[1] = promethesQuery(t, "TotalErrors", "grafanacloud-prom", promIsInstant)
	})

	optimizableIndices, canBeOptimized := canBeInstant(original)
	require.True(t, canBeOptimized)
	require.NoError(t, migrateToInstant(original, optimizableIndices))

	originalModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]any)
	require.NoError(t, json.Unmarshal(mirgrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	originalModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(original.Data[1].Model, &originalModel))
	migratedModel = make(map[string]any)
	require.NoError(t, json.Unmarshal(mirgrated.Data[1].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	_, canBeOptimized = canBeInstant(original)
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

func createMigrateablePromRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			promethesQuery(t, "A", "grafanacloud-prom", promIsNotInstant),
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
			promethesQuery(t, "TotalRequests", "grafanacloud-prom", promIsNotInstant),
			promethesQuery(t, "TotalErrors", "grafanacloud-prom", promIsNotInstant),
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
	return models.AlertQuery{
		RefID:         refID,
		QueryType:     queryType,
		DatasourceUID: datasourceUID,
		Model: []byte(fmt.Sprintf(`{
					"datasource": {
						"type": "loki",
						"uid": "%s"
					},
					"editorMode": "code",
					"expr": "1",
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"queryType": "%s",
					"refId": "%s"
				}`, datasourceUID, queryType, refID)),
	}
}

func promethesQuery(t *testing.T, refID, datasourceUID string, isInstant bool) models.AlertQuery {
	t.Helper()
	return models.AlertQuery{
		RefID:         refID,
		DatasourceUID: datasourceUID,
		Model: []byte(fmt.Sprintf(`{
					"datasource": {
						"type": "prometheus",
						"uid": "%s"
					},
					"instant": %t,
					"editorMode": "code",
					"expr": "1",
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"refId": "%s"
				}`, datasourceUID, isInstant, refID)),
	}
}

func reducer(t *testing.T, refID, exp, op string) models.AlertQuery {
	t.Helper()
	return models.AlertQuery{
		RefID:         refID,
		DatasourceUID: "__expr__",
		Model: []byte(fmt.Sprintf(`{
					"conditions": [
						{
							"evaluator": {
								"params": [],
								"type": "gt"
							},
							"operator": {
								"type": "and"
							},
							"query": {
								"params": [
									"B"
								]
							},
							"reducer": {
								"params": [],
								"type": "%s"
							},
							"type": "query"
						}
					],
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"expression": "%s",
					"hide": false,
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"reducer": "%s",
					"refId": "%s",
					"type": "reduce"
				}`, op, exp, op, refID)),
	}
}
