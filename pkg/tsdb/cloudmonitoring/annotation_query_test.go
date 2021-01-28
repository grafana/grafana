package cloudmonitoring

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloudMonitoringExecutor_parseToAnnotations(t *testing.T) {
	data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
	require.NoError(t, err)
	require.Len(t, data.TimeSeries, 3)

	res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "annotationQuery"}
	query := &cloudMonitoringTimeSeriesFilter{}

	err = query.parseToAnnotations(res, data, "atitle {{metric.label.instance_name}} {{metric.value}}", "atext {{resource.label.zone}}", "atag")
	require.NoError(t, err)

	require.Len(t, res.Tables, 1)
	require.Len(t, res.Tables[0].Rows, 9)
	assert.Equal(t, "atitle collector-asia-east-1 9.856650", res.Tables[0].Rows[0][1])
	assert.Equal(t, "atext asia-east1-a", res.Tables[0].Rows[0][3])
}
