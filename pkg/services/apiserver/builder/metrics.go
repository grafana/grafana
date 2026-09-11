package builder

import (
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BuilderMetrics struct {
	dualWriterTargetMode *prometheus.GaugeVec
}

func ProvideBuilderMetrics(reg prometheus.Registerer) *BuilderMetrics {
	return &BuilderMetrics{
		dualWriterTargetMode: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "unified_storage_dual_writer_target_mode",
			Help: "Unified storage dual writer target mode from static config (0=legacy/Mode0, 1-3=dual-write/Mode1-3, 4-5=unified/Mode4-5)",
		}, []string{"resource", "group"}),
	}
}

// RecordDualWriterTargetMode records the configured target dual writer mode for a resource.
// The current mode (which may differ due to migration log state) is tracked separately
// by the dualwrite service as unified_storage_dual_writer_current_mode.
func (m *BuilderMetrics) RecordDualWriterTargetMode(resource, group string, mode grafanarest.DualWriterMode) {
	m.dualWriterTargetMode.WithLabelValues(resource, group).Set(float64(mode))
}
