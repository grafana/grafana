package store

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
)

func TestCanBeInstant(t *testing.T) {
	tcs := []struct {
		name     string
		expected bool
		rule     *models.AlertRule
	}{
		{
			name:     "valid rule that can be migrated from range to instant",
			expected: true,
			rule:     createMigrateableLokiRule(t),
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
			name:     "invalid rule that does not use a cloud datasource",
			expected: false,
			rule: createMigrateableLokiRule(t, func(r *models.AlertRule) {
				r.Data[0].DatasourceUID = "something-else"
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
			require.Equal(t, tc.expected, canBeInstant(tc.rule))
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

	require.True(t, canBeInstant(original))
	require.NoError(t, migrateToInstant(original))

	require.Equal(t, mirgrated.Data[0].QueryType, original.Data[0].QueryType)

	originalModel := make(map[string]interface{})
	require.NoError(t, json.Unmarshal(original.Data[0].Model, &originalModel))
	migratedModel := make(map[string]interface{})
	require.NoError(t, json.Unmarshal(mirgrated.Data[0].Model, &migratedModel))

	require.Equal(t, migratedModel, originalModel)

	require.False(t, canBeInstant(original))
}

func createMigrateableLokiRule(t *testing.T, muts ...func(*models.AlertRule)) *models.AlertRule {
	t.Helper()
	r := &models.AlertRule{
		Data: []models.AlertQuery{
			{
				RefID:         "A",
				QueryType:     "range",
				DatasourceUID: grafanaCloudLogs,
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
