package loki

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logqlmodel/stats"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestParseResponse(t *testing.T) {
	t.Run("value is not of supported type", func(t *testing.T) {
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Scalar{},
			},
		}
		res, err := parseResponse(&value, nil)
		require.Equal(t, len(res), 0)
		require.Error(t, err)
	})

	t.Run("response should be parsed normally", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 2, Timestamp: 2000},
			{Value: 3, Timestamp: 3000},
			{Value: 4, Timestamp: 4000},
			{Value: 5, Timestamp: 5000},
		}
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Matrix{
					p.SampleStream{
						Metric: p.Metric{"app": "Application", "tag2": "tag2"},
						Values: values,
					},
				},
			},
		}

		query := &lokiQuery{
			Expr:         "up(ALERTS)",
			QueryType:    QueryTypeRange,
			LegendFormat: "legend {{app}}",
			Step:         time.Second * 42,
		}
		frame, err := parseResponse(&value, query)
		require.NoError(t, err)

		labels, err := data.LabelsFromString("app=Application, tag2=tag2")
		require.NoError(t, err)
		field1 := data.NewField("Time", nil, []time.Time{
			time.Date(1970, 1, 1, 0, 0, 1, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 2, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 3, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 4, 0, time.UTC),
			time.Date(1970, 1, 1, 0, 0, 5, 0, time.UTC),
		})
		field1.Config = &data.FieldConfig{Interval: float64(42000)}
		field2 := data.NewField("Value", labels, []float64{1, 2, 3, 4, 5})
		field2.SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend Application"})
		testFrame := data.NewFrame("legend Application", field1, field2)
		testFrame.SetMeta(&data.FrameMeta{
			ExecutedQueryString: "Expr: up(ALERTS)\nStep: 42s",
			Type:                data.FrameTypeTimeSeriesMany,
		})

		if diff := cmp.Diff(testFrame, frame[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("should set interval-attribute in response", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
		}
		value := loghttp.QueryResponse{
			Data: loghttp.QueryResponseData{
				Result: loghttp.Matrix{
					p.SampleStream{
						Values: values,
					},
				},
			},
		}

		query := &lokiQuery{
			Step:      time.Second * 42,
			QueryType: QueryTypeRange,
		}

		frames, err := parseResponse(&value, query)
		require.NoError(t, err)

		// to keep the test simple, we assume the
		// first field is the time-field
		timeField := frames[0].Fields[0]
		require.NotNil(t, timeField)
		require.Equal(t, data.FieldTypeTime, timeField.Type())

		timeFieldConfig := timeField.Config
		require.NotNil(t, timeFieldConfig)
		require.Equal(t, float64(42000), timeFieldConfig.Interval)
	})

	t.Run("should parse response stats", func(t *testing.T) {
		stats := stats.Result{
			Summary: stats.Summary{
				BytesProcessedPerSecond: 1,
				LinesProcessedPerSecond: 2,
				TotalBytesProcessed:     3,
				TotalLinesProcessed:     4,
				ExecTime:                5.5,
			},
			Store: stats.Store{
				TotalChunksRef:        6,
				TotalChunksDownloaded: 7,
				ChunksDownloadTime:    8.8,
				HeadChunkBytes:        9,
				HeadChunkLines:        10,
				DecompressedBytes:     11,
				DecompressedLines:     12,
				CompressedBytes:       13,
				TotalDuplicates:       14,
			},
			Ingester: stats.Ingester{
				TotalReached:       15,
				TotalChunksMatched: 16,
				TotalBatches:       17,
				TotalLinesSent:     18,
				HeadChunkBytes:     19,
				HeadChunkLines:     20,
				DecompressedBytes:  21,
				DecompressedLines:  22,
				CompressedBytes:    23,
				TotalDuplicates:    24,
			},
		}

		expected := []data.QueryStat{
			{FieldConfig: data.FieldConfig{DisplayName: "Summary: bytes processed per second", Unit: "Bps"}, Value: 1},
			{FieldConfig: data.FieldConfig{DisplayName: "Summary: lines processed per second", Unit: ""}, Value: 2},
			{FieldConfig: data.FieldConfig{DisplayName: "Summary: total bytes processed", Unit: "decbytes"}, Value: 3},
			{FieldConfig: data.FieldConfig{DisplayName: "Summary: total lines processed", Unit: ""}, Value: 4},
			{FieldConfig: data.FieldConfig{DisplayName: "Summary: exec time", Unit: "s"}, Value: 5.5},

			{FieldConfig: data.FieldConfig{DisplayName: "Store: total chunks ref", Unit: ""}, Value: 6},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: total chunks downloaded", Unit: ""}, Value: 7},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: chunks download time", Unit: "s"}, Value: 8.8},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: head chunk bytes", Unit: "decbytes"}, Value: 9},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: head chunk lines", Unit: ""}, Value: 10},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: decompressed bytes", Unit: "decbytes"}, Value: 11},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: decompressed lines", Unit: ""}, Value: 12},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: compressed bytes", Unit: "decbytes"}, Value: 13},
			{FieldConfig: data.FieldConfig{DisplayName: "Store: total duplicates", Unit: ""}, Value: 14},

			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: total reached", Unit: ""}, Value: 15},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: total chunks matched", Unit: ""}, Value: 16},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: total batches", Unit: ""}, Value: 17},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: total lines sent", Unit: ""}, Value: 18},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: head chunk bytes", Unit: "decbytes"}, Value: 19},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: head chunk lines", Unit: ""}, Value: 20},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: decompressed bytes", Unit: "decbytes"}, Value: 21},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: decompressed lines", Unit: ""}, Value: 22},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: compressed bytes", Unit: "decbytes"}, Value: 23},
			{FieldConfig: data.FieldConfig{DisplayName: "Ingester: total duplicates", Unit: ""}, Value: 24},
		}

		result := parseStats((stats))

		// NOTE: i compare it item-by-item otherwise the test-fail-error-message is very hard to read
		require.Len(t, result, len(expected))

		for i := 0; i < len(result); i++ {
			require.Equal(t, expected[i], result[i])
		}
	})
}
