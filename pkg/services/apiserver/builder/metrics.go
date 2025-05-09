package builder

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

type builderMetrics struct {
	dualWriterMode *prometheus.CounterVec
}

func newBuilderMetrics(reg prometheus.Registerer) *builderMetrics {
	metrics := &builderMetrics{
		dualWriterMode: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "dual_writer_mode",
				Help: "Dual writer mode",
			},
			[]string{"resource", "group", "targetMode", "currentMode"},
		),
	}
	reg.MustRegister(metrics.dualWriterMode)
	return metrics
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
