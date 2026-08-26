package builder

import (
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// watchMetrics records the watch establishment duration. Watch concurrency is
// already covered by the upstream apiserver_longrunning_requests gauge, so this
// only adds the setup latency upstream does not track.
type watchMetrics struct {
	establishmentDuration *prometheus.HistogramVec
}

// newWatchMetrics registers the watch metrics, tolerating repeated registration
// against the same registerer (the handler chain is built once for the main
// apiserver and again for the embedded apiextensions server).
func newWatchMetrics(reg prometheus.Registerer) *watchMetrics {
	h := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Subsystem: "apiserver",
		Name:      "watch_establishment_duration_seconds",
		Help:      "Time from receiving a watch request to the first byte written to the client, by group and resource.",
		Buckets:   prometheus.DefBuckets,
	}, []string{"group", "resource"})

	if reg != nil {
		if err := reg.Register(h); err != nil {
			var already prometheus.AlreadyRegisteredError
			if errors.As(err, &already) {
				h = already.ExistingCollector.(*prometheus.HistogramVec)
			} else {
				panic(err)
			}
		}
	}
	return &watchMetrics{establishmentDuration: h}
}

// observeEstablishment matches filters.WatchEstablishmentRecorder.
func (m *watchMetrics) observeEstablishment(group, resource string, d time.Duration) {
	m.establishmentDuration.WithLabelValues(group, resource).Observe(d.Seconds())
}
