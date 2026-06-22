package pulse

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Webhook dispatch metrics. Registered against the default registerer
// at package init (promauto) so the pulse package needs no extra wire
// dependency on a *prometheus.Registerer. The "result" label is one of
// success / error / dropped so an operator can alert on a misbehaving
// hook without scraping logs.
var (
	hookDispatchTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Subsystem: "pulse",
		Name:      "hook_dispatch_total",
		Help:      "Total number of Pulse hook dispatch attempts, labelled by hook type and result.",
	}, []string{"type", "result"})

	hookDispatchDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Subsystem: "pulse",
		Name:      "hook_dispatch_duration_seconds",
		Help:      "Duration of Pulse hook HTTP dispatch attempts in seconds.",
		Buckets:   prometheus.DefBuckets,
	}, []string{"type"})
)

const (
	hookResultSuccess = "success"
	hookResultError   = "error"
	hookResultDropped = "dropped"
)
