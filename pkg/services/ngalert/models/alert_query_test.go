package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
)

func TestAlertQuery(t *testing.T) {
	testCases := []struct {
		desc                 string
		alertQuery           AlertQuery
		expectedIsExpression bool
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
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
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
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
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
			expectedIntervalMS:   defaultIntervalMS,
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
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
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
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
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
			expectedMaxPoints:    defaultMaxDataPoints,
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
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
		},
		{
			desc: "given a query with zero intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"intervalMs": 0,
					"extraParam": "some text"
				}`),
			},
			expectedIsExpression: false,
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
		},
		{
			desc: "given a query with short time range and no intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
				RelativeTimeRange: RelativeTimeRange{
					From: Duration(time.Duration(5) * time.Minute),
					To:   Duration(0),
				},
			},
			expectedIsExpression: false,
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   defaultIntervalMS,
		},
		{
			desc: "given a query with long time range and no intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"extraParam": "some text"
				}`),
				RelativeTimeRange: RelativeTimeRange{
					From: Duration(time.Duration(24) * time.Hour),
					To:   Duration(0),
				},
			},
			expectedIsExpression: false,
			expectedMaxPoints:    defaultMaxDataPoints,
			expectedIntervalMS:   2000,
		},
		{
			desc: "given a query with long time range, custom maxDataPoints, and no intervalMs",
			alertQuery: AlertQuery{
				RefID: "A",
				Model: json.RawMessage(`{
					"queryType": "metricQuery",
					"maxDataPoints": 24,
					"extraParam": "some text"
				}`),
				RelativeTimeRange: RelativeTimeRange{
					From: Duration(time.Duration(24) * time.Hour),
					To:   Duration(0),
				},
			},
			expectedIsExpression: false,
			expectedMaxPoints:    24,
			expectedIntervalMS:   (time.Duration(1) * time.Hour).Milliseconds(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			t.Run("can recognize if it's an expression", func(t *testing.T) {
				isExpression := tc.alertQuery.IsExpression()
				assert.Equal(t, tc.expectedIsExpression, isExpression)
			})

			t.Run("PreSave sets queryType for expression", func(t *testing.T) {
				err := tc.alertQuery.PreSave()
				require.NoError(t, err)
				require.Equal(t, "metricQuery", tc.alertQuery.QueryType)
			})

			t.Run("can update model maxDataPoints (if missing)", func(t *testing.T) {
				model, err := tc.alertQuery.CalculateModel()
				require.NoError(t, err)
				maxDataPoints, err := model.GetMaxDataPoints()
				require.NoError(t, err)
				require.Equal(t, tc.expectedMaxPoints, maxDataPoints)
			})

			t.Run("can update model intervalMs (if missing)", func(t *testing.T) {
				model, err := tc.alertQuery.CalculateModel()
				require.NoError(t, err)
				interval, err := model.GetIntervalDuration()
				require.NoError(t, err)
				require.Equal(t, interval.Milliseconds(), tc.expectedIntervalMS)
			})

			t.Run("can get the updated model with the default properties (if missing)", func(t *testing.T) {
				model, err := tc.alertQuery.CalculateModel()
				require.NoError(t, err)

				maxDataPoints, ok := model["maxDataPoints"]
				require.True(t, ok)
				require.EqualValues(t, tc.expectedMaxPoints, maxDataPoints)

				intervalMs, ok := model["intervalMs"]
				require.True(t, ok)
				require.EqualValues(t, tc.expectedIntervalMS, intervalMs)

				i, ok := model["extraParam"]
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
			model, err := tt.alertQuery.CalculateModel()
			require.NoError(t, err)
			expected, err := model.GetQuery()
			if err != nil {
				require.Equal(t, tt.err, err)
			}
			require.Equal(t, tt.expected, expected)
		})
	}
}
