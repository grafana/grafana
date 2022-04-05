package loki

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logqlmodel/stats"
)

func parseResponse(value *loghttp.QueryResponse, query *lokiQuery) (data.Frames, error) {
	frames, err := lokiResponseToDataFrames(value, query)

	if err != nil {
		return nil, err
	}

	for _, frame := range frames {
		adjustFrame(frame, query)
	}

	return frames, nil
}

func lokiResponseToDataFrames(value *loghttp.QueryResponse, query *lokiQuery) (data.Frames, error) {
	stats := parseStats(value.Data.Statistics)
	switch res := value.Data.Result.(type) {
	case loghttp.Matrix:
		return lokiMatrixToDataFrames(res, query, stats), nil
	case loghttp.Vector:
		return lokiVectorToDataFrames(res, query, stats), nil
	case loghttp.Streams:
		return lokiStreamsToDataFrames(res, query, stats), nil
	default:
		return nil, fmt.Errorf("resultType %T not supported{", res)
	}
}

func lokiMatrixToDataFrames(matrix loghttp.Matrix, query *lokiQuery, stats []data.QueryStat) data.Frames {
	frames := data.Frames{}

	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		timeVector := make([]time.Time, 0, len(v.Values))
		values := make([]float64, 0, len(v.Values))

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		for _, k := range v.Values {
			timeVector = append(timeVector, k.Timestamp.Time().UTC())
			values = append(values, float64(k.Value))
		}

		timeField := data.NewField("", nil, timeVector)
		valueField := data.NewField("", tags, values)

		frame := data.NewFrame("", timeField, valueField)
		frame.SetMeta(&data.FrameMeta{
			Stats: stats,
		})

		frames = append(frames, frame)
	}

	return frames
}

func lokiVectorToDataFrames(vector loghttp.Vector, query *lokiQuery, stats []data.QueryStat) data.Frames {
	frames := data.Frames{}

	for _, v := range vector {
		tags := make(map[string]string, len(v.Metric))
		timeVector := []time.Time{v.Timestamp.Time().UTC()}
		values := []float64{float64(v.Value)}

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		timeField := data.NewField("", nil, timeVector)
		valueField := data.NewField("", tags, values)

		frame := data.NewFrame("", timeField, valueField)
		frame.SetMeta(&data.FrameMeta{
			Stats: stats,
		})

		frames = append(frames, frame)
	}

	return frames
}

func lokiStreamsToDataFrames(streams loghttp.Streams, query *lokiQuery, stats []data.QueryStat) data.Frames {
	frames := data.Frames{}

	for _, v := range streams {
		tags := make(map[string]string, len(v.Labels))
		timeVector := make([]time.Time, 0, len(v.Entries))
		values := make([]string, 0, len(v.Entries))

		for k, v := range v.Labels {
			tags[k] = v
		}

		for _, k := range v.Entries {
			timeVector = append(timeVector, k.Timestamp.UTC())
			values = append(values, k.Line)
		}

		timeField := data.NewField("", nil, timeVector)
		valueField := data.NewField("", tags, values)

		frame := data.NewFrame("", timeField, valueField)
		frame.SetMeta(&data.FrameMeta{
			Stats: stats,
		})

		frames = append(frames, frame)
	}

	return frames
}

func parseStats(result stats.Result) []data.QueryStat {
	data := []data.QueryStat{
		makeStat("Summary: bytes processed per second", float64(result.Summary.BytesProcessedPerSecond), "Bps"),
		makeStat("Summary: lines processed per second", float64(result.Summary.LinesProcessedPerSecond), ""),
		makeStat("Summary: total bytes processed", float64(result.Summary.TotalBytesProcessed), "decbytes"),
		makeStat("Summary: total lines processed", float64(result.Summary.TotalLinesProcessed), ""),
		makeStat("Summary: exec time", result.Summary.ExecTime, "s"),
		makeStat("Store: total chunks ref", float64(result.Store.TotalChunksRef), ""),
		makeStat("Store: total chunks downloaded", float64(result.Store.TotalChunksDownloaded), ""),
		makeStat("Store: chunks download time", result.Store.ChunksDownloadTime, "s"),
		makeStat("Store: head chunk bytes", float64(result.Store.HeadChunkBytes), "decbytes"),
		makeStat("Store: head chunk lines", float64(result.Store.HeadChunkLines), ""),
		makeStat("Store: decompressed bytes", float64(result.Store.DecompressedBytes), "decbytes"),
		makeStat("Store: decompressed lines", float64(result.Store.DecompressedLines), ""),
		makeStat("Store: compressed bytes", float64(result.Store.CompressedBytes), "decbytes"),
		makeStat("Store: total duplicates", float64(result.Store.TotalDuplicates), ""),
		makeStat("Ingester: total reached", float64(result.Ingester.TotalReached), ""),
		makeStat("Ingester: total chunks matched", float64(result.Ingester.TotalChunksMatched), ""),
		makeStat("Ingester: total batches", float64(result.Ingester.TotalBatches), ""),
		makeStat("Ingester: total lines sent", float64(result.Ingester.TotalLinesSent), ""),
		makeStat("Ingester: head chunk bytes", float64(result.Ingester.HeadChunkBytes), "decbytes"),
		makeStat("Ingester: head chunk lines", float64(result.Ingester.HeadChunkLines), ""),
		makeStat("Ingester: decompressed bytes", float64(result.Ingester.DecompressedBytes), "decbytes"),
		makeStat("Ingester: decompressed lines", float64(result.Ingester.DecompressedLines), ""),
		makeStat("Ingester: compressed bytes", float64(result.Ingester.CompressedBytes), "decbytes"),
		makeStat("Ingester: total duplicates", float64(result.Ingester.TotalDuplicates), ""),
	}

	// it is not possible to know whether the given statistics was missing, or
	// it's value was zero.
	// we do a heuristic here, if every stat-value is zero, we assume we got no stats-data
	allStatsZero := true
	for _, stat := range data {
		if stat.Value > 0 {
			allStatsZero = false
			break
		}
	}

	if allStatsZero {
		return nil
	}

	return data
}

func makeStat(name string, value float64, unit string) data.QueryStat {
	return data.QueryStat{
		FieldConfig: data.FieldConfig{
			DisplayName: name,
			Unit:        unit,
		},
		Value: value,
	}
}
