package iam

import (
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "apiserver"
)

var (
	registerOnce       sync.Once
	hooksWaitHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "hooks_wait_duration_seconds",
		Help:      "Time spent in the hooks waiting for a ticket to start processing",
		Buckets:   prometheus.ExponentialBuckets(0.001, 2, 5), // 1ms to ~16s
	})
)

func registerMetrics(reg prometheus.Registerer) {
	registerOnce.Do(func() {
		if err := reg.Register(hooksWaitHistogram); err != nil {
			log.New("iam.apis").Warn("failed to register iam apiserver metrics", "error", err)
		}
	})
}
