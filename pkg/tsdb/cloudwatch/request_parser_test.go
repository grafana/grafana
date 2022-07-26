package cloudwatch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueryJSON(t *testing.T) {
	jsonString := []byte(`{
		"type": "timeSeriesQuery"
	}`)
	var res QueryJson
	err := json.Unmarshal(jsonString, &res)
	require.NoError(t, err)
	assert.Equal(t, "timeSeriesQuery", res.QueryType)
}

func TestRequestParser(t *testing.T) {
	average := "Average"
	false := false
	t.Run("Query migration ", func(t *testing.T) {
		t.Run("legacy statistics field is migrated", func(t *testing.T) {
			oldQuery := &backend.DataQuery{
				MaxDataPoints: 0,
				QueryType:     "timeSeriesQuery",
				Interval:      0,
			}
			oldQuery.RefID = "A"
			oldQuery.JSON = []byte(`{
				"region": "us-east-1",
				"namespace": "ec2",
				"metricName": "CPUUtilization",
				"dimensions": {
				  "InstanceId": ["test"]
				},
				"statistics": ["Average", "Sum"],
				"period": "600",
				"hide": false
			  }`)
			migratedQueries, err := migrateLegacyQuery([]backend.DataQuery{*oldQuery}, false)
			require.NoError(t, err)
			assert.Equal(t, 1, len(migratedQueries))

			migratedQuery := migratedQueries[0]
			assert.Equal(t, "A", migratedQuery.RefID)
			var model QueryJson
			err = json.Unmarshal(migratedQuery.JSON, &model)
			require.NoError(t, err)
			assert.Equal(t, "Average", *model.Statistic)
		})
	})

	t.Run("New dimensions structure", func(t *testing.T) {
		query := QueryJson{
			RefId:      "ref1",
			Region:     "us-east-1",
			Namespace:  "ec2",
			MetricName: "CPUUtilization",
			Id:         "",
			Expression: "",
			Dimensions: map[string]interface{}{
				"InstanceId":   []interface{}{"test"},
				"InstanceType": []interface{}{"test2", "test3"},
			},
			Statistic: &average,
			Period:    "600",
			Hide:      &false,
		}

		res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
		require.NoError(t, err)
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
		query := QueryJson{
			RefId:      "ref1",
			Region:     "us-east-1",
			Namespace:  "ec2",
			MetricName: "CPUUtilization",
			Id:         "",
			Expression: "",
			Dimensions: map[string]interface{}{
				"InstanceId":   []interface{}{"test"},
				"InstanceType": []interface{}{"test2"},
			},
			Statistic: &average,
			Period:    "600",
			Hide:      &false,
		}

		res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
		require.NoError(t, err)
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

	t.Run("Period defined in the editor by the user is being used when time range is short", func(t *testing.T) {
		query := QueryJson{
			RefId:      "ref1",
			Region:     "us-east-1",
			Namespace:  "ec2",
			MetricName: "CPUUtilization",
			Id:         "",
			Expression: "",
			Dimensions: map[string]interface{}{
				"InstanceId":   []interface{}{"test"},
				"InstanceType": []interface{}{"test2"},
			},
			Statistic: &average,
			Period:    "900",
			Hide:      &false,
		}

		res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
		require.NoError(t, err)
		assert.Equal(t, 900, res.Period)
	})

	t.Run("Period is parsed correctly if not defined by user", func(t *testing.T) {
		query := QueryJson{
			RefId:      "ref1",
			Region:     "us-east-1",
			Namespace:  "ec2",
			MetricName: "CPUUtilization",
			Id:         "",
			Expression: "",
			Dimensions: map[string]interface{}{
				"InstanceId":   []interface{}{"test"},
				"InstanceType": []interface{}{"test2"},
			},
			Statistic: &average,
			Hide:      &false,
			Period:    "auto",
		}

		t.Run("Time range is 5 minutes", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.Local().Add(time.Minute * time.Duration(5))

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 60, res.Period)
		})

		t.Run("Time range is 1 day", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(0, 0, -1)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 60, res.Period)
		})

		t.Run("Time range is 2 days", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(0, 0, -2)
			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 300, res.Period)
		})

		t.Run("Time range is 7 days", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(0, 0, -7)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 900, res.Period)
		})

		t.Run("Time range is 30 days", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(0, 0, -30)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 3600, res.Period)
		})

		t.Run("Time range is 90 days", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(0, 0, -90)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 21600, res.Period)
		})

		t.Run("Time range is 1 year", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(-1, 0, 0)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, 21600, res.Period)
		})

		t.Run("Time range is 2 years", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now()
			from := to.AddDate(-2, 0, 0)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 86400, res.Period)
		})

		t.Run("Time range is 2 days, but 16 days ago", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now().AddDate(0, 0, -14)
			from := to.AddDate(0, 0, -2)
			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 300, res.Period)
		})

		t.Run("Time range is 2 days, but 90 days ago", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now().AddDate(0, 0, -88)
			from := to.AddDate(0, 0, -2)
			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 3600, res.Period)
		})

		t.Run("Time range is 2 days, but 456 days ago", func(t *testing.T) {
			query.Period = "auto"
			to := time.Now().AddDate(0, 0, -454)
			from := to.AddDate(0, 0, -2)
			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 21600, res.Period)
		})
	})

	t.Run("Metric query type, metric editor mode and query api mode", func(t *testing.T) {
		t.Run("when metric query type and metric editor mode is not specified", func(t *testing.T) {
			t.Run("it should be metric search builder", func(t *testing.T) {
				query := getBaseJsonQuery()
				res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
				require.NoError(t, err)
				assert.Equal(t, MetricQueryTypeSearch, res.MetricQueryType)
				assert.Equal(t, MetricEditorModeBuilder, res.MetricEditorMode)
				assert.Equal(t, GMDApiModeMetricStat, res.getGMDAPIMode())
			})

			t.Run("and an expression is specified it should be metric search builder", func(t *testing.T) {
				query := getBaseJsonQuery()
				query.Expression = "SUM(a)"
				res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
				require.NoError(t, err)
				assert.Equal(t, MetricQueryTypeSearch, res.MetricQueryType)
				assert.Equal(t, MetricEditorModeRaw, res.MetricEditorMode)
				assert.Equal(t, GMDApiModeMathExpression, res.getGMDAPIMode())
			})
		})

		t.Run("and an expression is specified it should be metric search builder", func(t *testing.T) {
			query := getBaseJsonQuery()
			query.Expression = "SUM(a)"
			res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
			require.NoError(t, err)
			assert.Equal(t, MetricQueryTypeSearch, res.MetricQueryType)
			assert.Equal(t, MetricEditorModeRaw, res.MetricEditorMode)
			assert.Equal(t, GMDApiModeMathExpression, res.getGMDAPIMode())
		})
	})

	t.Run("hide and returnData", func(t *testing.T) {
		t.Run("default", func(t *testing.T) {
			query := getBaseJsonQuery()
			query.QueryType = "timeSeriesQuery"
			res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
			require.NoError(t, err)
			require.True(t, res.ReturnData)
		})
		t.Run("hide is true", func(t *testing.T) {
			query := getBaseJsonQuery()
			query.QueryType = "timeSeriesQuery"
			true := true
			query.Hide = &true
			res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
			require.NoError(t, err)
			require.False(t, res.ReturnData)
		})
		t.Run("hide is false", func(t *testing.T) {
			query := getBaseJsonQuery()
			query.QueryType = "timeSeriesQuery"
			false := false
			query.Hide = &false
			res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
			require.NoError(t, err)
			require.True(t, res.ReturnData)
		})
	})

	t.Run("ID is the string `query` appended with refId if refId is a valid MetricData ID", func(t *testing.T) {
		query := getBaseJsonQuery()
		res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
		require.NoError(t, err)
		assert.Equal(t, "ref1", res.RefId)
		assert.Equal(t, "queryref1", res.Id)
	})

	t.Run("Valid id is generated if ID is not provided and refId is not a valid MetricData ID", func(t *testing.T) {
		query := getBaseJsonQuery()
		query.RefId = "$$"
		res, err := parseRequestQuery(query, "$$", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
		require.NoError(t, err)
		assert.Equal(t, "$$", res.RefId)
		assert.Regexp(t, validMetricDataID, res.Id)
	})

	t.Run("parseRequestQuery sets label when label is present in json query", func(t *testing.T) {
		query := getBaseJsonQuery()
		alias := "some alias"
		query.Alias = &alias

		label := "some label"
		query.Label = &label

		res, err := parseRequestQuery(query, "ref1", time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))

		assert.NoError(t, err)
		assert.Equal(t, "some alias", res.Alias) // alias is unmodified
		assert.Equal(t, "some label", res.Label)
	})
}

