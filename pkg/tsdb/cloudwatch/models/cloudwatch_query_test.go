package models

import (
	"encoding/json"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

var logger = &logtest.Fake{}

func TestCloudWatchQuery(t *testing.T) {
	t.Run("Deeplink", func(t *testing.T) {
		t.Run("is not generated for MetricQueryTypeQuery", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistic:  "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeQuery,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.BuildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.Empty(t, deepLink)
		})

		t.Run("does not include label in case dynamic label is diabled", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistic:  "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				Label:      "${PROP('Namespace')}",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.BuildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "label")
		})

		t.Run("includes label in case dynamic label is enabled and it's a metric stat query", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistic:  "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				Label:      "${PROP('Namespace')}",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.BuildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "label")
		})

		t.Run("includes label in case dynamic label is enabled and it's a math expression query", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &CloudWatchQuery{
				RefId:            "A",
				Region:           "us-east-1",
				Statistic:        "Average",
				Expression:       "SEARCH(someexpression)",
				Period:           300,
				Id:               "id1",
				MatchExact:       true,
				Label:            "${PROP('Namespace')}",
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeRaw,
			}

			deepLink, err := query.BuildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "label")
		})

		t.Run("includes account id in case its a metric stat query and an account id is set", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistic:  "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				AccountId:  utils.Pointer("123456789"),
				Label:      "${PROP('Namespace')}",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.BuildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.Contains(t, deepLink, "accountId%22%3A%22123456789")
		})

		t.Run("does not include account id in case its not a metric stat query", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &CloudWatchQuery{
				RefId:            "A",
				Region:           "us-east-1",
				Statistic:        "Average",
				Expression:       "SEARCH(someexpression)",
				AccountId:        utils.Pointer("123456789"),
				Period:           300,
				Id:               "id1",
				MatchExact:       true,
				Label:            "${PROP('Namespace')}",
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeRaw,
			}

			deepLink, err := query.BuildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "accountId%22%3A%22123456789")
		})
	})

	t.Run("SEARCH(someexpression) was specified in the query editor", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "SEARCH(someexpression)",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.False(t, query.IsMathExpression(), "Expected not math expression")
	})

	t.Run("No expression, no multi dimension key values and no * was used", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			MatchExact: true,
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678"},
			},
		}

		assert.False(t, query.isSearchExpression(), "Expected not a search expression")
		assert.False(t, query.IsMathExpression(), "Expected not math expressions")
	})

	t.Run("No expression but multi dimension key values exist", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678", "i-34562312"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.False(t, query.IsMathExpression(), "Expected not math expressions")
	})

	t.Run("No expression but dimension values has *", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			Dimensions: map[string][]string{
				"InstanceId":   {"i-12345678", "*"},
				"InstanceType": {"abc", "def"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.False(t, query.IsMathExpression(), "Expected not math expression")
	})

	t.Run("Query has a multi-valued dimension", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			Dimensions: map[string][]string{
				"InstanceId":   {"i-12345678", "i-12345679"},
				"InstanceType": {"abc"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.True(t, query.IsMultiValuedDimensionExpression(), "Expected a multi-valued dimension expression")
	})

	t.Run("No dimensions were added", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			MatchExact: false,
			Dimensions: make(map[string][]string),
		}
		t.Run("Match exact is false", func(t *testing.T) {
			query.MatchExact = false
			assert.True(t, query.isSearchExpression(), "Expected a search expression")
			assert.False(t, query.IsMathExpression(), "Expected not math expression")
		})

		t.Run("Match exact is true", func(t *testing.T) {
			query.MatchExact = true
			assert.False(t, query.isSearchExpression(), "Exxpected not search expression")
			assert.False(t, query.IsMathExpression(), "Expected not math expression")
		})
	})

	t.Run("Match exact is", func(t *testing.T) {
		query := &CloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			MatchExact: false,
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected search expression")
		assert.False(t, query.IsMathExpression(), "Expected not math expression")
	})
}

