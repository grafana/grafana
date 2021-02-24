package cloudmonitoring

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloudMonitoringExecutor_parseToAnnotations(t *testing.T) {
	d, err := loadTestFile("./test-data/2-series-response-no-agg.json")
	require.NoError(t, err)
	require.Len(t, d.TimeSeries, 3)

	res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "annotationQuery"}
	query := &cloudMonitoringTimeSeriesFilter{}

	err = query.parseToAnnotations(res, d, "atitle {{metric.label.instance_name}} {{metric.value}}", "atext {{resource.label.zone}}", "atag")
	require.NoError(t, err)

	decoded, _ := res.Dataframes.Decoded()
	require.Len(t, decoded, 3)
	assert.Equal(t, "title", decoded[0].Fields[1].Name)
	assert.Equal(t, "tags", decoded[0].Fields[2].Name)
	assert.Equal(t, "text", decoded[0].Fields[3].Name)
}

func TestCloudMonitoringExecutor_parseToAnnotations_emptyTimeSeries(t *testing.T) {
	res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "annotationQuery"}
	query := &cloudMonitoringTimeSeriesFilter{}

	response := cloudMonitoringResponse{
		TimeSeries: []timeSeries{},
	}

	err := query.parseToAnnotations(res, response, "atitle", "atext", "atag")
	require.NoError(t, err)

	decoded, _ := res.Dataframes.Decoded()
	require.Len(t, decoded, 0)
}

func TestCloudMonitoringExecutor_parseToAnnotations_noPointsInSeries(t *testing.T) {
	res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "annotationQuery"}
	query := &cloudMonitoringTimeSeriesFilter{}

	response := cloudMonitoringResponse{
		TimeSeries: []timeSeries{
			{Points: nil},
		},
	}

	err := query.parseToAnnotations(res, response, "atitle", "atext", "atag")
	require.NoError(t, err)

	decoded, _ := res.Dataframes.Decoded()
	require.Len(t, decoded, 0)
}
