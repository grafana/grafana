package dualwrite

import (
	"github.com/prometheus/client_golang/prometheus"
)

type Metrics struct {
}

func ProvideMetrics(_ prometheus.Registerer) *Metrics {
	return &Metrics{}
}