func TestQueryJSON(t *testing.T) {
	jsonString := []byte(`{
		"type": "timeSeriesQuery"
	}`)
	var res metricsDataQuery
	err := json.Unmarshal(jsonString, &res)
	require.NoError(t, err)
	assert.Equal(t, "timeSeriesQuery", res.QueryType)
}

func TestRequestParser(t *testing.T) {
	t.Run("legacy statistics field is migrated: migrates first stat only", func(t *testing.T) {
		oldQuery := []backend.DataQuery{
			{
				MaxDataPoints: 0,
				QueryType:     "timeSeriesQuery",
				Interval:      0,
				RefID:         "A",
				JSON: json.RawMessage(`{
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "dimensions":{
						"InstanceId": ["test"]
					},
				   "statistics":["Average", "Sum"],
				   "period":"600",
				   "hide":false
				}`),
			},
		}

		migratedQueries, err := ParseMetricDataQueries(oldQuery, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.NoError(t, err)
		require.Len(t, migratedQueries, 1)
		require.NotNil(t, migratedQueries[0])

		migratedQuery := migratedQueries[0]
		assert.Equal(t, "A", migratedQuery.RefId)
		assert.Equal(t, "Average", migratedQuery.Statistic)
	})

	t.Run("New dimensions structure", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				RefID: "ref1",
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "id": "",
				   "expression": "",
				   "dimensions":{
					  "InstanceId":["test"],
					  "InstanceType":["test2","test3"]
				   },
				   "statistic":"Average",
				   "period":"600"
				}`),
			},
		}

		results, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, results, 1)
		res := results[0]
		require.NotNil(t, res)

		assert.Equal(t, "us-east-1", res.Region)
		assert.Equal(t, "ref1", res.RefId)
		assert.Equal(t, "ec2", res.Namespace)
		assert.Equal(t, "CPUUtilization", res.MetricName)
		assert.Equal(t, "queryref1", res.Id)
		assert.Empty(t, res.Expression)
		assert.Equal(t, 600, res.Period)
		assert.True(t, res.ReturnData)
		assert.Len(t, res.Dimensions, 2)
		assert.Len(t, res.Dimensions["InstanceId"], 1)
		assert.Len(t, res.Dimensions["InstanceType"], 2)
		assert.Equal(t, "test3", res.Dimensions["InstanceType"][1])
		assert.Equal(t, "Average", res.Statistic)
	})

	t.Run("Old dimensions structure (backwards compatibility)", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				RefID: "ref1",
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "id": "",
				   "expression": "",
				   "dimensions":{
					  "InstanceId":["test"],
					  "InstanceType":["test2"]
				   },
				   "statistic":"Average",
				   "period":"600",
				   "hide": false
				}`),
			},
		}

		results, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		assert.NoError(t, err)
		require.Len(t, results, 1)
		res := results[0]
		require.NotNil(t, res)

		assert.Equal(t, "us-east-1", res.Region)
		assert.Equal(t, "ref1", res.RefId)
		assert.Equal(t, "ec2", res.Namespace)
		assert.Equal(t, "CPUUtilization", res.MetricName)
		assert.Equal(t, "queryref1", res.Id)
		assert.Empty(t, res.Expression)
		assert.Equal(t, 600, res.Period)
		assert.True(t, res.ReturnData)
		assert.Len(t, res.Dimensions, 2)
		assert.Len(t, res.Dimensions["InstanceId"], 1)
		assert.Len(t, res.Dimensions["InstanceType"], 1)
		assert.Equal(t, "test2", res.Dimensions["InstanceType"][0])
		assert.Equal(t, "Average", res.Statistic)
	})

	t.Run("parseDimensions returns error for non-string type dimension value", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "dimensions":{
					  "InstanceId":3
				   },
				   "statistic":"Average"
				}`),
			},
		}

		_, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.Error(t, err)

		assert.Equal(t, `error parsing query "", failed to parse dimensions: unknown type as dimension value`, err.Error())
	})
}

func Test_ParseMetricDataQueries_periods(t *testing.T) {
	t.Run("Period defined in the editor by the user is being used when time range is short", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "id": "",
				   "expression": "",
				   "dimensions":{
					  "InstanceId":["test"],
					  "InstanceType":["test2"]
				   },
				   "statistic":"Average",
				   "period":"900",
				   "hide":false
				}`),
			},
		}

		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		assert.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		assert.Equal(t, 900, res[0].Period)
	})

	t.Run("Period is parsed correctly if not defined by user", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "id": "",
				   "expression": "",
				   "dimensions":{
					  "InstanceId":["test"],
					  "InstanceType":["test2"]
				   },
				   "statistic":"Average",
				   "hide":false,
				   "period":"auto"
				}`),
			},
		}

		t.Run("Time range is 5 minutes", func(t *testing.T) {
			to := time.Now()
			from := to.Local().Add(time.Minute * time.Duration(5))

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 60, res[0].Period)
		})

		t.Run("Time range is 1 day", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(0, 0, -1)

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 60, res[0].Period)
		})

		t.Run("Time range is 2 days", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(0, 0, -2)
			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 300, res[0].Period)
		})

		t.Run("Time range is 7 days", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(0, 0, -7)

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 900, res[0].Period)
		})

		t.Run("Time range is 30 days", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(0, 0, -30)

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 3600, res[0].Period)
		})

		t.Run("Time range is 90 days", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(0, 0, -90)

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 21600, res[0].Period)
		})

		t.Run("Time range is 1 year", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(-1, 0, 0)

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.Nil(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 21600, res[0].Period)
		})

		t.Run("Time range is 2 years", func(t *testing.T) {
			to := time.Now()
			from := to.AddDate(-2, 0, 0)

			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 86400, res[0].Period)
		})

		t.Run("Time range is 2 days, but 16 days ago", func(t *testing.T) {
			to := time.Now().AddDate(0, 0, -14)
			from := to.AddDate(0, 0, -2)
			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 300, res[0].Period)
		})

		t.Run("Time range is 2 days, but 90 days ago", func(t *testing.T) {
			to := time.Now().AddDate(0, 0, -88)
			from := to.AddDate(0, 0, -2)
			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 3600, res[0].Period)
		})

		t.Run("Time range is 2 days, but 456 days ago", func(t *testing.T) {
			to := time.Now().AddDate(0, 0, -454)
			from := to.AddDate(0, 0, -2)
			res, err := ParseMetricDataQueries(query, from, to, "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			assert.Equal(t, 21600, res[0].Period)
		})
	})
	t.Run("returns error if period is invalid duration", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "statistic":"Average",
				   "period":"invalid"
				}`),
			},
		}
		_, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.Error(t, err)
		assert.Equal(t, `error parsing query "", failed to parse period as duration: time: invalid duration "invalid"`, err.Error())
	})

	t.Run("returns parsed duration in seconds", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "statistic":"Average",
				   "period":"2h45m"
				}`),
			},
		}

		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		assert.NoError(t, err)

		require.Len(t, res, 1)
		assert.Equal(t, 9900, res[0].Period)
	})
}

func Test_ParseMetricDataQueries_query_type_and_metric_editor_mode_and_GMD_query_api_mode(t *testing.T) {
	const dummyTestEditorMode MetricEditorMode = 99
	testCases := map[string]struct {
		extraDataQueryJson       string
		expectedMetricQueryType  MetricQueryType
		expectedMetricEditorMode MetricEditorMode
		expectedGMDApiMode       GMDApiMode
	}{
		"no metric query type, no metric editor mode, no expression": {
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: MetricEditorModeBuilder,
			expectedGMDApiMode:       GMDApiModeMetricStat,
		},
		"no metric query type, no metric editor mode, has expression": {
			extraDataQueryJson:       `"expression":"SUM(a)",`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: MetricEditorModeRaw,
			expectedGMDApiMode:       GMDApiModeMathExpression,
		},
		"no metric query type, has metric editor mode, has expression": {
			extraDataQueryJson:       `"expression":"SUM(a)","metricEditorMode":99,`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: dummyTestEditorMode,
			expectedGMDApiMode:       GMDApiModeMetricStat,
		},
		"no metric query type, has metric editor mode, no expression": {
			extraDataQueryJson:       `"metricEditorMode":99,`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: dummyTestEditorMode,
			expectedGMDApiMode:       GMDApiModeMetricStat,
		},
		"has metric query type, has metric editor mode, no expression": {
			extraDataQueryJson:       `"type":"timeSeriesQuery","metricEditorMode":99,`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: dummyTestEditorMode,
			expectedGMDApiMode:       GMDApiModeMetricStat,
		},
		"has metric query type, no metric editor mode, has expression": {
			extraDataQueryJson:       `"type":"timeSeriesQuery","expression":"SUM(a)",`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: MetricEditorModeRaw,
			expectedGMDApiMode:       GMDApiModeMathExpression,
		},
		"has metric query type, has metric editor mode, has expression": {
			extraDataQueryJson:       `"type":"timeSeriesQuery","metricEditorMode":99,"expression":"SUM(a)",`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: dummyTestEditorMode,
			expectedGMDApiMode:       GMDApiModeMetricStat,
		},
		"no dimensions, matchExact is false": {
			extraDataQueryJson:       `"matchExact":false,`,
			expectedMetricQueryType:  MetricQueryTypeSearch,
			expectedMetricEditorMode: MetricEditorModeBuilder,
			expectedGMDApiMode:       GMDApiModeInferredSearchExpression,
		},
		"query metricQueryType": {
			extraDataQueryJson:       `"metricQueryType":1,`,
			expectedMetricQueryType:  MetricQueryTypeQuery,
			expectedMetricEditorMode: MetricEditorModeBuilder,
			expectedGMDApiMode:       GMDApiModeSQLExpression,
		},
	}
	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			query := []backend.DataQuery{
				{
					JSON: json.RawMessage(fmt.Sprintf(
						`{
						   "refId":"ref1",
						   "region":"us-east-1",
						   "namespace":"ec2",
						   "metricName":"CPUUtilization",
						   "statistic":"Average",
							%s
						   "period":"900"
						}`, tc.extraDataQueryJson),
					),
				},
			}
			res, err := ParseMetricDataQueries(query, time.Now(), time.Now(), "us-east-2", logger, false, false)
			require.NoError(t, err)
			require.Len(t, res, 1)
			require.NotNil(t, res[0])
			assert.Equal(t, tc.expectedMetricQueryType, res[0].MetricQueryType)
			assert.Equal(t, tc.expectedMetricEditorMode, res[0].MetricEditorMode)
			assert.Equal(t, tc.expectedGMDApiMode, res[0].GetGetMetricDataAPIMode())
		})
	}
}

func Test_ParseMetricDataQueries_hide_and_ReturnData(t *testing.T) {
	t.Run("default: when query type timeSeriesQuery, default ReturnData is true", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"900",
				   "type":"timeSeriesQuery"
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		require.True(t, res[0].ReturnData)
	})
	t.Run("when query type is timeSeriesQuery, and hide is true, then ReturnData is false", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"900",
				   "type":"timeSeriesQuery",
				   "hide":true
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		require.False(t, res[0].ReturnData)
	})
	t.Run("when query type is timeSeriesQuery, and hide is false, then ReturnData is true", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"900",
				   "type":"timeSeriesQuery",
				   "hide":false
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		require.True(t, res[0].ReturnData)
	})
	t.Run("when query type is empty, and hide is empty, then ReturnData is true", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"900"
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		require.True(t, res[0].ReturnData)
	})

	t.Run("when query type is empty, and hide is false, then ReturnData is true", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"auto",
				   "hide":false
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		require.True(t, res[0].ReturnData)
	})

	t.Run("when query type is empty, and hide is true, then ReturnData is true", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"auto",
				   "hide":true
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		require.True(t, res[0].ReturnData)
	})
}

func Test_ParseMetricDataQueries_ID(t *testing.T) {
	t.Run("ID is the string `query` appended with refId if refId is a valid MetricData ID", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				RefID: "ref1",
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"900"
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		assert.Equal(t, "ref1", res[0].RefId)
		assert.Equal(t, "queryref1", res[0].Id)
	})
	t.Run("Valid id is generated if ID is not provided and refId is not a valid MetricData ID", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				RefID: "$$",
				JSON: json.RawMessage(`{
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "statistic":"Average",
				   "period":"900",
				   "refId":"$$"
				}`),
			},
		}
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), "us-east-2", logger, false, false)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		assert.Equal(t, "$$", res[0].RefId)
		assert.Regexp(t, validMetricDataID, res[0].Id)
	})
}

func Test_ParseMetricDataQueries_sets_label_when_label_is_present_in_json_query(t *testing.T) {
	query := []backend.DataQuery{
		{
			JSON: json.RawMessage(`{
				   "refId":"A",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "alias":"some alias",
				   "label":"some label",
				   "dimensions":{"InstanceId":["test"]},
				   "statistic":"Average",
				   "period":"600",
				   "hide":false
				}`),
		},
	}

	res, err := ParseMetricDataQueries(query, time.Now(), time.Now(), "us-east-2", logger, true, false)
	assert.NoError(t, err)
	require.Len(t, res, 1)
	require.NotNil(t, res[0])
	assert.Equal(t, "some alias", res[0].Alias) // untouched
	assert.Equal(t, "some label", res[0].Label)
}

func Test_migrateAliasToDynamicLabel_single_query_preserves_old_alias_and_creates_new_label(t *testing.T) {
	testCases := map[string]struct {
		inputAlias    string
		expectedLabel string
	}{
		"one known alias pattern: metric":             {inputAlias: "{{metric}}", expectedLabel: "${PROP('MetricName')}"},
		"one known alias pattern: namespace":          {inputAlias: "{{namespace}}", expectedLabel: "${PROP('Namespace')}"},
		"one known alias pattern: period":             {inputAlias: "{{period}}", expectedLabel: "${PROP('Period')}"},
		"one known alias pattern: region":             {inputAlias: "{{region}}", expectedLabel: "${PROP('Region')}"},
		"one known alias pattern: stat":               {inputAlias: "{{stat}}", expectedLabel: "${PROP('Stat')}"},
		"one known alias pattern: label":              {inputAlias: "{{label}}", expectedLabel: "${LABEL}"},
		"one unknown alias pattern becomes dimension": {inputAlias: "{{any_other_word}}", expectedLabel: "${PROP('Dim.any_other_word')}"},
		"one known alias pattern with spaces":         {inputAlias: "{{ metric   }}", expectedLabel: "${PROP('MetricName')}"},
		"multiple alias patterns":                     {inputAlias: "some {{combination }}{{ label}} and {{metric}}", expectedLabel: "some ${PROP('Dim.combination')}${LABEL} and ${PROP('MetricName')}"},
		"empty alias still migrates to empty label":   {inputAlias: "", expectedLabel: ""},
	}
	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			average := "Average"
			false := false

			queryToMigrate := metricsDataQuery{
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Alias:      tc.inputAlias,
				Dimensions: map[string]interface{}{
					"InstanceId": []interface{}{"test"},
				},
				Statistic: &average,
				Period:    "600",
				Hide:      &false,
			}

			assert.Equal(t, tc.expectedLabel, getLabel(queryToMigrate, true))
		})
	}
}
func Test_ParseMetricDataQueries_migrate_alias_to_label(t *testing.T) {
	t.Run("migrates alias to label when label does not already exist and feature toggle enabled", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: []byte(`{
				   "refId":"A",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "alias":"{{period}} {{any_other_word}}",
				   "dimensions":{"InstanceId":["test"]},
				   "statistic":"Average",
				   "period":"600",
				   "hide":false
				}`),
			},
		}

		res, err := ParseMetricDataQueries(query, time.Now(), time.Now(), "us-east-2", logger, true, false)
		assert.NoError(t, err)

		require.Len(t, res, 1)
		require.NotNil(t, res[0])

		assert.Equal(t, "{{period}} {{any_other_word}}", res[0].Alias)
		assert.Equal(t, "${PROP('Period')} ${PROP('Dim.any_other_word')}", res[0].Label)
		assert.Equal(t, map[string][]string{"InstanceId": {"test"}}, res[0].Dimensions)
		assert.Equal(t, true, res[0].ReturnData)
		assert.Equal(t, "CPUUtilization", res[0].MetricName)
		assert.Equal(t, "ec2", res[0].Namespace)
		assert.Equal(t, 600, res[0].Period)
		assert.Equal(t, "us-east-1", res[0].Region)
		assert.Equal(t, "Average", res[0].Statistic)
	})

	t.Run("successfully migrates alias to dynamic label for multiple queries", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				RefID: "A",
				JSON: json.RawMessage(`{
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "alias":"{{period}} {{any_other_word}}",
				   "dimensions":{"InstanceId":["test"]},
				   "statistic":"Average",
				   "period":"600",
				   "hide":false
				}`),
			},
			{
				RefID: "B",
				JSON: json.RawMessage(`{
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "alias":"{{  label }}",
				   "dimensions":{"InstanceId":["test"]},
				   "statistic":"Average",
				   "period":"600",
				   "hide":false
				}`),
			},
		}

		res, err := ParseMetricDataQueries(query, time.Now(), time.Now(), "us-east-2", logger, true, false)
		assert.NoError(t, err)
		require.Len(t, res, 2)

		sort.Slice(res, func(i, j int) bool {
			return res[i].RefId < res[j].RefId
		})

		require.NotNil(t, res[0])
		assert.Equal(t, "{{period}} {{any_other_word}}", res[0].Alias)
		assert.Equal(t, "${PROP('Period')} ${PROP('Dim.any_other_word')}", res[0].Label)
		assert.Equal(t, map[string][]string{"InstanceId": {"test"}}, res[0].Dimensions)
		assert.Equal(t, true, res[0].ReturnData)
		assert.Equal(t, "CPUUtilization", res[0].MetricName)
		assert.Equal(t, "ec2", res[0].Namespace)
		assert.Equal(t, 600, res[0].Period)
		assert.Equal(t, "us-east-1", res[0].Region)
		assert.Equal(t, "Average", res[0].Statistic)

		require.NotNil(t, res[1])
		assert.Equal(t, "{{  label }}", res[1].Alias)
		assert.Equal(t, "${LABEL}", res[1].Label)
		assert.Equal(t, map[string][]string{"InstanceId": {"test"}}, res[1].Dimensions)
		assert.Equal(t, true, res[1].ReturnData)
		assert.Equal(t, "CPUUtilization", res[1].MetricName)
		assert.Equal(t, "ec2", res[1].Namespace)
		assert.Equal(t, 600, res[1].Period)
		assert.Equal(t, "us-east-1", res[1].Region)
		assert.Equal(t, "Average", res[1].Statistic)
	})

	t.Run("does not migrate alias to label", func(t *testing.T) {
		testCases := map[string]struct {
			labelJson                         string
			dynamicLabelsFeatureToggleEnabled bool
			expectedLabel                     string
		}{
			"when label already exists, feature toggle enabled": {
				labelJson:                         `"label":"some label",`,
				dynamicLabelsFeatureToggleEnabled: true,
				expectedLabel:                     "some label"},
			"when label does not exist, feature toggle is disabled": {
				labelJson:                         "",
				dynamicLabelsFeatureToggleEnabled: false,
				expectedLabel:                     "",
			},
			"when label already exists, feature toggle is disabled": {
				labelJson:                         `"label":"some label",`,
				dynamicLabelsFeatureToggleEnabled: false,
				expectedLabel:                     "some label"},
		}
		for name, tc := range testCases {
			t.Run(name, func(t *testing.T) {
				query := []backend.DataQuery{
					{
						JSON: json.RawMessage(fmt.Sprintf(`{
				   "refId":"A",
				   "region":"us-east-1",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "alias":"{{period}} {{any_other_word}}",
				   %s
				   "dimensions":{"InstanceId":["test"]},
				   "statistic":"Average",
				   "period":"600",
				   "hide":false
				}`, tc.labelJson)),
					},
				}
				res, err := ParseMetricDataQueries(query, time.Now(), time.Now(), "us-east-2", logger, tc.dynamicLabelsFeatureToggleEnabled, false)
				assert.NoError(t, err)

				require.Len(t, res, 1)
				require.NotNil(t, res[0])

				assert.Equal(t, "{{period}} {{any_other_word}}", res[0].Alias)
				assert.Equal(t, tc.expectedLabel, res[0].Label)
				assert.Equal(t, map[string][]string{"InstanceId": {"test"}}, res[0].Dimensions)
				assert.Equal(t, true, res[0].ReturnData)
				assert.Equal(t, "CPUUtilization", res[0].MetricName)
				assert.Equal(t, "ec2", res[0].Namespace)
				assert.Equal(t, 600, res[0].Period)
				assert.Equal(t, "us-east-1", res[0].Region)
				assert.Equal(t, "Average", res[0].Statistic)
			})
		}
	})
}

func Test_ParseMetricDataQueries_statistics_and_query_type_validation_and_MatchExact_initialization(t *testing.T) {
	t.Run("requires statistics or statistic field", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte("{}"),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.Error(t, err)
		assert.Equal(t, `error parsing query "", query must have either statistic or statistics field`, err.Error())

		assert.Nil(t, actual)
	})

	t.Run("ignores query types which are not timeSeriesQuery", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{"type":"some other type", "statistic":"Average", "matchExact":false}`),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.NoError(t, err)

		assert.Empty(t, actual)
	})

	t.Run("accepts empty query type", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{"statistic":"Average"}`),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.NoError(t, err)

		assert.NotEmpty(t, actual)
	})

	t.Run("sets MatchExact nil to MatchExact true", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{"statistic":"Average"}`),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.NoError(t, err)

		assert.Len(t, actual, 1)
		assert.NotNil(t, actual[0])
		assert.True(t, actual[0].MatchExact)
	})

	t.Run("sets MatchExact", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{"statistic":"Average","matchExact":false}`),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.NoError(t, err)

		assert.Len(t, actual, 1)
		assert.NotNil(t, actual[0])
		assert.False(t, actual[0].MatchExact)
	})
}

func Test_ParseMetricDataQueries_account_Id(t *testing.T) {
	t.Run("account is set when cross account querying enabled", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{"accountId":"some account id", "statistic":"Average"}`),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, true)
		assert.NoError(t, err)

		require.Len(t, actual, 1)
		require.NotNil(t, actual[0])
		require.NotNil(t, actual[0].AccountId)
		assert.Equal(t, "some account id", *actual[0].AccountId)
	})

	t.Run("account is not set when cross account querying disabled", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{"accountId":"some account id", "statistic":"Average"}`),
				},
			}, time.Now(), time.Now(), "us-east-2", logger, false, false)
		assert.NoError(t, err)

		require.Len(t, actual, 1)
		require.NotNil(t, actual[0])
		assert.Nil(t, actual[0].AccountId)
	})
}

func Test_ParseMetricDataQueries_default_region(t *testing.T) {
	t.Run("default region is used when when region not set", func(t *testing.T) {
		query := []backend.DataQuery{
			{
				JSON: json.RawMessage(`{
				   "refId":"ref1",
				   "region":"default",
				   "namespace":"ec2",
				   "metricName":"CPUUtilization",
				   "id": "",
				   "expression": "",
				   "dimensions":{
					  "InstanceId":["test"],
					  "InstanceType":["test2"]
				   },
				   "statistic":"Average",
				   "period":"900",
				   "hide":false
				}`),
			},
		}

		region := "us-east-2"
		res, err := ParseMetricDataQueries(query, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour), region, logger, false, false)
		assert.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0])
		assert.Equal(t, region, res[0].Region)
	})
}

func Test_ParseMetricDataQueries_ApplyMacros(t *testing.T) {
	t.Run("should expand $__period_auto macro when a metric search code query is used", func(t *testing.T) {
		timeNow := time.Now()
		testCases := []struct {
			startTime      time.Time
			expectedPeriod string
		}{
			{
				startTime:      timeNow.Add(-2 * time.Hour),
				expectedPeriod: "60",
			},
			{
				startTime:      timeNow.Add(-100 * time.Hour),
				expectedPeriod: "300",
			},
			{
				startTime:      timeNow.Add(-1000 * time.Hour),
				expectedPeriod: "3600",
			},
		}
		for _, tc := range testCases {
			t.Run(fmt.Sprintf("should expand $__period_auto macro to %s when a metric search code query is used", tc.expectedPeriod), func(t *testing.T) {
				actual, err := ParseMetricDataQueries(
					[]backend.DataQuery{
						{
							JSON: []byte(`{
								"refId":"A",
								"region":"us-east-1",
								"namespace":"ec2",
								"metricName":"CPUUtilization",
								"alias":"{{period}} {{any_other_word}}",
								"dimensions":{"InstanceId":["test"]},
								"statistic":"Average",
								"period":"600",
								"hide":false,
								"expression": "SEARCH('{AWS/EC2,InstanceId}', 'Average', $__period_auto)",
								"metricQueryType":  0,
								"metricEditorMode": 1
							 }`),
						},
					}, tc.startTime, time.Now(), "us-east-1", logger, false, false)
				assert.NoError(t, err)
				assert.Equal(t, fmt.Sprintf("SEARCH('{AWS/EC2,InstanceId}', 'Average', %s)", tc.expectedPeriod), actual[0].Expression)
			})
		}
	})

	t.Run("should not expand __period_auto macro if it's a metric query code query", func(t *testing.T) {
		actual, err := ParseMetricDataQueries(
			[]backend.DataQuery{
				{
					JSON: []byte(`{
						"refId":"A",
						"region":"us-east-1",
						"namespace":"ec2",
						"metricName":"CPUUtilization",
						"alias":"{{period}} {{any_other_word}}",
						"dimensions":{"InstanceId":["test"]},
						"statistic":"Average",
						"period":"600",
						"hide":false,
						"expression": "SEARCH('{AWS/EC2,InstanceId}', 'Average', $__period_auto)",
						"metricQueryType":  1,
						"metricEditorMode": 1
					 }`),
				},
			}, time.Now(), time.Now(), "us-east-1", logger, false, false)
		assert.NoError(t, err)
		assert.Equal(t, "SEARCH('{AWS/EC2,InstanceId}', 'Average', $__period_auto)", actual[0].Expression)
	})
}

func TestGetEndpoint(t *testing.T) {
	testcases := []struct {
		region           string
		expectedEndpoint string
	}{
		{"us-east-1", "us-east-1.console.aws.amazon.com"},
		{"us-gov-east-1", "us-gov-east-1.console.amazonaws-us-gov.com"},
		{"cn-northwest-1", "cn-northwest-1.console.amazonaws.cn"},
	}
	for _, ts := range testcases {
		t.Run(fmt.Sprintf("should create correct endpoint for %s", ts), func(t *testing.T) {
			actual := getEndpoint(ts.region)
			assert.Equal(t, ts.expectedEndpoint, actual)
		})
	}
}
