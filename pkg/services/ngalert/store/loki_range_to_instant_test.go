package store

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestCanBeInstant(t *testing.T) {
	tcs := []struct {
		name            string
		expected        bool
		expectedIndices []int
		rule            *models.AlertRule
	}{
		{
			name:            "valid rule that can be migrated from range to instant",
			expected:        true,
			expectedIndices: []int{0},
			rule:            createMigrateableLokiRule(t),
		},
		{
			name:            "valid rule with external loki datasource",
			expected:        true,
			expectedIndices: []int{0},
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[0].DatasourceUID = "something-external"
			}),
		},
		{
			name:            "valid multi query rule with loki datasources",
			expected:        true,
			expectedIndices: []int{0, 1},
			rule:            createMultiQueryMigratableLokiRule(t),
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
				raw := make(map[string]interface{})
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
			indicies, canBe := canBeInstant(tc.rule)
			require.Equal(t, tc.expected, canBe)
			require.Equal(t, tc.expectedIndices, indicies)
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

	originalModel := make(map[string]interface{})
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]interface{})
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

	originalModel := make(map[string]interface{})
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]interface{})
	require.NoError(t, json.Unmarshal(mirgrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	originalModel = make(map[string]interface{})
	require.NoError(t, json.Unmarshal(original.Data[1].Model, &originalModel))
	migratedModel = make(map[string]interface{})
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
