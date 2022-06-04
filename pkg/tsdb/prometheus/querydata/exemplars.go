package querydata

import (
	"math"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

var zScoreDeviations = 3.0

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
	e.trackNewLabels(labels)
	e.updateAggregations(val)

	ex := exemplar{
		val:    val,
		ts:     ts,
		labels: labels,
	}

	if _, exists := e.buckets[bucketTs]; !exists {
		e.buckets[bucketTs] = []exemplar{ex}
		return
	}

	// only keep exemplars that have a z-score above the standard deviation threshold
	// in the future it might be useful to make it configurable
	if e.shouldSample(val, zScoreDeviations) {
		e.buckets[bucketTs] = append(e.buckets[bucketTs], ex)
	}
}

// shouldSample returns true if the given exemplar should be sampled
func (e *exemplarSampler) shouldSample(val float64, deviations float64) bool {
	if e.standardDeviation() == 0 {
		return false
	}
	return e.zScore(val) >= deviations
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

// stadardDeviation calculates the amount of varation in the data
// https://en.wikipedia.org/wiki/Standard_deviation
func (e *exemplarSampler) standardDeviation() float64 {
	if e.count < 2 {
		return 0
	}
	return math.Sqrt(e.m2 / float64(e.count-1))
}

// zScore calculates the number of standard deviations above or below the mean
// https://en.wikipedia.org/wiki/Standard_score
func (e *exemplarSampler) zScore(val float64) float64 {
	return math.Abs(val-e.mean) / e.standardDeviation()
}

// trackNewLabels saves label names that haven't been seen before
// so that they can be used to build the label fields in the exemplar frame
func (e *exemplarSampler) trackNewLabels(labels map[string]string) {
	for k := range labels {
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

// getExemplars returns the sampled exemplars sorted by timestamp
func (e *exemplarSampler) getExemplars() []exemplar {
	exemplars := make([]exemplar, 0, len(e.buckets))
	for _, b := range e.buckets {
		exemplars = append(exemplars, b...)
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
		for rowIdx := 0; rowIdx < frame.Fields[0].Len(); rowIdx++ {
			ts, val, ok := getTimeValuePair(frame, rowIdx)
			if !ok {
				continue
			}
			labels := getLabels(frame, rowIdx)
			sampler.update(step, ts, val, labels)
		}
	}

	exemplars := sampler.getExemplars()
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
			labelValue := b.labels[labelName]
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

func getLabels(frame *data.Frame, rowIdx int) map[string]string {
	labels := map[string]string{}
	for _, f := range frame.Fields {
		// series labels are stored as field labels
		for k, v := range f.Labels {
			labels[k] = v
		}

		// exemplar labels (trace IDs) are stored in string columns
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
