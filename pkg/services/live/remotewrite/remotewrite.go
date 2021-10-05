package remotewrite

import (
	"fmt"
	"hash/fnv"
	"strings"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/prometheus/prompb"
)

type metricKey uint64

// Serialize frames to Prometheus remote write format.
func Serialize(frames ...*data.Frame) ([]byte, error) {
	return TimeSeriesToBytes(TimeSeriesFromFrames(frames...))
}

// SerializeLabelsColumn frames to Prometheus remote write format.
func SerializeLabelsColumn(frames ...*data.Frame) ([]byte, error) {
	return TimeSeriesToBytes(TimeSeriesFromFramesLabelsColumn(frames...))
}

// TimeSeriesFromFrames converts frames to slice of Prometheus TimeSeries.
func TimeSeriesFromFrames(frames ...*data.Frame) []prompb.TimeSeries {
	var entries = make(map[metricKey]prompb.TimeSeries)
	var keys []metricKey // sorted keys.

	for _, frame := range frames {
		timeFieldIndex, ok := timeFieldIndex(frame)
		if !ok {
			// Skipping frames without time field.
			continue
		}
		for _, field := range frame.Fields {
			if !field.Type().Numeric() {
				continue
			}
			metricName := makeMetricName(frame, field)
			metricName, ok := sanitizeMetricName(metricName)
			if !ok {
				continue
			}

			var samples []prompb.Sample

			labels := createLabels(field.Labels)
			key := makeMetricKey(metricName, labels)

			for i := 0; i < field.Len(); i++ {
				val, ok := field.ConcreteAt(i)
				if !ok {
					continue
				}
				value, ok := sampleValue(val)
				if !ok {
					continue
				}
				tm, ok := frame.Fields[timeFieldIndex].ConcreteAt(i)
				if !ok {
					continue
				}
				sample := prompb.Sample{
					// Timestamp is int milliseconds for remote write.
					Timestamp: toSampleTime(tm.(time.Time)),
					Value:     value,
				}
				samples = append(samples, sample)
			}

			labelsCopy := make([]prompb.Label, len(labels), len(labels)+1)
			copy(labelsCopy, labels)
			labelsCopy = append(labelsCopy, prompb.Label{
				Name:  "__name__",
				Value: metricName,
			})
			promTimeSeries := prompb.TimeSeries{Labels: labelsCopy, Samples: samples}
			entries[key] = promTimeSeries
			keys = append(keys, key)
		}
	}

	var promTimeSeriesBatch = make([]prompb.TimeSeries, 0, len(entries))
	for _, key := range keys {
		promTimeSeriesBatch = append(promTimeSeriesBatch, entries[key])
	}

	return promTimeSeriesBatch
}

// TimeSeriesFromFramesLabelsColumn converts frames to slice of Prometheus TimeSeries.
func TimeSeriesFromFramesLabelsColumn(frames ...*data.Frame) []prompb.TimeSeries {
	var entries = make(map[metricKey]prompb.TimeSeries)
	var keys []metricKey // sorted keys.

	for _, frame := range frames {
		timeFieldIndex, ok := timeFieldIndex(frame)
		if !ok {
			// Skipping frames without time field.
			continue
		}

		// Labels column frames have first column called "labels".
		isLabelsColumnFrame := frame.Fields[0].Type() == data.FieldTypeString && frame.Fields[0].Name == "labels"

		var labels [][]prompb.Label

		if isLabelsColumnFrame {
			labelsField := frame.Fields[0]
			labels = make([][]prompb.Label, labelsField.Len())
			for i := 0; i < labelsField.Len(); i++ {
				val, ok := labelsField.ConcreteAt(i)
				if !ok {
					continue
				}
				parts := strings.Split(val.(string), ", ")
				promLabels := make([]prompb.Label, 0)
				for _, part := range parts {
					labelParts := strings.SplitN(part, "=", 2)
					if len(labelParts) != 2 {
						continue
					}
					promLabels = append(promLabels, prompb.Label{Name: labelParts[0], Value: labelParts[1]})
				}
				labels[i] = promLabels
			}
		}

		for _, field := range frame.Fields {
			if !field.Type().Numeric() {
				continue
			}
			metricName := makeMetricName(frame, field)
			metricName, ok := sanitizeMetricName(metricName)
			if !ok {
				continue
			}

			for i := 0; i < field.Len(); i++ {
				var labelsCopy []prompb.Label
				if isLabelsColumnFrame && labels != nil {
					labelsCopy = make([]prompb.Label, len(labels[i]), len(labels[i])+1)
					copy(labelsCopy, labels[i])
				} else {
					labelsCopy = make([]prompb.Label, 0, len(field.Labels)+1)
					for k, v := range field.Labels {
						labelsCopy = append(labelsCopy, prompb.Label{Name: k, Value: v})
					}
				}

				val, ok := field.ConcreteAt(i)
				if !ok {
					continue
				}
				value, ok := sampleValue(val)
				if !ok {
					continue
				}
				tm, ok := frame.Fields[timeFieldIndex].ConcreteAt(i)
				if !ok {
					continue
				}
				sample := prompb.Sample{
					// Timestamp is int milliseconds for remote write.
					Timestamp: toSampleTime(tm.(time.Time)),
					Value:     value,
				}

				labelsCopy = append(labelsCopy, prompb.Label{
					Name:  "__name__",
					Value: metricName,
				})
				key := makeMetricKey(metricName, labelsCopy)

				promTimeSeries := prompb.TimeSeries{Labels: labelsCopy, Samples: []prompb.Sample{sample}}
				entries[key] = promTimeSeries
				keys = append(keys, key)
			}
		}
	}

	var promTimeSeriesBatch = make([]prompb.TimeSeries, 0, len(entries))
	for _, key := range keys {
		promTimeSeriesBatch = append(promTimeSeriesBatch, entries[key])
	}

	return promTimeSeriesBatch
}

func timeFieldIndex(frame *data.Frame) (int, bool) {
	timeFieldIndex := -1
	for i, field := range frame.Fields {
		if field.Type().Time() {
			timeFieldIndex = i
			break
		}
	}
	return timeFieldIndex, timeFieldIndex > -1
}

func makeMetricName(frame *data.Frame, field *data.Field) string {
	return frame.Name + "_" + field.Name
}

func toSampleTime(tm time.Time) int64 {
	return tm.UnixNano() / int64(time.Millisecond)
}

// TimeSeriesToBytes converts Prometheus TimeSeries to snappy compressed byte slice.
func TimeSeriesToBytes(ts []prompb.TimeSeries) ([]byte, error) {
	writeRequestData, err := proto.Marshal(&prompb.WriteRequest{Timeseries: ts})
	if err != nil {
		return nil, fmt.Errorf("unable to marshal protobuf: %v", err)
	}
	return snappy.Encode(nil, writeRequestData), nil
}

func makeMetricKey(name string, labels []prompb.Label) metricKey {
	h := fnv.New64a()
	_, _ = h.Write([]byte(name))
	for _, label := range labels {
		_, _ = h.Write([]byte(label.Name))
		_, _ = h.Write([]byte("\x00"))
		_, _ = h.Write([]byte(label.Value))
		_, _ = h.Write([]byte("\x00"))
	}
	return metricKey(h.Sum64())
}

func createLabels(fieldLabels map[string]string) []prompb.Label {
	labels := make([]prompb.Label, 0, len(fieldLabels))
	for k, v := range fieldLabels {
		sanitizedName, ok := sanitizeLabelName(k)
		if !ok {
			continue
		}
		labels = append(labels, prompb.Label{Name: sanitizedName, Value: v})
	}
	return labels
}
