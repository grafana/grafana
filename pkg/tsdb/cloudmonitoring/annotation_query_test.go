package cloudmonitoring

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExecutor_parseToAnnotations(t *testing.T) {
	d, err := loadTestFile("./test-data/2-series-response-no-agg.json")
	require.NoError(t, err)
	require.Len(t, d.TimeSeries, 3)

	res := &backend.DataResponse{}
	query := &cloudMonitoringTimeSeriesFilter{}

	err = query.parseToAnnotations(res, d, "atitle {{metric.label.instance_name}} {{metric.value}}",
		"atext {{resource.label.zone}}")
	require.NoError(t, err)

	require.Len(t, res.Frames, 3)
	assert.Equal(t, "title", res.Frames[0].Fields[1].Name)
	assert.Equal(t, "tags", res.Frames[0].Fields[2].Name)
	assert.Equal(t, "text", res.Frames[0].Fields[3].Name)
}

func TestCloudMonitoringExecutor_parseToAnnotations_emptyTimeSeries(t *testing.T) {
	res := &backend.DataResponse{}
	query := &cloudMonitoringTimeSeriesFilter{}

	response := cloudMonitoringResponse{
		TimeSeries: []timeSeries{},
	}

	err := query.parseToAnnotations(res, response, "atitle", "atext")
	require.NoError(t, err)

	require.Len(t, res.Frames, 0)
}

func TestCloudMonitoringExecutor_parseToAnnotations_noPointsInSeries(t *testing.T) {
	res := &backend.DataResponse{}
	query := &cloudMonitoringTimeSeriesFilter{}

	response := cloudMonitoringResponse{
		TimeSeries: []timeSeries{
			{Points: nil},
		},
	}

	err := query.parseToAnnotations(res, response, "atitle", "atext")
	require.NoError(t, err)

	require.Len(t, res.Frames, 0)
}
