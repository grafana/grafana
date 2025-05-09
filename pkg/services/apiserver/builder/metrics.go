package builder

import (
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/unknwon/log"
)

type builderMetrics struct {
	dualWriterTargetMode  *prometheus.GaugeVec
	dualWriterCurrentMode *prometheus.GaugeVec
}

func newBuilderMetrics(reg prometheus.Registerer) *builderMetrics {
	metrics := &builderMetrics{
		dualWriterTargetMode: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name:        "dual_writer_target_mode",
			Help:        "Dual writer target mode",
			ConstLabels: prometheus.Labels{"component": "builder"},
		}, []string{"resource", "group"}),
		dualWriterCurrentMode: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name:        "dual_writer_current_mode",
			Help:        "Dual writer current mode",
			ConstLabels: prometheus.Labels{"component": "builder"},
		}, []string{"resource", "group"}),
	}

	if err := reg.Register(metrics.dualWriterTargetMode); err != nil {
		log.Info("builder metrics already registered")
	}
	if err := reg.Register(metrics.dualWriterCurrentMode); err != nil {
		log.Info("builder metrics already registered")
	}
	return metrics
}

func (m *builderMetrics) recordDualWriterModes(resource, group string, targetMode, currentMode grafanarest.DualWriterMode) {
	m.dualWriterTargetMode.WithLabelValues(resource, group).Set(float64(targetMode))
	m.dualWriterCurrentMode.WithLabelValues(resource, group).Set(float64(currentMode))
}
