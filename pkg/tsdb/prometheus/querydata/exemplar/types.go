package exemplar

import "time"

type Exemplar struct {
	SeriesLabels map[string]string
	Labels       map[string]string
	Value        float64
	Timestamp    time.Time
}

type ExemplarSampler interface {
	Add(Exemplar)
	SetStep(time.Duration)
	Sample() []Exemplar
}