func getBaseJsonQuery() QueryJson {
	average := "Average"
	return QueryJson{
		RefId:      "ref1",
		Region:     "us-east-1",
		Namespace:  "ec2",
		MetricName: "CPUUtilization",
		Statistic:  &average,
		Period:     "900",
	}
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

			queryToMigrate := QueryJson{
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Alias:      &tc.inputAlias,
				Dimensions: map[string]interface{}{
					"InstanceId": []interface{}{"test"},
				},
				Statistic: &average,
				Period:    "600",
				Hide:      &false,
			}

			migrateAliasToDynamicLabel(&queryToMigrate)

			expected := QueryJson{
				Alias: &tc.inputAlias,
				Dimensions: map[string]interface{}{
					"InstanceId": []interface{}{"test"},
				},
				Hide:       &false,
				Label:      &tc.expectedLabel,
				MetricName: "CPUUtilization",
				Namespace:  "ec2",
				Period:     "600",
				Region:     "us-east-1",
				Statistic:  &average,
			}

			assert.Equal(t, expected, queryToMigrate)
		})
	}
}
func Test_Test_migrateLegacyQuery(t *testing.T) {
	t.Run("migrates alias to label when label does not already exist and feature toggle enabled", func(t *testing.T) {
		migratedQueries, err := migrateLegacyQuery(
			[]backend.DataQuery{
				{
					RefID:     "A",
					QueryType: "timeSeriesQuery",
					JSON: []byte(`{
					"region": "us-east-1",
					"namespace": "ec2",
					"metricName": "CPUUtilization",
					"alias": "{{period}} {{any_other_word}}",
					"dimensions": {
					  "InstanceId": ["test"]
					},
					"statistic": "Average",
					"period": "600",
					"hide": false
				  }`)},
			}, true)
		require.NoError(t, err)
		require.Equal(t, 1, len(migratedQueries))

		assert.JSONEq(t, `{
		"alias":"{{period}} {{any_other_word}}",
		"label":"${PROP('Period')} ${PROP('Dim.any_other_word')}",
		"dimensions":{
		  "InstanceId":[
			 "test"
		  ]
		},
		"hide":false,
		"metricName":"CPUUtilization",
		"namespace":"ec2",
		"period":"600",
		"region":"us-east-1",
		"statistic":"Average"
		}`,
			string(migratedQueries[0].JSON))
	})

	t.Run("successfully migrates alias to dynamic label for multiple queries", func(t *testing.T) {
		migratedQueries, err := migrateLegacyQuery(
			[]backend.DataQuery{
				{
					RefID:     "A",
					QueryType: "timeSeriesQuery",
					JSON: []byte(`{
					"region": "us-east-1",
					"namespace": "ec2",
					"metricName": "CPUUtilization",
					"alias": "{{period}} {{any_other_word}}",
					"dimensions": {
					  "InstanceId": ["test"]
					},
					"statistic": "Average",
					"period": "600",
					"hide": false
				  }`),
				},
				{
					RefID:     "B",
					QueryType: "timeSeriesQuery",
					JSON: []byte(`{
					"region": "us-east-1",
					"namespace": "ec2",
					"metricName": "CPUUtilization",
					"alias": "{{  label }}",
					"dimensions": {
					  "InstanceId": ["test"]
					},
					"statistic": "Average",
					"period": "600",
					"hide": false
				  }`),
				},
			}, true)
		require.NoError(t, err)
		require.Equal(t, 2, len(migratedQueries))

		assert.JSONEq(t,
			`{
					   "alias": "{{period}} {{any_other_word}}",
					   "label":"${PROP('Period')} ${PROP('Dim.any_other_word')}",
					   "dimensions":{
						  "InstanceId":[
							 "test"
						  ]
					   },
					   "hide":false,
					   "metricName":"CPUUtilization",
					   "namespace":"ec2",
					   "period":"600",
					   "region":"us-east-1",
					   "statistic":"Average"
					}`,
			string(migratedQueries[0].JSON))

		assert.JSONEq(t,
			`{
					   "alias": "{{  label }}",
					   "label":"${LABEL}",
					   "dimensions":{
						  "InstanceId":[
							 "test"
						  ]
					   },
					   "hide":false,
					   "metricName":"CPUUtilization",
					   "namespace":"ec2",
					   "period":"600",
					   "region":"us-east-1",
					   "statistic":"Average"
					}`,
			string(migratedQueries[1].JSON))
	})

	t.Run("does not migrate alias to label", func(t *testing.T) {
		testCases := map[string]struct {
			labelJson                         string
			dynamicLabelsFeatureToggleEnabled bool
		}{
			"when label already exists, feature toggle enabled":     {labelJson: `"label":"some label",`, dynamicLabelsFeatureToggleEnabled: true},
			"when label does not exist, feature toggle is disabled": {dynamicLabelsFeatureToggleEnabled: false},
			"when label already exists, feature toggle is disabled": {labelJson: `"label":"some label",`, dynamicLabelsFeatureToggleEnabled: false},
		}

		for name, tc := range testCases {
			t.Run(name, func(t *testing.T) {
				migratedQueries, err := migrateLegacyQuery(
					[]backend.DataQuery{
						{
							RefID:     "A",
							QueryType: "timeSeriesQuery",
							JSON: []byte(fmt.Sprintf(`{
					"region": "us-east-1",
					"namespace": "ec2",
					"metricName": "CPUUtilization",
					"alias": "{{period}} {{any_other_word}}",
					%s
					"dimensions": {
					  "InstanceId": ["test"]
					},
					"statistic": "Average",
					"period": "600",
					"hide": false
				  }`, tc.labelJson))},
					}, tc.dynamicLabelsFeatureToggleEnabled)
				require.NoError(t, err)
				require.Equal(t, 1, len(migratedQueries))

				assert.JSONEq(t,
					fmt.Sprintf(`{
					   "alias":"{{period}} {{any_other_word}}",
					   %s
					   "dimensions":{
						  "InstanceId":[
							 "test"
						  ]
					   },
					   "hide":false,
					   "metricName":"CPUUtilization",
					   "namespace":"ec2",
					   "period":"600",
					   "region":"us-east-1",
					   "statistic":"Average"
					}`, tc.labelJson),
					string(migratedQueries[0].JSON))
			})
		}
	})
}
