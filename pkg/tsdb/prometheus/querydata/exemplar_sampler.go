package querydata

import (
	"math"
	"sort"
	"time"

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
		return exemplars[i].ts.Before(exemplars[j].ts)
	})
	return exemplars
}
