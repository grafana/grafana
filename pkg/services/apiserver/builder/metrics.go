package builder

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type builderMetrics struct {
	dualWriterMode *prometheus.CounterVec
}

func newBuilderMetrics(reg prometheus.Registerer) *builderMetrics {
	return &builderMetrics{
		dualWriterMode: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "dual_writer_mode",
				Help: "Dual writer mode",
			},
			[]string{"resource", "group", "targetMode", "currentMode"},
		),
	}
}

func (m *builderMetrics) recordDualWriterMode(resource, group string, targetMode, currentMode int) {
	labels := prometheus.Labels{
		"resource":    resource,
		"group":       group,
		"targetMode":  strconv.Itoa(targetMode),
		"currentMode": strconv.Itoa(currentMode),
	}
	m.dualWriterMode.With(labels).Inc()
}
