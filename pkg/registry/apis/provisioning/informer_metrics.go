package provisioning

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"

	informer "github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

// InformerMetrics are the relist and freshness metrics shared by the
// repository and connection controllers. They register on first use, once per
// process, so an instance without provisioning registers nothing.
type InformerMetrics struct {
	reg       prometheus.Registerer
	once      sync.Once
	relist    *informer.RelistProjectionMetrics
	freshness *informer.FreshnessMetrics
}

func ProvideInformerMetrics(reg prometheus.Registerer) *InformerMetrics {
	return &InformerMetrics{reg: reg}
}

func (m *InformerMetrics) get() (*informer.RelistProjectionMetrics, *informer.FreshnessMetrics) {
	m.once.Do(func() {
		m.relist = informer.NewRelistProjectionMetrics(m.reg)
		m.freshness = informer.NewFreshnessMetrics(m.reg)
	})
	return m.relist, m.freshness
}
