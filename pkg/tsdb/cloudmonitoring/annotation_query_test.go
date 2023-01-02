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

	err = parseToAnnotations("anno", res, d, "atitle {{metric.label.instance_name}} {{metric.value}}",
		"atext {{resource.label.zone}}")
	require.NoError(t, err)

	require.Len(t, res.Frames, 1)
	assert.Equal(t, "time", res.Frames[0].Fields[0].Name)
	assert.Equal(t, "title", res.Frames[0].Fields[1].Name)
	assert.Equal(t, "tags", res.Frames[0].Fields[2].Name)
	assert.Equal(t, "text", res.Frames[0].Fields[3].Name)
	assert.Equal(t, 9, res.Frames[0].Fields[0].Len())
	assert.Equal(t, 9, res.Frames[0].Fields[1].Len())
	assert.Equal(t, 9, res.Frames[0].Fields[2].Len())
	assert.Equal(t, 9, res.Frames[0].Fields[3].Len())
}

func TestCloudMonitoringExecutor_parseToAnnotations_emptyTimeSeries(t *testing.T) {
	res := &backend.DataResponse{}

	response := cloudMonitoringResponse{
		TimeSeries: []timeSeries{},
	}

	err := parseToAnnotations("anno", res, response, "atitle", "atext")
	require.NoError(t, err)

	require.Len(t, res.Frames, 1)
	assert.Equal(t, "time", res.Frames[0].Fields[0].Name)
	assert.Equal(t, "title", res.Frames[0].Fields[1].Name)
	assert.Equal(t, "tags", res.Frames[0].Fields[2].Name)
	assert.Equal(t, "text", res.Frames[0].Fields[3].Name)
	assert.Equal(t, 0, res.Frames[0].Fields[0].Len())
	assert.Equal(t, 0, res.Frames[0].Fields[1].Len())
	assert.Equal(t, 0, res.Frames[0].Fields[2].Len())
	assert.Equal(t, 0, res.Frames[0].Fields[3].Len())
}

func TestCloudMonitoringExecutor_parseToAnnotations_noPointsInSeries(t *testing.T) {
	res := &backend.DataResponse{}

	response := cloudMonitoringResponse{
		TimeSeries: []timeSeries{
			{Points: nil},
		},
	}

	err := parseToAnnotations("anno", res, response, "atitle", "atext")
	require.NoError(t, err)

	require.Len(t, res.Frames, 1)
	assert.Equal(t, "time", res.Frames[0].Fields[0].Name)
	assert.Equal(t, "title", res.Frames[0].Fields[1].Name)
	assert.Equal(t, "tags", res.Frames[0].Fields[2].Name)
	assert.Equal(t, "text", res.Frames[0].Fields[3].Name)
	assert.Equal(t, 0, res.Frames[0].Fields[0].Len())
	assert.Equal(t, 0, res.Frames[0].Fields[1].Len())
	assert.Equal(t, 0, res.Frames[0].Fields[2].Len())
	assert.Equal(t, 0, res.Frames[0].Fields[3].Len())
}
