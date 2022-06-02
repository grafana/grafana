package querydata

import (
	"math"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

type exemplar struct {
	labels map[string]string
	val    float64
	ts     time.Time
}

type exemplarSampler struct {
	buckets  map[time.Time][]exemplar
	labelSet map[string]struct{}
	count    int
	mean     float64
	m2       float64
}

func newExemplarSampler() *exemplarSampler {
	return &exemplarSampler{
		buckets:  map[time.Time][]exemplar{},
		labelSet: map[string]struct{}{},
	}
}

func (e *exemplarSampler) update(step time.Duration, ts time.Time, val float64, labels map[string]string) {
	bucketTs := models.AlignTimeRange(ts, step, 0)
	e.saveNewLabels(labels)

	b, exists := e.buckets[bucketTs]
	if !exists || len(b) == 0 {
		e.buckets[bucketTs] = []exemplar{{
			val:    val,
			labels: labels,
			ts:     ts,
		}}
		return
	}

	stddev := e.getStandardDeviation()
	previous := b[len(b)-1].val
	if stddev != 0 && previous-val >= float64(2)*stddev {
		e.buckets[bucketTs] = append(e.buckets[bucketTs], exemplar{
			val:    val,
			labels: labels,
			ts:     ts,
		})
		sort.Slice(e.buckets[bucketTs], func(i, j int) bool {
			return e.buckets[bucketTs][i].val < e.buckets[bucketTs][j].val
		})
		e.updateAggregations(val)
	}
}

func (e *exemplarSampler) updateAggregations(val float64) {
	e.count++
	delta := val - e.mean
	e.mean += delta / float64(e.count)
	delta2 := val - e.mean
	e.m2 += math.Pow(delta*delta2, 2)
}

func (e *exemplarSampler) getStandardDeviation() float64 {
	if e.count < 2 {
		return 0
	}
	return e.m2 / float64(e.count-1)
}

func (e *exemplarSampler) saveNewLabels(labels map[string]string) {
	for k := range labels {
		if _, ok := e.labelSet[k]; !ok {
			e.labelSet[k] = struct{}{}
		}
	}
}

func (e *exemplarSampler) getLabelNames() []string {
	labelNames := make([]string, 0, len(e.labelSet))
	for k := range e.labelSet {
		labelNames = append(labelNames, k)
	}
	sort.Strings(labelNames)
	return labelNames
}

func (e *exemplarSampler) getBucketTimestamps() []time.Time {
	ts := make([]time.Time, 0, len(e.buckets))
	for k := range e.buckets {
		ts = append(ts, k)
	}
	sort.Slice(ts, func(i, j int) bool {
		return ts[i].Before(ts[j])
	})
	return ts
}

func processExemplars(q *models.Query, dr *backend.DataResponse) *backend.DataResponse {
	frames := []*data.Frame{}
	sampler := newExemplarSampler()
	exemplarFrame := data.NewFrame("")

	for _, frame := range dr.Frames {
		if !isExemplarFrame(frame) {
			frames = append(frames, frame)
			continue
		}

		exemplarFrame.Meta = frame.Meta
		exemplarFrame.RefID = frame.RefID
		exemplarFrame.Name = frame.Name

		for rowIdx := 0; rowIdx < frame.Fields[0].Len(); rowIdx++ {
			ts, val, ok := getTimeValuePair(frame, rowIdx)
			labels := getLabels(frame, rowIdx)
			step := time.Duration(frame.Fields[0].Config.Interval) * time.Millisecond
			if !ok {
				continue
			}
			sampler.update(step, ts, val, labels)
		}
	}

	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, 0, len(sampler.buckets)))
	valueField := data.NewField(data.TimeSeriesValueFieldName, nil, make([]float64, 0, len(sampler.buckets)))
	exemplarFrame.Fields = append(exemplarFrame.Fields, timeField, valueField)

	labelNames := sampler.getLabelNames()
	for _, labelName := range labelNames {
		exemplarFrame.Fields = append(exemplarFrame.Fields, data.NewField(labelName, nil, make([]string, 0, len(sampler.buckets))))
	}

	for _, ts := range sampler.getBucketTimestamps() {
		for _, b := range sampler.buckets[ts] {
			timeField.Append(b.ts)
			valueField.Append(b.val)
			for i, labelName := range labelNames {
				colIdx := i + 2 // +2 to skip time and value fields
				labelValue, ok := b.labels[labelName]
				if !ok {
					labelValue = ""
				}
				exemplarFrame.Fields[colIdx].Append(labelValue)
			}
		}
	}

	frames = append(frames, exemplarFrame)

	return &backend.DataResponse{
		Frames: frames,
		Error:  dr.Error,
	}
}

func isExemplarFrame(frame *data.Frame) bool {
	rt := models.ResultTypeFromFrame(frame)
	return rt == models.ResultTypeExemplar
}

func getLabels(frame *data.Frame, rowIdx int) map[string]string {
	labels := map[string]string{}
	for _, f := range frame.Fields {
		for k, v := range f.Labels {
			labels[k] = v
		}

		if f.Type() == data.FieldTypeString {
			if v, ok := f.At(rowIdx).(string); ok {
				labels[f.Name] = v
			}
		}
	}
	return labels
}

func getTimeValuePair(frame *data.Frame, rowIdx int) (time.Time, float64, bool) {
	ts, ok := frame.Fields[0].At(rowIdx).(time.Time)
	if !ok {
		return time.Time{}, 0, false
	}
	val, ok := frame.Fields[1].At(rowIdx).(float64)
	if !ok {
		return time.Time{}, 0, false
	}
	return ts, val, true
}
