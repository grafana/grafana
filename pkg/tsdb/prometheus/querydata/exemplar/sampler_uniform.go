package exemplar

import (
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

const (
	UNIFORM_SAMPLER_X_COUNT = 100
	UNIFORM_SAMPLER_Y_COUNT = 10
)

type UniformSampler struct {
	step    time.Duration
	buckets map[time.Time][]models.Exemplar
	X       int
	Y       int
}

func NewUniformSampler(xCount, yCount int) Sampler {
	return &UniformSampler{
		buckets: map[time.Time][]models.Exemplar{},
		Y:       yCount,
		X:       xCount,
	}
}

func (e *UniformSampler) CalculateStep(tr models.TimeRange) time.Duration {
	stepNanos := tr.End.Sub(tr.Start).Nanoseconds() / int64(e.X)
	return time.Duration(stepNanos)
}

func (e *UniformSampler) SetStep(step time.Duration) {
	e.step = step
}

func (e *UniformSampler) Add(ex models.Exemplar) {
	bucketTs := models.AlignTimeRange(ex.Timestamp, e.step, 0)

	if _, exists := e.buckets[bucketTs]; !exists {
		e.buckets[bucketTs] = []models.Exemplar{ex}
		return
	}

	e.buckets[bucketTs] = append(e.buckets[bucketTs], ex)
}

func (e *UniformSampler) Sample() []models.Exemplar {
	exemplars := make([]models.Exemplar, 0)
	for _, b := range e.buckets {
		// sort by value in descending order
		sort.SliceStable(b, func(i, j int) bool {
			return b[i].Value > b[j].Value
		})
		sampled := []models.Exemplar{}
		step := 1
		// don't sample if there are less than Y exemplars in the current bucket
		if len(b) > e.Y {
			step = len(b) / e.Y
		}
		for i := 0; i < len(b); i = i + step {
			sampled = append(sampled, b[i])
		}
		exemplars = append(exemplars, sampled...)
	}
	sort.SliceStable(exemplars, func(i, j int) bool {
		return exemplars[i].Timestamp.Before(exemplars[j].Timestamp)
	})
	return exemplars
}

func (e *UniformSampler) Reset() {
	e.step = 0
	e.buckets = map[time.Time][]models.Exemplar{}
}
