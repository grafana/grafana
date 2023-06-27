package cloudmonitoring

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	gdata "github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeSeriesQuery(t *testing.T) {
	t.Run("multiple point descriptor is returned", func(t *testing.T) {
		data, err := loadTestFile("./test-data/8-series-response-mql-multiple-point-descriptors.json")
		require.NoError(t, err)
		assert.Equal(t, 0, len(data.TimeSeries))
		assert.Equal(t, 1, len(data.TimeSeriesData))
		assert.Equal(t, 3, len(data.TimeSeriesDescriptor.PointDescriptors))
		fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

		t.Run("and alias template is not specified", func(t *testing.T) {
			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesQuery{
				parameters: &timeSeriesQuery{
					ProjectName: "test-proj",
					Query:       "test-query",
				},
				timeRange: backend.TimeRange{
					From: fromStart,
					To:   fromStart.Add(34 * time.Minute),
				},
			}
			err = query.parseResponse(res, data, "")
			frames := res.Frames
			assert.Equal(t, "grafana-prod asia-northeast1-c 6724404429462225363 200", frames[0].Fields[1].Name)
			assert.Equal(t, 843302441.9, frames[0].Fields[1].At(0))
		})

		t.Run("and alias template is specified", func(t *testing.T) {
			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesQuery{
				parameters: &timeSeriesQuery{
					ProjectName: "test-proj",
					Query:       "test-query",
				},
				aliasBy: "{{project}} - {{resource.label.zone}} - {{resource.label.instance_id}} - {{metric.label.response_code_class}}",
				timeRange: backend.TimeRange{
					From: fromStart,
					To:   fromStart.Add(34 * time.Minute),
				},
			}
			err = query.parseResponse(res, data, "")
			frames := res.Frames
			assert.Equal(t, "test-proj - asia-northeast1-c - 6724404429462225363 - 200", frames[0].Fields[1].Name)
		})
	})
	t.Run("single point descriptor is returned", func(t *testing.T) {
		data, err := loadTestFile("./test-data/7-series-response-mql.json")
		require.NoError(t, err)
		assert.Equal(t, 0, len(data.TimeSeries))
		assert.Equal(t, 1, len(data.TimeSeriesData))
		assert.Equal(t, 1, len(data.TimeSeriesDescriptor.PointDescriptors))

		t.Run("and alias by is expanded", func(t *testing.T) {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

			res := &backend.DataResponse{}
			query := &cloudMonitoringTimeSeriesQuery{
				parameters: &timeSeriesQuery{
					ProjectName: "test-proj",
					Query:       "test-query",
				},
				aliasBy: "{{project}} - {{resource.label.zone}} - {{resource.label.instance_id}} - {{metric.label.response_code_class}}",
				timeRange: backend.TimeRange{
					From: fromStart,
					To:   fromStart.Add(34 * time.Minute),
				},
			}
			err = query.parseResponse(res, data, "")
			require.NoError(t, err)
			frames := res.Frames
			assert.Equal(t, 1, len(res.Frames))
			assert.Equal(t, "test-proj - asia-northeast1-c - 6724404429462225363 - 200", frames[0].Fields[1].Name)
		})
	})

	t.Run("Parse labels", func(t *testing.T) {
		data, err := loadTestFile("./test-data/7-series-response-mql.json")
		require.NoError(t, err)

		fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesQuery{
			parameters: &timeSeriesQuery{
				ProjectName: "test-proj",
				Query:       "test-query",
			},
			timeRange: backend.TimeRange{
				From: fromStart,
				To:   fromStart.Add(34 * time.Minute),
			},
		}
		err = query.parseResponse(res, data, "")
		require.NoError(t, err)
		frames := res.Frames
		custom, ok := frames[0].Meta.Custom.(map[string]interface{})
		require.True(t, ok)
		labels, ok := custom["labels"].(gdata.Labels)
		require.True(t, ok)
		assert.Equal(t, "6724404429462225363", labels["resource.label.instance_id"])
		assert.Equal(t, "test-app", labels["metadata.label.app"])
	})

	t.Run("includes time interval", func(t *testing.T) {
		data, err := loadTestFile("./test-data/7-series-response-mql.json")
		require.NoError(t, err)

		fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
		res := &backend.DataResponse{}
		query := &cloudMonitoringTimeSeriesQuery{
			parameters: &timeSeriesQuery{
				ProjectName: "test-proj",
				Query:       "test-query",
				GraphPeriod: "60s",
			},
			timeRange: backend.TimeRange{
				From: fromStart,
				To:   fromStart.Add(34 * time.Minute),
			},
		}
		err = query.parseResponse(res, data, "")
		require.NoError(t, err)
		frames := res.Frames
		timeField := frames[0].Fields[0]
		assert.Equal(t, float64(60*1000), timeField.Config.Interval)
	})

	t.Run("appends graph_period to the query", func(t *testing.T) {
		query := &cloudMonitoringTimeSeriesQuery{parameters: &timeSeriesQuery{}}
		assert.Equal(t, query.appendGraphPeriod(&backend.QueryDataRequest{Queries: []backend.DataQuery{{}}}), " | graph_period 1ms")
	})

	t.Run("skips graph_period if disabled", func(t *testing.T) {
		query := &cloudMonitoringTimeSeriesQuery{parameters: &timeSeriesQuery{GraphPeriod: "disabled"}}
		assert.Equal(t, query.appendGraphPeriod(&backend.QueryDataRequest{Queries: []backend.DataQuery{{}}}), "")
	})
}
