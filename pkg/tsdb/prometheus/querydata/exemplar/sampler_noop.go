package exemplar

import (
	"sort"
	"time"
)

var _ ExemplarSampler = (*noOpSampler)(nil)

type noOpSampler struct {
	exemplars []Exemplar
}

func NewNoOpSampler() ExemplarSampler {
	return &noOpSampler{
		exemplars: []Exemplar{},
	}
}

func (e *noOpSampler) Add(ex Exemplar) {
	e.exemplars = append(e.exemplars, ex)
}

func (e *noOpSampler) SetStep(time.Duration) {
	// noop
}

func (e *noOpSampler) Sample() []Exemplar {
	sort.SliceStable(e.exemplars, func(i, j int) bool {
		return e.exemplars[i].Timestamp.Before(e.exemplars[j].Timestamp)
	})
	return e.exemplars
}
