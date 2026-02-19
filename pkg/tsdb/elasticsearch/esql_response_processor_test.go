package elasticsearch

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

func TestProcessEsqlMetricsResponse_ReturnsTimeSeriesForCountMetric(t *testing.T) {
	response := &es.EsqlResponse{
		Columns: []es.EsqlColumn{
			{Name: "count(*)", Type: "long"},
			{Name: "BUCKET(@timestamp, ...)", Type: "date"},
		},
		Values: [][]interface{}{
			{int64(41679), "2026-02-04T00:00:00.000Z"},
			{int64(83152), "2026-02-05T00:00:00.000Z"},
			{int64(41568), "2026-02-09T00:00:00.000Z"},
		},
	}

	target := &Query{
		RefID:     "A",
		EsqlQuery: "FROM logs* | STATS count(*) by BUCKET(@timestamp, 10, \"2026-02-02T18:00:46.258Z\", \"2026-02-09T18:00:46.258Z\")",
		Metrics: []*MetricAgg{
			{Type: countType},
		},
	}

	res, err := processEsqlMetricsResponse(response, target)
	require.NoError(t, err)
	require.Len(t, res.Frames, 1)

	frame := res.Frames[0]
	require.Equal(t, "Count", frame.Name)
	require.NotNil(t, frame.Meta)
	require.Equal(t, data.FrameTypeTimeSeriesMulti, frame.Meta.Type)
	require.Len(t, frame.Fields, 2)
	require.Equal(t, data.TimeSeriesTimeFieldName, frame.Fields[0].Name)
	require.Equal(t, data.TimeSeriesValueFieldName, frame.Fields[1].Name)

	require.Equal(t, 3, frame.Fields[0].Len())
	require.Equal(t, 3, frame.Fields[1].Len())

	ts1, ok := frame.Fields[0].At(0).(time.Time)
	require.True(t, ok)
	require.Equal(t, time.Date(2026, 2, 4, 0, 0, 0, 0, time.UTC), ts1)

	v1, ok := frame.Fields[1].At(0).(*float64)
	require.True(t, ok)
	require.NotNil(t, v1)
	require.Equal(t, 41679.0, *v1)
}

func TestProcessEsqlMetricsResponse_FallsBackToTableWhenNoTimeColumn(t *testing.T) {
	response := &es.EsqlResponse{
		Columns: []es.EsqlColumn{
			{Name: "count(*)", Type: "long"},
		},
		Values: [][]interface{}{
			{float64(10)},
		},
	}

	target := &Query{
		RefID:     "A",
		EsqlQuery: "FROM logs* | STATS count(*)",
		Metrics: []*MetricAgg{
			{Type: countType},
		},
	}

	res, err := processEsqlMetricsResponse(response, target)
	require.NoError(t, err)
	require.Len(t, res.Frames, 1)

	frame := res.Frames[0]
	require.NotNil(t, frame.Meta)
	require.Equal(t, data.VisType(data.VisTypeTable), frame.Meta.PreferredVisualization)
}

func TestProcessEsqlMetricsResponse_ReturnsEmptySuccessWhenNoStatsCommand(t *testing.T) {
	response := &es.EsqlResponse{
		Columns: []es.EsqlColumn{
			{Name: "@timestamp", Type: "date"},
			{Name: "bytes", Type: "long"},
		},
		Values: [][]interface{}{
			{"2026-02-04T00:00:00.000Z", int64(10)},
		},
	}

	target := &Query{
		RefID:     "A",
		EsqlQuery: "FROM logs* | LIMIT 10",
		Metrics: []*MetricAgg{
			{Type: countType},
		},
	}

	res, err := processEsqlMetricsResponse(response, target)
	require.NoError(t, err)
	require.Empty(t, res.Frames)
}
