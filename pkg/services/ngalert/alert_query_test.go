package ngalert

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAlertQuery(t *testing.T) {
	testCases := []struct {
		desc                 string
		alertQuery           AlertQuery
		expectedIsExpression bool
		expectedDatasource   string
		expectedDatasourceID int64
		expectedMaxPoints    int64
		expectedIntervalMs   int64
		err                  error
	}{
		{
			desc: "given an expression query",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "__expr__",
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: true,
			expectedDatasource:   "__expr__",
			expectedDatasourceID: int64(defaultExprDatasourceID),
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
		{
			desc: "given a query",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
		{
			desc: "given a query with valid maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"maxDataPoints": 200,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    200,
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
		{
			desc: "given a query with invalid maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"maxDataPoints": "invalid",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
		{
			desc: "given a query with zero maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"maxDataPoints": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
		{
			desc: "given a query with valid intevalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"intervalMs": 2000,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   2000,
		},
		{
			desc: "given a query with invalid intevalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"intevalMs": "invalid",
					"extraParam": "some text"	
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
		{
			desc: "given a query with invalid intevalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceId": 1,
					"queryType": "metricQuery",
					"intevalMs": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedDatasource:   "my datasource",
			expectedDatasourceID: 1,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMs:   int64(defaultIntervalMs),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			t.Run("can recongnize if it's an expression", func(t *testing.T) {
				isExpression, err := tc.alertQuery.IsExpression()
				require.NoError(t, err)
				assert.Equal(t, tc.expectedIsExpression, isExpression)
			})

			t.Run("can set datasource for expression", func(t *testing.T) {
				err := tc.alertQuery.setDatasource()
				require.NoError(t, err)
				require.Equal(t, tc.alertQuery.DatasourceID, tc.expectedDatasourceID)
			})

			t.Run("can set queryType for expression", func(t *testing.T) {
				err := tc.alertQuery.setQueryType()
				require.NoError(t, err)
				require.Equal(t, tc.alertQuery.QueryType, "metricQuery")
			})

			t.Run("can update model maxDataPoints (if missing)", func(t *testing.T) {
				maxDataPoints, err := tc.alertQuery.getMaxDatapoints()
				require.NoError(t, err)
				require.Equal(t, maxDataPoints, tc.expectedMaxPoints)
			})

			t.Run("can update model intervalMs (if missing)", func(t *testing.T) {
				intervalMs, err := tc.alertQuery.getIntervalMs()
				require.NoError(t, err)
				require.Equal(t, intervalMs, tc.expectedIntervalMs)
			})

			t.Run("can get the updated model with the default properties (if missing)", func(t *testing.T) {
				blob, err := tc.alertQuery.getModel()
				require.NoError(t, err)
				model := make(map[string]interface{})
				err = json.Unmarshal(blob, &model)
				require.NoError(t, err)

				i, ok := model["datasource"]
				require.True(t, ok)
				datasource, ok := i.(string)
				require.True(t, ok)
				require.Equal(t, tc.expectedDatasource, datasource)

				i, ok = model["datasourceId"]
				require.True(t, ok)
				datasourceID, ok := i.(float64)
				require.True(t, ok)
				require.Equal(t, tc.expectedDatasourceID, int64(datasourceID))

				i, ok = model["maxDataPoints"]
				require.True(t, ok)
				maxDataPoints, ok := i.(float64)
				require.True(t, ok)
				require.Equal(t, tc.expectedMaxPoints, int64(maxDataPoints))

				i, ok = model["intervalMs"]
				require.True(t, ok)
				intervalMs, ok := i.(float64)
				require.True(t, ok)
				require.Equal(t, tc.expectedIntervalMs, int64(intervalMs))

				i, ok = model["extraParam"]
				require.True(t, ok)
				extraParam, ok := i.(string)
				require.True(t, ok)
				require.Equal(t, "some text", extraParam)
			})
		})
	}
}
