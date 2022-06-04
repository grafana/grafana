package converter

import (
	"math"
	"sort"
	"time"
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
	bucketTs := alignTimeRange(ts, step, 0)
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

func alignTimeRange(t time.Time, step time.Duration, offset int64) time.Time {
	return time.Unix(int64(math.Floor((float64(t.Unix()+offset)/step.Seconds()))*step.Seconds()-float64(offset)), 0).UTC()
}
