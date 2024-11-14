package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
)

func TestAlertQuery(t *testing.T) {
	testCases := []struct {
		desc                 string
		alertQuery           AlertQuery
		expectedIsExpression bool
		expectedIsHysteresis bool
		expectedDatasource   string
		expectedMaxPoints    int64
		expectedIntervalMS   int64
		err                  error
	}{
		{
			desc: "given an expression query",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
				DatasourceUID: expr.DatasourceUID,
			},
			expectedIsExpression: true,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with valid maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"maxDataPoints": 200,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    200,
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with invalid maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"maxDataPoints": "invalid",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with zero maxDataPoints",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"maxDataPoints": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with valid intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"intervalMs": 2000,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   2000,
		},
		{
			desc: "given a query with invalid intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"intervalMs": "invalid",
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with invalid intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"intervalMs": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with threshold expression",
			alertQuery: AlertQuery{
				RefID:         "A",
				DatasourceUID: expr.DatasourceType,
				Model: json.RawMessage(`{
	                "type": "threshold",
					"queryType": "metricQuery",
					"extraParam": "some text",
	                "conditions": [
		                {
		                  "evaluator": {
		                    "params": [
		                      4
		                    ],
		                    "type": "gt"
		                  }
		                }
		              ]
				}`),
			},
			expectedIsExpression: true,
			expectedIsHysteresis: false,
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
		},
		{
			desc: "given a query with hysteresis expression",
			alertQuery: AlertQuery{
				RefID:         "A",
				DatasourceUID: expr.DatasourceType,
				Model: json.RawMessage(`{
					"type": "threshold",
					"queryType": "metricQuery",
					"extraParam": "some text",
					"conditions": [
		                {
		                  "evaluator": {
		                    "params": [
		                      4
		                    ],
		                    "type": "gt"
		                  },
		                  "unloadEvaluator": {
		                    "params": [
		                      2
		                    ],
		                    "type": "lt"
		                  }
		                }
		              ]
				}`),
			},
			expectedMaxPoints:    int64(defaultMaxDataPoints),
			expectedIntervalMS:   int64(defaultIntervalMS),
			expectedIsExpression: true,
			expectedIsHysteresis: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			t.Run("can recognize if it's an expression", func(t *testing.T) {
				isExpression, err := tc.alertQuery.IsExpression()
				require.NoError(t, err)
				assert.Equal(t, tc.expectedIsExpression, isExpression)
			})

			t.Run("can recognize if it's a hysteresis expression", func(t *testing.T) {
				isExpression, err := tc.alertQuery.IsHysteresisExpression()
				require.NoError(t, err)
				assert.Equal(t, tc.expectedIsHysteresis, isExpression)
			})

			t.Run("can set queryType for expression", func(t *testing.T) {
				err := tc.alertQuery.setQueryType()
				require.NoError(t, err)
				require.Equal(t, "metricQuery", tc.alertQuery.QueryType)
			})

			t.Run("can update model maxDataPoints (if missing)", func(t *testing.T) {
				maxDataPoints, err := tc.alertQuery.GetMaxDatapoints()
				require.NoError(t, err)
				require.Equal(t, tc.expectedMaxPoints, maxDataPoints)
			})

			t.Run("can update model intervalMs (if missing)", func(t *testing.T) {
				intervalMS, err := tc.alertQuery.getIntervalMS()
				require.NoError(t, err)
				require.Equal(t, intervalMS, tc.expectedIntervalMS)
			})

			t.Run("can get the updated model with the default properties (if missing)", func(t *testing.T) {
				blob, err := tc.alertQuery.GetModel()
				require.NoError(t, err)
				model := make(map[string]any)
				err = json.Unmarshal(blob, &model)
				require.NoError(t, err)

				i, ok := model["maxDataPoints"]
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

			if tc.expectedIsHysteresis {
				t.Run("can patch the command with loaded metrics", func(t *testing.T) {
					require.NoError(t, tc.alertQuery.PatchHysteresisExpression(map[data.Fingerprint]struct{}{1: {}, 2: {}, 3: {}}))
					data, ok := tc.alertQuery.modelProps["conditions"].([]any)[0].(map[string]any)["loadedDimensions"]
					require.True(t, ok)
					require.NotNil(t, data)
					_, err := tc.alertQuery.GetModel()
					require.NoError(t, err)
				})
			}
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

func TestAlertQuery_PreSave(t *testing.T) {
	testCases := []struct {
		desc        string
		blob        string
		errContains string
	}{
		{
			desc: "no error when input is correct",
			blob: `{
				"refId": "B",
				"relativeTimeRange": {
					"from": 2000,
					"to": 1000
				},
				"model": {}
			}`,
		},
		{
			desc: "expected error when range is incorrect",
			blob: `{
				"refId": "B",
				"relativeTimeRange": {
					"from": 1000,
					"to": 1000
				},
				"model": {}
			}`,
			errContains: "Invalid alert rule query B: invalid relative time range [From: 16m40s, To: 16m40s]",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			var aq AlertQuery
			err := json.Unmarshal([]byte(tc.blob), &aq)
			require.NoError(t, err)

			err = aq.PreSave()
			if tc.errContains == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, tc.errContains)
			}
		})
	}
}

func TestAlertQuery_GetQuery(t *testing.T) {
	tc := []struct {
		name       string
		alertQuery AlertQuery
		expected   string
		err        error
	}{
		{
			name:       "when a query is present",
			alertQuery: AlertQuery{Model: json.RawMessage(`{"expr": "sum by (job) (up)"}`)},
			expected:   "sum by (job) (up)",
		},
		{
			name:       "when no query is found",
			alertQuery: AlertQuery{Model: json.RawMessage(`{"exprisnot": "sum by (job) (up)"}`)},
			err:        ErrNoQuery,
		},
		{
			name:       "when we're unable to cast the query to a string",
			alertQuery: AlertQuery{Model: json.RawMessage(`{"expr": {"key": 1}}`)},
			err:        errors.New("failed to cast query to string: map[key:1]"),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			expected, err := tt.alertQuery.GetQuery()
			if err != nil {
				require.Equal(t, tt.err, err)
			}
			require.Equal(t, tt.expected, expected)
		})
	}
}
