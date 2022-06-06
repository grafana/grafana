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
	seriesLabels map[string]string
	labels       map[string]string
	val          float64
	ts           time.Time
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

func (e *exemplarSampler) update(step time.Duration, ts time.Time, val float64, seriesLabels, labels map[string]string) {
	bucketTs := models.AlignTimeRange(ts, step, 0)
	e.trackNewLabels(seriesLabels, labels)
	e.updateAggregations(val)

	ex := exemplar{
		val:          val,
		ts:           ts,
		labels:       labels,
		seriesLabels: seriesLabels,
	}

	if _, exists := e.buckets[bucketTs]; !exists {
		e.buckets[bucketTs] = []exemplar{ex}
		return
	}

	e.buckets[bucketTs] = append(e.buckets[bucketTs], ex)
}

// updateAggregations uses Welford's online algorithm for calculating the mean and variance
// https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm
func (e *exemplarSampler) updateAggregations(val float64) {
	e.count++
	delta := val - e.mean
	e.mean += delta / float64(e.count)
	delta2 := val - e.mean
	e.m2 += delta * delta2
}

// standardDeviation calculates the amount of varation in the data
// https://en.wikipedia.org/wiki/Standard_deviation
func (e *exemplarSampler) standardDeviation() float64 {
	if e.count < 2 {
		return 0
	}
	return math.Sqrt(e.m2 / float64(e.count-1))
}

// trackNewLabels saves label names that haven't been seen before
// so that they can be used to build the label fields in the exemplar frame
func (e *exemplarSampler) trackNewLabels(seriesLabels, labels map[string]string) {
	for k := range labels {
		if _, ok := e.labelSet[k]; !ok {
			e.labelSet[k] = struct{}{}
		}
	}
	for k := range seriesLabels {
		if _, ok := e.labelSet[k]; !ok {
			e.labelSet[k] = struct{}{}
		}
	}
}

// getLabelNames returns sorted unique label names
func (e *exemplarSampler) getLabelNames() []string {
	labelNames := make([]string, 0, len(e.labelSet))
	for k := range e.labelSet {
		labelNames = append(labelNames, k)
	}
	sort.SliceStable(labelNames, func(i, j int) bool {
		return labelNames[i] < labelNames[j]
	})
	return labelNames
}

// getSampledExemplars returns the exemplars sorted by timestamp
func (e *exemplarSampler) getSampledExemplars() []exemplar {
	exemplars := make([]exemplar, 0, len(e.buckets))
	for _, b := range e.buckets {
		// sort by value in descending order
		sort.SliceStable(b, func(i, j int) bool {
			return b[i].val > b[j].val
		})
		sampled := []exemplar{}
		for _, ex := range b {
			if len(sampled) == 0 {
				sampled = append(sampled, ex)
				continue
			}
			// only sample values at least 2 standard deviation distance to previously taken value
			prev := sampled[len(sampled)-1]
			if e.standardDeviation() != 0.0 && prev.val-ex.val > e.standardDeviation()*2.0 {
				sampled = append(sampled, ex)
			}
		}
		exemplars = append(exemplars, sampled...)
	}
	sort.SliceStable(exemplars, func(i, j int) bool {
		return exemplars[i].ts.UnixNano() < exemplars[j].ts.UnixNano()
	})
	return exemplars
}

func processExemplars(q *models.Query, dr *backend.DataResponse) *backend.DataResponse {
	sampler := newExemplarSampler()

	// we are moving from a multi-frame response returned
	// by the converter to a single exemplar frame,
	// so we need to build a new frame array with the
	// old exemplar frames filtered out
	frames := []*data.Frame{}

	// the new exemplar frame will be a single frame in long format
	// with a timestamp, metric value, and one or more label fields
	exemplarFrame := data.NewFrame("exemplar")

	for _, frame := range dr.Frames {
		// we don't need to process non-exemplar frames
		// so they can be added to the response
		if !isExemplarFrame(frame) {
			frames = append(frames, frame)
			continue
		}

		// copy the frame metadata to the new exemplar frame
		exemplarFrame.Meta = frame.Meta
		exemplarFrame.RefID = frame.RefID
		exemplarFrame.Name = frame.Name

		step := time.Duration(frame.Fields[0].Config.Interval) * time.Millisecond
		seriesLabels := getSeriesLabels(frame)
		for rowIdx := 0; rowIdx < frame.Fields[0].Len(); rowIdx++ {
			row := frame.RowCopy(rowIdx)
			ts := row[0].(time.Time)
			val := row[1].(float64)
			labels := getLabels(frame, row)
			sampler.update(step, ts, val, seriesLabels, labels)
		}
	}

	exemplars := sampler.getSampledExemplars()
	if len(exemplars) == 0 {
		return dr
	}

	// init the fields for the new exemplar frame
	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, 0, len(exemplars)))
	valueField := data.NewField(data.TimeSeriesValueFieldName, nil, make([]float64, 0, len(exemplars)))
	exemplarFrame.Fields = append(exemplarFrame.Fields, timeField, valueField)
	labelNames := sampler.getLabelNames()
	for _, labelName := range labelNames {
		exemplarFrame.Fields = append(exemplarFrame.Fields, data.NewField(labelName, nil, make([]string, 0, len(exemplars))))
	}

	// add the sampled exemplars to the new exemplar frame
	for _, b := range exemplars {
		timeField.Append(b.ts)
		valueField.Append(b.val)
		for i, labelName := range labelNames {
			labelValue, ok := b.labels[labelName]
			if !ok {
				// if the label is not present in the exemplar labels, then use the series label
				labelValue = b.seriesLabels[labelName]
			}
			colIdx := i + 2 // +2 to skip time and value fields
			exemplarFrame.Fields[colIdx].Append(labelValue)
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

func getSeriesLabels(frame *data.Frame) data.Labels {
	// series labels are stored on the value field (index 1)
	return frame.Fields[1].Labels.Copy()
}

func getLabels(frame *data.Frame, row []interface{}) map[string]string {
	labels := make(map[string]string)
	for i := 2; i < len(row); i++ {
		labels[frame.Fields[i].Name] = row[i].(string)
	}
	return labels
}
