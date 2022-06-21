package testdatasource

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func getHeatmapData(query backend.DataQuery) backend.DataResponse {
	rsp := backend.DataResponse{}
	testQuery := &testDataQuery{}
	rsp.Error = json.Unmarshal(query.JSON, testQuery)
	if rsp.Error != nil {
		return rsp
	}
	q := testQuery.Heatmap

	yMin := 1000000000.0
	yMax := -100000000.0

	switch q.Format {
	// standard buckets format
	case "":
		q.Format = "heatmap-rows"
		fallthrough
	case "heatmap-rows":
		fallthrough
	case data.FrameTypeTimeSeriesWide:
		fallthrough
	case data.FrameTypeTimeSeriesMany:
		{
			fn := func(index int) float64 {
				return float64(index * 10)
			}
			if q.Scale == "log2" {
				fn = func(index int) float64 {
					return math.Exp2(float64(index))
				}
			}
			frame := randomHeatmapData(query, func(index int) float64 {
				v := fn(index)
				yMin = math.Min(yMin, v)
				yMax = math.Max(yMax, v)
				return v
			})
			if !q.ExcludeFrameType {
				frame.Meta = &data.FrameMeta{
					Type: data.FrameType(q.Format),
				}
			}

			if q.NumericX {
				count := frame.Fields[0].Len()
				field := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
				field.Name = "X"
				for i := 0; i < count; i++ {
					field.Set(i, int64(i+1))
				}
				frame.Fields[0] = field // replace Time with the numeric value
			}

			if q.Scale == "alpha" {
				char := 'A'
				for i, field := range frame.Fields {
					if i == 0 {
						continue
					}
					field.Name = string(char)
					char++
				}
			}

			// Simulate prometheus labels "le" bucket
			if q.NameAsLabel != "" {
				for i, field := range frame.Fields {
					if i == 0 {
						continue
					}
					field.Labels = data.Labels{
						q.NameAsLabel: field.Name,
					}
					field.Name = ""
				}
			}

			if q.Format == data.FrameTypeTimeSeriesMany {
				for i, field := range frame.Fields {
					if i == 0 {
						continue
					}
					rsp.Frames = append(rsp.Frames, data.NewFrame("", frame.Fields[0], field))
				}
			} else {
				rsp.Frames = append(rsp.Frames, frame)
			}
		}

	// standard buckets format
	default:
		rsp.Error = fmt.Errorf("heatmap format not yet supported: %s", q.Format)
		return rsp
	}

	// Add an exemplars frame
	if q.Exemplars {
		if q.Scale == "alpha" {
			rsp.Frames[0].AppendNotices(data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     "Unable to generate exemplars for alpha scale",
			})
		} else if q.NumericX {
			rsp.Frames[0].AppendNotices(data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     "exemplars not supported for numeric X (yet)",
			})
		} else {
			r := rand.New(rand.NewSource(query.TimeRange.From.Unix()))
			count := 10 + r.Intn(20)
			timeField := data.NewFieldFromFieldType(data.FieldTypeTime, count)
			valueField := data.NewFieldFromFieldType(data.FieldTypeFloat64, count)
			textField := data.NewFieldFromFieldType(data.FieldTypeString, count)

			valueRange := yMax - yMin
			timeRange := query.TimeRange.To.UnixMilli() - query.TimeRange.From.UnixMilli()
			for i := 0; i < count; i++ {
				timeField.Set(i, query.TimeRange.From.Add(time.Duration(r.Int63n(timeRange))*time.Millisecond))
				valueField.Set(i, yMin+(valueRange*r.Float64()))
				textField.Set(i, fmt.Sprintf("exemplar value: %d", i+1))
			}

			rsp.Frames = append(rsp.Frames, data.NewFrame("exemplar", timeField, valueField, textField).SetMeta(&data.FrameMeta{
				// DataTopic = "annotations"
			}))
		}
	}

	return rsp
}

func randomHeatmapData(query backend.DataQuery, fnBucketGen func(index int) float64) *data.Frame {
	frame := data.NewFrame("data", data.NewField("time", nil, []*time.Time{}))
	for i := 0; i < 10; i++ {
		frame.Fields = append(frame.Fields, data.NewField(strconv.FormatInt(int64(fnBucketGen(i)), 10), nil, []*float64{}))
	}

	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)
	r := rand.New(rand.NewSource(timeWalkerMs))

	for j := int64(0); j < 100 && timeWalkerMs < to; j++ {
		t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
		vals := []interface{}{&t}
		for n := 1; n < len(frame.Fields); n++ {
			v := float64(r.Int63n(100))
			vals = append(vals, &v)
		}
		frame.AppendRow(vals...)
		timeWalkerMs += query.Interval.Milliseconds() * 50
	}

	return frame
}
