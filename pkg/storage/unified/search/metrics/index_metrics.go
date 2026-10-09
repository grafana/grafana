package metrics

import "github.com/prometheus/client_golang/prometheus"

// IndexMetrics preserves combined providers while each component receives only its own metrics.
type IndexMetrics struct {
	*BuildMetrics
	*BleveMetrics
	*ServiceMetrics
}

func (m *IndexMetrics) Bleve() *BleveMetrics {
	if m == nil {
		return nil
	}
	return m.BleveMetrics
}

func ProvideIndexMetrics(reg prometheus.Registerer) *IndexMetrics {
	build := ProvideBuildMetrics(reg)
	return &IndexMetrics{
		BuildMetrics:   build,
		BleveMetrics:   ProvideBleveMetrics(reg, build),
		ServiceMetrics: ProvideServiceMetrics(reg, build),
	}
}
