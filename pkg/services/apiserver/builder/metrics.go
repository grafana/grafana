package builder

import (
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BuilderMetrics struct {
	dualWriterTargetMode  *prometheus.GaugeVec
	dualWriterCurrentMode *prometheus.GaugeVec
}

func ProvideBuilderMetrics(reg prometheus.Registerer) *BuilderMetrics {
	return &BuilderMetrics{
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

func (m *BuilderMetrics) RecordDualWriterModes(resource, group string, mode grafanarest.DualWriterMode) {
	m.dualWriterTargetMode.WithLabelValues(resource, group).Set(float64(mode))
	m.dualWriterCurrentMode.WithLabelValues(resource, group).Set(float64(mode))
}
