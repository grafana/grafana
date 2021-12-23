package prometheus

import (
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

func MatrixToDataFrames(matrix model.Matrix, query *PrometheusQuery, frames data.Frames) data.Frames {
	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, len(v.Values))
		valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(v.Values))

		for i, k := range v.Values {
			timeField.Set(i, time.Unix(k.Timestamp.Unix(), 0).UTC())
			value := float64(k.Value)
			if !math.IsNaN(value) {
				valueField.Set(i, &value)
			}
		}

		name := formatLegend(v.Metric, query)
		timeField.Name = data.TimeSeriesTimeFieldName
		valueField.Name = data.TimeSeriesValueFieldName
		valueField.Config = &data.FieldConfig{DisplayNameFromDS: name}
		valueField.Labels = tags

		frames = append(frames, newDataFrame(name, "matrix", timeField, valueField))
	}

	return frames
}

func ScalarToDataFrames(scalar *model.Scalar, query *PrometheusQuery, frames data.Frames) data.Frames {
	timeVector := []time.Time{time.Unix(scalar.Timestamp.Unix(), 0).UTC()}
	values := []float64{float64(scalar.Value)}
	name := fmt.Sprintf("%g", values[0])

	return append(
		frames,
		newDataFrame(
			name,
			"scalar",
			data.NewField("Time", nil, timeVector),
			data.NewField("Value", nil, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}),
		),
	)
}

func VectorToDataFrames(vector model.Vector, query *PrometheusQuery, frames data.Frames) data.Frames {
	for _, v := range vector {
		name := formatLegend(v.Metric, query)
		tags := make(map[string]string, len(v.Metric))
		timeVector := []time.Time{time.Unix(v.Timestamp.Unix(), 0).UTC()}
		values := []float64{float64(v.Value)}

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		frames = append(
			frames,
			newDataFrame(
				name,
				"vector",
				data.NewField("Time", nil, timeVector),
				data.NewField("Value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}),
			),
		)
	}

	return frames
}

func ExemplarToDataFrames(response []apiv1.ExemplarQueryResult, query *PrometheusQuery, frames data.Frames) data.Frames {
	// TODO: this preallocation is very naive.
	// We should figure out a better approximation here.
	events := make([]ExemplarEvent, 0, len(response)*2)

	for _, exemplarData := range response {
		for _, exemplar := range exemplarData.Exemplars {
			event := ExemplarEvent{}
			exemplarTime := time.Unix(exemplar.Timestamp.Unix(), 0).UTC()
			event.Time = exemplarTime
			event.Value = float64(exemplar.Value)
			event.Labels = make(map[string]string)

			for label, value := range exemplar.Labels {
				event.Labels[string(label)] = string(value)
			}

			for seriesLabel, seriesValue := range exemplarData.SeriesLabels {
				event.Labels[string(seriesLabel)] = string(seriesValue)
			}

			events = append(events, event)
		}
	}

	// Sampling of exemplars
	bucketedExemplars := make(map[string][]ExemplarEvent)
	values := make([]float64, 0, len(events))

	// Create bucketed exemplars based on aligned timestamp
	for _, event := range events {
		alignedTs := fmt.Sprintf("%.0f", math.Floor(float64(event.Time.Unix())/query.Step.Seconds())*query.Step.Seconds())
		_, ok := bucketedExemplars[alignedTs]
		if !ok {
			bucketedExemplars[alignedTs] = make([]ExemplarEvent, 0)
		}

		bucketedExemplars[alignedTs] = append(bucketedExemplars[alignedTs], event)
		values = append(values, event.Value)
	}

	// Calculate standard deviation
	standardDeviation := deviation(values)

	// Create slice with all of the bucketed exemplars
	sampledBuckets := make([]string, len(bucketedExemplars))
	for bucketTimes := range bucketedExemplars {
		sampledBuckets = append(sampledBuckets, bucketTimes)
	}
	sort.Strings(sampledBuckets)

	// Sample exemplars based ona value, so we are not showing too many of them
	sampleExemplars := make([]ExemplarEvent, 0, len(sampledBuckets))
	for _, bucket := range sampledBuckets {
		exemplarsInBucket := bucketedExemplars[bucket]
		if len(exemplarsInBucket) == 1 {
			sampleExemplars = append(sampleExemplars, exemplarsInBucket[0])
		} else {
			bucketValues := make([]float64, len(exemplarsInBucket))
			for _, exemplar := range exemplarsInBucket {
				bucketValues = append(bucketValues, exemplar.Value)
			}
			sort.Slice(bucketValues, func(i, j int) bool {
				return bucketValues[i] > bucketValues[j]
			})

			sampledBucketValues := make([]float64, 0)
			for _, value := range bucketValues {
				if len(sampledBucketValues) == 0 {
					sampledBucketValues = append(sampledBucketValues, value)
				} else {
					// Then take values only when at least 2 standard deviation distance to previously taken value
					prev := sampledBucketValues[len(sampledBucketValues)-1]
					if standardDeviation != 0 && prev-value >= float64(2)*standardDeviation {
						sampledBucketValues = append(sampledBucketValues, value)
					}
				}
			}
			for _, valueBucket := range sampledBucketValues {
				for _, exemplar := range exemplarsInBucket {
					if exemplar.Value == valueBucket {
						sampleExemplars = append(sampleExemplars, exemplar)
					}
				}
			}
		}
	}

	// Create DF from sampled exemplars
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, len(sampleExemplars))
	timeField.Name = "Time"
	valueField := data.NewFieldFromFieldType(data.FieldTypeFloat64, len(sampleExemplars))
	valueField.Name = "Value"
	labelsVector := make(map[string][]string, len(sampleExemplars))

	for i, exemplar := range sampleExemplars {
		timeField.Set(i, exemplar.Time)
		valueField.Set(i, exemplar.Value)

		for label, value := range exemplar.Labels {
			if labelsVector[label] == nil {
				labelsVector[label] = make([]string, 0)
			}

			labelsVector[label] = append(labelsVector[label], value)
		}
	}

	dataFields := make([]*data.Field, 0, len(labelsVector)+2)
	dataFields = append(dataFields, timeField, valueField)
	for label, vector := range labelsVector {
		dataFields = append(dataFields, data.NewField(label, nil, vector))
	}

	return append(frames, newDataFrame("exemplar", "exemplar", dataFields...))
}

func deviation(values []float64) float64 {
	var sum, mean, sd float64
	valuesLen := float64(len(values))
	for _, value := range values {
		sum += value
	}
	mean = sum / valuesLen
	for j := 0; j < len(values); j++ {
		sd += math.Pow(values[j]-mean, 2)
	}
	return math.Sqrt(sd / (valuesLen - 1))
}

func newDataFrame(name string, typ string, fields ...*data.Field) *data.Frame {
	frame := data.NewFrame(name, fields...)
	frame.Meta = &data.FrameMeta{
		Custom: map[string]string{
			"resultType": typ,
		},
	}

	return frame
}
