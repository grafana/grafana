package exemplar

import (
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

type Sampler interface {
	Add(models.Exemplar)
	SetStep(time.Duration)
	Sample() []models.Exemplar
	Reset()
}

var _ Sampler = (*NoOpSampler)(nil)

type NoOpSampler struct {
	exemplars []models.Exemplar
}

func NewNoOpSampler() Sampler {
	return &NoOpSampler{
		exemplars: []models.Exemplar{},
	}
}

func (e *NoOpSampler) Add(ex models.Exemplar) {
	e.exemplars = append(e.exemplars, ex)
}

func (e *NoOpSampler) SetStep(time.Duration) {
	// noop
}

func (e *NoOpSampler) Sample() []models.Exemplar {
	sort.SliceStable(e.exemplars, func(i, j int) bool {
		return e.exemplars[i].Timestamp.Before(e.exemplars[j].Timestamp)
	})
	return e.exemplars
}

func (e *NoOpSampler) Reset() {
	e.exemplars = []models.Exemplar{}
}
