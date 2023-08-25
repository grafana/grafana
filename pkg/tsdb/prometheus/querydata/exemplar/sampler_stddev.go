package exemplar

import (
	"math"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

type StandardDeviationSampler struct {
	step    time.Duration
	buckets map[time.Time][]models.Exemplar
	count   int
	mean    float64
	m2      float64
}

func NewStandardDeviationSampler() Sampler {
	return &StandardDeviationSampler{
		buckets: map[time.Time][]models.Exemplar{},
	}
}

func (e *StandardDeviationSampler) SetStep(step time.Duration) {
	e.step = step
}

func (e *StandardDeviationSampler) Add(ex models.Exemplar) {
	bucketTs := models.AlignTimeRange(ex.Timestamp, e.step, 0)
	e.updateAggregations(ex.Value)

	if _, exists := e.buckets[bucketTs]; !exists {
		e.buckets[bucketTs] = []models.Exemplar{ex}
		return
	}

	e.buckets[bucketTs] = append(e.buckets[bucketTs], ex)
}

// updateAggregations uses Welford's online algorithm for calculating the mean and variance
// https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm
func (e *StandardDeviationSampler) updateAggregations(val float64) {
	e.count++
	delta := val - e.mean
	e.mean += delta / float64(e.count)
	delta2 := val - e.mean
	e.m2 += delta * delta2
}

// standardDeviation calculates the amount of variation in the data
// https://en.wikipedia.org/wiki/Standard_deviation
func (e *StandardDeviationSampler) standardDeviation() float64 {
	if e.count < 2 {
		return 0
	}
	return math.Sqrt(e.m2 / float64(e.count-1))
}

func (e *StandardDeviationSampler) Sample() []models.Exemplar {
	exemplars := make([]models.Exemplar, 0, len(e.buckets))
	for _, b := range e.buckets {
		// sort by value in descending order
		sort.SliceStable(b, func(i, j int) bool {
			return b[i].Value > b[j].Value
		})
		sampled := []models.Exemplar{}
		for _, ex := range b {
			if len(sampled) == 0 {
				sampled = append(sampled, ex)
				continue
			}
			// only sample values at least 2 standard deviation distance to previously taken value
			prev := sampled[len(sampled)-1]
			if e.standardDeviation() != 0.0 && prev.Value-ex.Value > e.standardDeviation()*2.0 {
				sampled = append(sampled, ex)
			}
		}
		exemplars = append(exemplars, sampled...)
	}
	sort.SliceStable(exemplars, func(i, j int) bool {
		return exemplars[i].Timestamp.Before(exemplars[j].Timestamp)
	})
	return exemplars
}

func (e *StandardDeviationSampler) Reset() {
	e.step = 0
	e.buckets = map[time.Time][]models.Exemplar{}
	e.count = 0
	e.mean = 0
	e.m2 = 0
}
