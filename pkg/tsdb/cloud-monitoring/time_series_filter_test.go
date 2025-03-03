package cloudmonitoring

import (
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	gdata "github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/kinds/dataquery"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeSeriesFilter(t *testing.T) {
	service := &Service{}
	t.Run("parses params", func(t *testing.T) {
		query := &cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{}}
		query.setParams(time.Time{}, time.Time{}, 0, 0)

		assert.Equal(t, "0001-01-01T00:00:00Z", query.params.Get("interval.startTime"))
		assert.Equal(t, "0001-01-01T00:00:00Z", query.params.Get("interval.endTime"))
		assert.Equal(t, "", query.params.Get("filter"))
		assert.Equal(t, "", query.params.Get("view"))
		assert.Equal(t, "+60s", query.params.Get("aggregation.alignmentPeriod"))
		assert.Equal(t, "REDUCE_NONE", query.params.Get("aggregation.crossSeriesReducer"))
		assert.Equal(t, "ALIGN_MEAN", query.params.Get("aggregation.perSeriesAligner"))
		assert.Equal(t, "", query.params.Get("aggregation.groupByFields"))
		assert.Equal(t, "", query.params.Get("secondaryAggregation.alignmentPeriod"))
		assert.Equal(t, "", query.params.Get("secondaryAggregation.crossSeriesReducer"))
		assert.Equal(t, "", query.params.Get("secondaryAggregation.perSeriesAligner"))
		assert.Equal(t, "", query.params.Get("secondaryAggregation.groupByFields"))
	})

	t.Run("parses params with preprocessor", func(t *testing.T) {
		var r dataquery.PreprocessorType = "rate"
		query := &cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{Preprocessor: &r}}
		query.setParams(time.Time{}, time.Time{}, 0, 0)

		assert.Equal(t, "0001-01-01T00:00:00Z", query.params.Get("interval.startTime"))
		assert.Equal(t, "0001-01-01T00:00:00Z", query.params.Get("interval.endTime"))
		assert.Equal(t, "", query.params.Get("filter"))
		assert.Equal(t, "", query.params.Get("view"))
		assert.Equal(t, "+60s", query.params.Get("aggregation.alignmentPeriod"))
		assert.Equal(t, "REDUCE_NONE", query.params.Get("aggregation.crossSeriesReducer"))
		assert.Equal(t, "ALIGN_RATE", query.params.Get("aggregation.perSeriesAligner"))
		assert.Equal(t, "", query.params.Get("aggregation.groupByFields"))
		assert.Equal(t, "", query.params.Get("secondaryAggregation.alignmentPeriod"))
		assert.Equal(t, "REDUCE_NONE", query.params.Get("secondaryAggregation.crossSeriesReducer"))
		assert.Equal(t, "ALIGN_MEAN", query.params.Get("secondaryAggregation.perSeriesAligner"))
		assert.Equal(t, "", query.params.Get("secondaryAggregation.groupByFields"))
	})

	t.Run("when data from query aggregated to one time series", func(t *testing.T) {
		data, err := loadTestFile("./test-data/1-series-response-agg-one-metric.json")
		require.NoError(t, err)
		assert.Equal(t, 1, len(data.TimeSeries))

		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{params: url.Values{}, parameters: &dataquery.TimeSeriesList{}}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		require.Len(t, frames, 1)
		assert.Equal(t, "serviceruntime.googleapis.com/api/request_count", frames[0].Fields[1].Name)
		assert.Equal(t, 3, frames[0].Fields[1].Len())

		assert.Equal(t, 0.05, frames[0].Fields[1].At(0))
		assert.Equal(t, time.Unix(int64(1536670020000/1000), 0).UTC(), frames[0].Fields[0].At(0))

		assert.Equal(t, 1.05, frames[0].Fields[1].At(1))
		assert.Equal(t, time.Unix(int64(1536670080000/1000), 0).UTC(), frames[0].Fields[0].At(1))

		assert.Equal(t, 1.0666666666667, frames[0].Fields[1].At(2))
		assert.Equal(t, time.Unix(int64(1536670260000/1000), 0).UTC(), frames[0].Fields[0].At(2))
	})

	t.Run("when data from query with no aggregation", func(t *testing.T) {
		data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{params: url.Values{}, parameters: &dataquery.TimeSeriesList{}}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)

		field := res.Frames[0].Fields[1]
		assert.Equal(t, 3, field.Len())
		assert.Equal(t, 9.8566497180145, field.At(0))
		assert.Equal(t, 9.7323568146676, field.At(1))
		assert.Equal(t, 9.7730520330369, field.At(2))
		assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1", field.Name)
		assert.Equal(t, "collector-asia-east-1", field.Labels["metric.label.instance_name"])
		assert.Equal(t, "asia-east1-a", field.Labels["resource.label.zone"])
		assert.Equal(t, "grafana-prod", field.Labels["resource.label.project_id"])

		field = res.Frames[1].Fields[1]
		assert.Equal(t, 3, field.Len())
		assert.Equal(t, 9.0238475054502, field.At(0))
		assert.Equal(t, 8.9689492364414, field.At(1))
		assert.Equal(t, 8.8210971239023, field.At(2))
		assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1", field.Name)
		assert.Equal(t, "collector-europe-west-1", field.Labels["metric.label.instance_name"])
		assert.Equal(t, "europe-west1-b", field.Labels["resource.label.zone"])
		assert.Equal(t, "grafana-prod", field.Labels["resource.label.project_id"])

		field = res.Frames[2].Fields[1]
		assert.Equal(t, 3, field.Len())
		assert.Equal(t, 30.829426143318, field.At(0))
		assert.Equal(t, 30.903974115849, field.At(1))
		assert.Equal(t, 30.807846801355, field.At(2))
		assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1", field.Name)
		assert.Equal(t, "collector-us-east-1", field.Labels["metric.label.instance_name"])
		assert.Equal(t, "us-east1-b", field.Labels["resource.label.zone"])
		assert.Equal(t, "grafana-prod", field.Labels["resource.label.project_id"])
	})

	t.Run("when data from query with no aggregation and group bys", func(t *testing.T) {
		data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{params: url.Values{}, parameters: &dataquery.TimeSeriesList{GroupBys: []string{
			"metric.label.instance_name", "resource.label.zone",
		}}}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		require.NoError(t, err)

		assert.Equal(t, 3, len(frames))
		assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1 asia-east1-a", frames[0].Fields[1].Name)
		assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1 europe-west1-b", frames[1].Fields[1].Name)
		assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1 us-east1-b", frames[2].Fields[1].Name)
	})

	t.Run("when data from query with no aggregation and alias by", func(t *testing.T) {
		data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))
		res := &backend.DataResponse{}

		t.Run("and the alias pattern is for metric type, a metric label and a resource label", func(t *testing.T) {
			query := &cloudMonitoringTimeSeriesList{
				params: url.Values{},
				parameters: &dataquery.TimeSeriesList{
					GroupBys: []string{"metric.label.instance_name", "resource.label.zone"},
				},
				aliasBy: "{{metric.type}} - {{metric.label.instance_name}} - {{resource.label.zone}}",
			}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)

			assert.Equal(t, 3, len(frames))
			assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time - collector-asia-east-1 - asia-east1-a", frames[0].Fields[1].Name)
			assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time - collector-europe-west-1 - europe-west1-b", frames[1].Fields[1].Name)
			assert.Equal(t, "compute.googleapis.com/instance/cpu/usage_time - collector-us-east-1 - us-east1-b", frames[2].Fields[1].Name)
		})

		t.Run("and the alias pattern is for metric name", func(t *testing.T) {
			query := &cloudMonitoringTimeSeriesList{
				params:     url.Values{},
				parameters: &dataquery.TimeSeriesList{GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}},
				aliasBy:    "metric {{metric.name}} service {{metric.service}}",
			}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)

			assert.Equal(t, 3, len(frames))
			assert.Equal(t, "metric instance/cpu/usage_time service compute", frames[0].Fields[1].Name)
			assert.Equal(t, "metric instance/cpu/usage_time service compute", frames[1].Fields[1].Name)
			assert.Equal(t, "metric instance/cpu/usage_time service compute", frames[2].Fields[1].Name)
		})
	})

	t.Run("when data from query is distribution with exponential bounds", func(t *testing.T) {
		data, err := loadTestFile("./test-data/3-series-response-distribution-exponential.json")
		require.NoError(t, err)
		assert.Equal(t, 1, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{
			params:     url.Values{},
			parameters: &dataquery.TimeSeriesList{},
			aliasBy:    "{{bucket}}",
		}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		require.NoError(t, err)
		assert.Equal(t, 11, len(frames))
		for i := 0; i < 11; i++ {
			if i == 0 {
				assert.Equal(t, "0", frames[i].Fields[1].Name)
			} else {
				assert.Equal(t, strconv.FormatInt(int64(math.Pow(float64(2), float64(i-1))), 10), frames[i].Fields[1].Name)
			}
			assert.Equal(t, 3, frames[i].Fields[0].Len())
		}

		assert.Equal(t, time.Unix(int64(1536668940000/1000), 0).UTC(), frames[0].Fields[0].At(0))
		assert.Equal(t, time.Unix(int64(1536669000000/1000), 0).UTC(), frames[0].Fields[0].At(1))
		assert.Equal(t, time.Unix(int64(1536669060000/1000), 0).UTC(), frames[0].Fields[0].At(2))

		assert.Equal(t, "0", frames[0].Fields[1].Name)
		assert.Equal(t, "1", frames[1].Fields[1].Name)
		assert.Equal(t, "2", frames[2].Fields[1].Name)
		assert.Equal(t, "4", frames[3].Fields[1].Name)
		assert.Equal(t, "8", frames[4].Fields[1].Name)

		assert.Equal(t, float64(1), frames[8].Fields[1].At(0))
		assert.Equal(t, float64(1), frames[9].Fields[1].At(0))
		assert.Equal(t, float64(1), frames[10].Fields[1].At(0))
		assert.Equal(t, float64(0), frames[8].Fields[1].At(1))
		assert.Equal(t, float64(0), frames[9].Fields[1].At(1))
		assert.Equal(t, float64(1), frames[10].Fields[1].At(1))
		assert.Equal(t, float64(0), frames[8].Fields[1].At(2))
		assert.Equal(t, float64(1), frames[9].Fields[1].At(2))
		assert.Equal(t, float64(0), frames[10].Fields[1].At(2))
	})

	t.Run("when data from query is distribution with explicit bounds", func(t *testing.T) {
		data, err := loadTestFile("./test-data/4-series-response-distribution-explicit.json")
		require.NoError(t, err)
		assert.Equal(t, 1, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{
			params:     url.Values{},
			parameters: &dataquery.TimeSeriesList{},
			aliasBy:    "{{bucket}}",
		}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		require.NoError(t, err)
		assert.Equal(t, 42, len(frames))
		for i := 0; i < 42; i++ {
			if i == 0 {
				assert.Equal(t, "0", frames[i].Fields[1].Name)
			}
			assert.Equal(t, 2, frames[i].Fields[1].Len())
		}

		assert.Equal(t, time.Unix(int64(1550859086000/1000), 0).UTC(), frames[0].Fields[0].At(0))
		assert.Equal(t, time.Unix(int64(1550859146000/1000), 0).UTC(), frames[0].Fields[0].At(1))

		assert.Equal(t, "0", frames[0].Fields[1].Name)
		assert.Equal(t, "0.01", frames[1].Fields[1].Name)
		assert.Equal(t, "0.05", frames[2].Fields[1].Name)
		assert.Equal(t, "0.1", frames[3].Fields[1].Name)

		assert.Equal(t, float64(381), frames[8].Fields[1].At(0))
		assert.Equal(t, float64(212), frames[9].Fields[1].At(0))
		assert.Equal(t, float64(56), frames[10].Fields[1].At(0))
		assert.Equal(t, float64(375), frames[8].Fields[1].At(1))
		assert.Equal(t, float64(213), frames[9].Fields[1].At(1))
		assert.Equal(t, float64(56), frames[10].Fields[1].At(1))
	})

	t.Run("when data from query returns metadata system labels", func(t *testing.T) {
		data, err := loadTestFile("./test-data/5-series-response-meta-data.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{
			params:     url.Values{},
			parameters: &dataquery.TimeSeriesList{},
			aliasBy:    "{{bucket}}",
		}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		require.NoError(t, err)
		assert.Equal(t, 3, len(res.Frames))

		field := res.Frames[0].Fields[1]
		assert.Equal(t, "diana-debian9", field.Labels["metadata.system_labels.name"])
		assert.Equal(t, "value1, value2", field.Labels["metadata.system_labels.test"])
		assert.Equal(t, "us-west1", field.Labels["metadata.system_labels.region"])
		assert.Equal(t, "false", field.Labels["metadata.system_labels.spot_instance"])
		assert.Equal(t, "name1", field.Labels["metadata.user_labels.name"])
		assert.Equal(t, "region1", field.Labels["metadata.user_labels.region"])

		field = res.Frames[1].Fields[1]
		assert.Equal(t, "diana-ubuntu1910", field.Labels["metadata.system_labels.name"])
		assert.Equal(t, "value1, value2, value3", field.Labels["metadata.system_labels.test"])
		assert.Equal(t, "us-west1", field.Labels["metadata.system_labels.region"])
		assert.Equal(t, "false", field.Labels["metadata.system_labels.spot_instance"])

		field = res.Frames[2].Fields[1]
		assert.Equal(t, "premium-plugin-staging", field.Labels["metadata.system_labels.name"])
		assert.Equal(t, "value1, value2, value4, value5", field.Labels["metadata.system_labels.test"])
		assert.Equal(t, "us-central1", field.Labels["metadata.system_labels.region"])
		assert.Equal(t, "true", field.Labels["metadata.system_labels.spot_instance"])
		assert.Equal(t, "name3", field.Labels["metadata.user_labels.name"])
		assert.Equal(t, "region3", field.Labels["metadata.user_labels.region"])
	})

	t.Run("when data from query returns metadata system labels and alias by is defined", func(t *testing.T) {
		data, err := loadTestFile("./test-data/5-series-response-meta-data.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))

		t.Run("and systemlabel contains key with array of string", func(t *testing.T) {
			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesList{
				params:     url.Values{},
				parameters: &dataquery.TimeSeriesList{},
				aliasBy:    "{{metadata.system_labels.test}}",
			}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)
			assert.Equal(t, 3, len(frames))
			fmt.Println(frames[0].Fields[1].Name)
			assert.Equal(t, "value1, value2", frames[0].Fields[1].Name)
			assert.Equal(t, "value1, value2, value3", frames[1].Fields[1].Name)
			assert.Equal(t, "value1, value2, value4, value5", frames[2].Fields[1].Name)
		})

		t.Run("and systemlabel contains key with array of string2", func(t *testing.T) {
			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesList{
				params:     url.Values{},
				parameters: &dataquery.TimeSeriesList{},
				aliasBy:    "{{metadata.system_labels.test2}}",
			}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)
			assert.Equal(t, 3, len(frames))
			assert.Equal(t, "testvalue", frames[2].Fields[1].Name)
		})
	})

	t.Run("Parse cloud monitoring unit", func(t *testing.T) {
		t.Run("when mapping is found a unit should be specified on the field config", func(t *testing.T) {
			data, err := loadTestFile("./test-data/1-series-response-agg-one-metric.json")
			require.NoError(t, err)
			assert.Equal(t, 1, len(data.TimeSeries))
			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesList{params: url.Values{}, parameters: &dataquery.TimeSeriesList{}}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)
			assert.Equal(t, "Bps", frames[0].Fields[1].Config.Unit)
		})

		t.Run("when mapping is found a unit should be specified on the field config", func(t *testing.T) {
			data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
			require.NoError(t, err)
			assert.Equal(t, 3, len(data.TimeSeries))
			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesList{params: url.Values{}, parameters: &dataquery.TimeSeriesList{}}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)
			assert.Equal(t, "", frames[0].Fields[1].Config.Unit)
		})
	})

	t.Run("when data from query returns MQL and alias by is defined", func(t *testing.T) {
		data, err := loadTestFile("./test-data/7-series-response-mql.json")
		require.NoError(t, err)
		assert.Equal(t, 0, len(data.TimeSeries))
		assert.Equal(t, 1, len(data.TimeSeriesData))

		t.Run("and alias by is expanded", func(t *testing.T) {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesQuery{
				parameters: &dataquery.TimeSeriesQuery{
					ProjectName: "test-proj",
					Query:       "test-query",
				},
				aliasBy: "{{project}} - {{resource.label.zone}} - {{resource.label.instance_id}} - {{metric.label.response_code_class}}",
				timeRange: backend.TimeRange{
					From: fromStart,
					To:   fromStart.Add(34 * time.Minute),
				},
			}
			err = query.parseResponse(res, data, "", service.logger)
			require.NoError(t, err)
			frames := res.Frames
			assert.Equal(t, "test-proj - asia-northeast1-c - 6724404429462225363 - 200", frames[0].Fields[1].Name)
		})
	})

	t.Run("field name is filled in for agg statement", func(t *testing.T) {
		data, err := loadTestFile("./test-data/10-series-response-mql-no-labels.json")
		require.NoError(t, err)
		assert.Equal(t, 0, len(data.TimeSeries))
		assert.Equal(t, 1, len(data.TimeSeriesData))

		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesQuery{
			parameters: &dataquery.TimeSeriesQuery{
				Query:       "fetch gce_instance::compute.googleapis.com/instance/cpu/utilization | sum",
				ProjectName: "test",
				GraphPeriod: "60s",
			},
		}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		assert.Equal(t, "value_utilization_sum", res.Frames[0].Fields[1].Name)
	})

	t.Run("Parse labels", func(t *testing.T) {
		data, err := loadTestFile("./test-data/5-series-response-meta-data.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{params: url.Values{}, parameters: &dataquery.TimeSeriesList{}}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		custom, ok := frames[0].Meta.Custom.(map[string]any)
		require.True(t, ok)
		labels, ok := custom["labels"].(gdata.Labels)
		require.True(t, ok)
		assert.Equal(t, "114250375703598695", labels["resource.label.instance_id"])
	})

	t.Run("includes time interval", func(t *testing.T) {
		data, err := loadTestFile("./test-data/5-series-response-meta-data.json")
		require.NoError(t, err)
		assert.Equal(t, 3, len(data.TimeSeries))
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesList{params: url.Values{
			"aggregation.alignmentPeriod": []string{"+60s"},
		}, parameters: &dataquery.TimeSeriesList{}}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		timeField := frames[0].Fields[0]
		assert.Equal(t, float64(60*1000), timeField.Config.Interval)
	})

	t.Run("parseResponse successfully parses metadata for distribution valueType", func(t *testing.T) {
		t.Run("exponential bounds", func(t *testing.T) {
			data, err := loadTestFile("./test-data/3-series-response-distribution-exponential.json")
			require.NoError(t, err)
			assert.Equal(t, 1, len(data.TimeSeries))

			res := &backend.DataResponse{}
			require.NoError(t, (&cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{GroupBys: []string{"test_group_by"}}}).parseResponse(res, data, "test_query", service.logger))

			require.NotNil(t, res.Frames[0].Meta)
			assert.Equal(t, gdata.FrameMeta{
				ExecutedQueryString: "test_query",
				Custom: map[string]any{
					"groupBys":        []string{"test_group_by"},
					"alignmentPeriod": "",
					"labels": gdata.Labels{
						"resource.label.project_id": "grafana-prod",
						"resource.type":             "https_lb_rule",
					},
					"perSeriesAligner": "",
				},
			}, *res.Frames[0].Meta)
		})

		t.Run("explicit bounds", func(t *testing.T) {
			data, err := loadTestFile("./test-data/4-series-response-distribution-explicit.json")
			require.NoError(t, err)
			assert.Equal(t, 1, len(data.TimeSeries))

			res := &backend.DataResponse{}
			require.NoError(t, (&cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{GroupBys: []string{"test_group_by"}}}).parseResponse(res, data, "test_query", service.logger))

			require.NotNil(t, res.Frames[0].Meta)
			assert.Equal(t, gdata.FrameMeta{
				ExecutedQueryString: "test_query",
				Custom: map[string]any{
					"groupBys":        []string{"test_group_by"},
					"alignmentPeriod": "",
					"labels": gdata.Labels{
						"resource.label.project_id": "grafana-demo",
						"resource.type":             "global",
					},
					"perSeriesAligner": "",
				},
			}, *res.Frames[0].Meta)
		})

		t.Run("without series points", func(t *testing.T) {
			data, err := loadTestFile("./test-data/3-series-response-distribution-exponential.json")
			require.NoError(t, err)
			assert.Equal(t, 1, len(data.TimeSeries))

			res := &backend.DataResponse{}
			require.NoError(t, (&cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{GroupBys: []string{"test_group_by"}}}).parseResponse(res, data, "test_query", service.logger))

			require.NotNil(t, res.Frames[0].Meta)
			assert.Equal(t, gdata.FrameMeta{
				ExecutedQueryString: "test_query",
				Custom: map[string]any{
					"groupBys":        []string{"test_group_by"},
					"alignmentPeriod": "",
					"labels": gdata.Labels{
						"resource.label.project_id": "grafana-prod",
						"resource.type":             "https_lb_rule",
					},
					"perSeriesAligner": "",
				},
			}, *res.Frames[0].Meta)
		})
	})

	t.Run("when building filter string", func(t *testing.T) {
		t.Run("and there's no regex operator", func(t *testing.T) {
			t.Run("and there are wildcards in a filter value", func(t *testing.T) {
				tsl := &cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{Filters: []string{"metric.type", "=", "somemetrictype", "AND", "zone", "=", "*-central1*"}}}
				value := tsl.getFilter()
				assert.Equal(t, `metric.type="somemetrictype" zone=has_substring("-central1")`, value)
			})

			t.Run("and there are no wildcards in any filter value", func(t *testing.T) {
				tsl := &cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{Filters: []string{"metric.type", "=", "somemetrictype", "AND", "zone", "!=", "us-central1-a"}}}
				value := tsl.getFilter()
				assert.Equal(t, `metric.type="somemetrictype" zone!="us-central1-a"`, value)
			})
		})

		t.Run("and there is a regex operator", func(t *testing.T) {
			tsl := &cloudMonitoringTimeSeriesList{parameters: &dataquery.TimeSeriesList{Filters: []string{"metric.type", "=", "somemetrictype", "AND", "zone", "=~", "us-central1-a~"}}}
			value := tsl.getFilter()
			assert.NotContains(t, value, `=~`)
			assert.Contains(t, value, `zone=`)

			assert.Contains(t, value, `zone=monitoring.regex.full_match("us-central1-a~")`)
		})
	})

	t.Run("time field is appropriately named", func(t *testing.T) {
		res := &backend.DataResponse{}
		data, err := loadTestFile("./test-data/4-series-response-distribution-explicit.json")
		require.NoError(t, err)
		query := &cloudMonitoringTimeSeriesList{
			parameters: &dataquery.TimeSeriesList{
				ProjectName: "test-proj",
			},
			aliasBy: "",
		}
		err = query.parseResponse(res, data, "", service.logger)
		require.NoError(t, err)
		frames := res.Frames
		assert.Equal(t, gdata.TimeSeriesTimeFieldName, frames[0].Fields[0].Name)
	})
}

func loadTestFile(path string) (cloudMonitoringResponse, error) {
	var data cloudMonitoringResponse

	// Can ignore gosec warning G304 here since it's a test path
	// nolint:gosec
	jsonBody, err := os.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}
