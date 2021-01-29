package eval

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAlertQuery(t *testing.T) {
	testCases := []struct {
		desc                  string
		alertQuery            AlertQuery
		expectedIsExpression  bool
		expectedDatasource    string
		expectedDatasourceUID string
		expectedMaxPoints     int64
		expectedIntervalMS    int64
		err                   error
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
			expectedIsExpression:  true,
			expectedDatasource:    expr.DatasourceName,
			expectedDatasourceUID: expr.DatasourceUID,
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
		{
			desc: "given a query",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
		{
			desc: "given a query with valid maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"maxDataPoints": 200,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     200,
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
		{
			desc: "given a query with invalid maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"maxDataPoints": "invalid",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
		{
			desc: "given a query with zero maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"maxDataPoints": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
		{
			desc: "given a query with valid intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"intervalMs": 2000,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    2000,
		},
		{
			desc: "given a query with invalid intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"intervalMs": "invalid",
					"extraParam": "some text"	
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
		{
			desc: "given a query with invalid intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"datasource": "my datasource",
					"datasourceUid": "000000001",
					"queryType": "metricQuery",
					"intervalMs": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression:  false,
			expectedDatasource:    "my datasource",
			expectedDatasourceUID: "000000001",
			expectedMaxPoints:     int64(defaultMaxDataPoints),
			expectedIntervalMS:    int64(defaultIntervalMS),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			t.Run("can recognize if it's an expression", func(t *testing.T) {
				isExpression, err := tc.alertQuery.IsExpression()
				require.NoError(t, err)
				assert.Equal(t, tc.expectedIsExpression, isExpression)
			})

			t.Run("can set datasource for expression", func(t *testing.T) {
				err := tc.alertQuery.setDatasource()
				require.NoError(t, err)
				require.Equal(t, tc.expectedDatasourceUID, tc.alertQuery.DatasourceUID)
			})

			t.Run("can set queryType for expression", func(t *testing.T) {
				err := tc.alertQuery.setQueryType()
				require.NoError(t, err)
				require.Equal(t, "metricQuery", tc.alertQuery.QueryType)
			})

			t.Run("can update model maxDataPoints (if missing)", func(t *testing.T) {
				maxDataPoints, err := tc.alertQuery.getMaxDatapoints()
				require.NoError(t, err)
				require.Equal(t, tc.expectedMaxPoints, maxDataPoints)
			})

			t.Run("can update model intervalMs (if missing)", func(t *testing.T) {
				intervalMS, err := tc.alertQuery.getIntervalMS()
				require.NoError(t, err)
				require.Equal(t, intervalMS, tc.expectedIntervalMS)
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

				i, ok = model["datasourceUid"]
				require.True(t, ok)
				datasourceUID, ok := i.(string)
				require.True(t, ok)
				require.Equal(t, tc.expectedDatasourceUID, datasourceUID)

				i, ok = model["maxDataPoints"]
				require.True(t, ok)
				maxDataPoints, ok := i.(float64)
				require.True(t, ok)
				require.Equal(t, tc.expectedMaxPoints, int64(maxDataPoints))

				i, ok = model["intervalMs"]
				require.True(t, ok)
				intervalMs, ok := i.(float64)
				require.True(t, ok)
				require.Equal(t, tc.expectedIntervalMS, int64(intervalMs))

				i, ok = model["extraParam"]
				require.True(t, ok)
				extraParam, ok := i.(string)
				require.True(t, ok)
				require.Equal(t, "some text", extraParam)
			})
		})
	}
}

func TestAlertQueryMarshalling(t *testing.T) {
	testCases := []struct {
		desc         string
		blob         string
		err          error
		expectedFrom Duration
		expectedTo   Duration
	}{
		{
			desc: "unmarshalling successfully when input is correct",
			blob: `{
				"refId": "B",
				"relativeTimeRange": {
					"from": 18000,
					"to": 10800
				},
				"model": {}
			}`,
			expectedFrom: Duration(5 * time.Hour),
			expectedTo:   Duration(3 * time.Hour),
		},
		{
			desc: "failing unmarshalling gracefully when from is incorrect",
			blob: `{
				"refId": "B",
				"relativeTimeRange": {
					"from": "5h10m",
					"to": 18000
				},
				"model": {}
			}`,
			err: fmt.Errorf("invalid duration 5h10m"),
		},
		{
			desc: "failing unmarshalling gracefully when to is incorrect",
			blob: `{
				"refId": "B",
				"relativeTimeRange": {
					"from": 18000,
					"to": "5h10m"
				},
				"model": {}
			}`,
			err: fmt.Errorf("invalid duration 5h10m"),
		},
	}

	for _, tc := range testCases {
		var aq AlertQuery
		err := json.Unmarshal([]byte(tc.blob), &aq)
		require.Equal(t, tc.err, err)
		if tc.err == nil {
			assert.Equal(t, tc.expectedFrom, aq.RelativeTimeRange.From)
			assert.Equal(t, tc.expectedTo, aq.RelativeTimeRange.To)
		}
	}
}
