package store

import (
	"encoding/json"
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
				raw := make(map[string]interface{})
				err := json.Unmarshal(r.Data[1].Model, &raw)
				require.NoError(t, err)
				raw["reducer"] = "avg"
				r.Data[1].Model, err = json.Marshal(raw)
				require.NoError(t, err)
			}),
		},
		{
			name:     "invalid rule that has no aggregation as second item",
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
		r.Data[0].QueryType = "instant"
		r.Data[0].Model = []byte(`{
			"datasource": {
				"type": "loki",
				"uid": "grafanacloud-logs"
			},
			"editorMode": "code",
			"expr": "1",
			"hide": false,
			"intervalMs": 1000,
			"maxDataPoints": 43200,
			"queryType": "instant",
			"refId": "A"
		}`)
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

func createMigrateableLokiRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			{
				RefID:         "A",
				QueryType:     "range",
				DatasourceUID: "grafanacloud-logs",
				Model: []byte(`{
					"datasource": {
						"type": "loki",
						"uid": "grafanacloud-logs"
					},
					"editorMode": "code",
					"expr": "1",
					"hide": false,
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"queryType": "range",
					"refId": "A"
				}`),
			},
			{
				RefID:         "B",
				DatasourceUID: "__expr__",
				Model: []byte(`{
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
								"type": "last"
							},
							"type": "query"
						}
					],
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"expression": "A",
					"hide": false,
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"reducer": "last",
					"refId": "B",
					"type": "reduce"
				}`),
			},
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
			{
				RefID:         "TotalRequests",
				QueryType:     "range",
				DatasourceUID: "grafanacloud-logs",
				Model: []byte(`{
					"datasource": {
						"type": "loki",
						"uid": "grafanacloud-logs"
					},
					"editorMode": "code",
					"expr": "1",
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"queryType": "range",
					"refId": "TotalRequests"
				}`),
			},
			{
				RefID:         "TotalErrors",
				QueryType:     "range",
				DatasourceUID: "grafanacloud-logs",
				Model: []byte(`{
					"datasource": {
						"type": "loki",
						"uid": "grafanacloud-logs"
					},
					"editorMode": "code",
					"expr": "1",
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"queryType": "range",
					"refId": "TotalErrors"
				}`),
			},
			{
				RefID:         "TotalRequests_Last",
				DatasourceUID: "__expr__",
				Model: []byte(`{
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
								"type": "last"
							},
							"type": "query"
						}
					],
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"expression": "TotalRequests",
					"hide": false,
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"reducer": "last",
					"refId": "TotalRequests_Last",
					"type": "reduce"
				}`),
			},
			{
				RefID:         "TotalErrors_Last",
				DatasourceUID: "__expr__",
				Model: []byte(`{
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
								"type": "last"
							},
							"type": "query"
						}
					],
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"expression": "TotalErrors",
					"hide": false,
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"reducer": "last",
					"refId": "TotalErrors_Last",
					"type": "reduce"
				}`),
			},
		},
	}
	for _, m := range muts {
		m(r)
	}
	return r
}
