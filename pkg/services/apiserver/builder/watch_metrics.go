package builder

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Server names for the handler chains built in one process.
const (
	ServerMain          = "main"
	ServerAPIExtensions = "apiextensions"
)

// ServerRegisterer labels everything registered through it with the server the
// handler chain belongs to. A process builds a chain per server, each with its
// own copy of the chain's metrics, so without the label they would collide on
// registration. A nil reg stays nil, leaving collectors unregistered.
func ServerRegisterer(reg prometheus.Registerer, server string) prometheus.Registerer {
	if reg == nil {
		return nil
	}
	return prometheus.WrapRegistererWith(prometheus.Labels{"server": server}, reg)
}

// watchMetrics records the watch establishment duration. Watch concurrency is
// already covered by the upstream apiserver_longrunning_requests gauge, so this
// only adds the setup latency upstream does not track.
type watchMetrics struct {
	establishmentDuration *prometheus.HistogramVec
}

// newWatchMetrics registers the watch metrics for one handler chain. Pass a
// registerer from ServerRegisterer, so chains built for different servers do not
// collide.
func newWatchMetrics(reg prometheus.Registerer) *watchMetrics {
	return &watchMetrics{
		establishmentDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "apiserver",
			Name:      "watch_establishment_duration_seconds",
			Help:      "Time from receiving a watch request to the first byte written to the client, by server, group and resource.",
			Buckets:   prometheus.DefBuckets,
		}, []string{"group", "resource"}),
	}
}

// observeEstablishment matches filters.WatchEstablishmentRecorder.
func (m *watchMetrics) observeEstablishment(group, resource string, d time.Duration) {
	m.establishmentDuration.WithLabelValues(group, resource).Observe(d.Seconds())
}
