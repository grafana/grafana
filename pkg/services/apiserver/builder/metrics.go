package builder

import (
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type builderMetrics struct {
	dualWriterTargetMode  *prometheus.GaugeVec
	dualWriterCurrentMode *prometheus.GaugeVec
}

func newBuilderMetrics(reg prometheus.Registerer) *builderMetrics {
	return &builderMetrics{
		dualWriterTargetMode: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "unified_storage_dual_writer_target_mode",
			Help: "Unified Storage dual writer target mode",
		}, []string{"resource", "group"}),
		dualWriterCurrentMode: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "unified_storage_dual_writer_current_mode",
			Help: "Unified storage dual writer current mode",
		}, []string{"resource", "group"}),
	}
}

func (m *builderMetrics) recordDualWriterModes(resource, group string, targetMode, currentMode grafanarest.DualWriterMode) {
	m.dualWriterTargetMode.WithLabelValues(resource, group).Set(float64(targetMode))
	m.dualWriterCurrentMode.WithLabelValues(resource, group).Set(float64(currentMode))
}
