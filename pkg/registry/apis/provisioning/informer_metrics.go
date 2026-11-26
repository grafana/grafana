package provisioning

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	informer "github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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

// controllerInformer is how the in-process resource controllers configure their
// delta sources. The re-list interval is [provisioning] resync_interval.
type controllerInformer struct {
	unified resource.ResourceClient
	metrics *InformerMetrics
	resync  time.Duration
}

func newControllerInformer(cfg *setting.Cfg, unified resource.ResourceClient, metrics *InformerMetrics) controllerInformer {
	resync := cfg.ProvisioningControllerResyncInterval
	if resync <= 0 {
		resync = setting.ProvisioningControllerResyncIntervalDefault
	}
	return controllerInformer{unified: unified, metrics: metrics, resync: resync}
}

func (c controllerInformer) forResource(gvr schema.GroupVersionResource) controller.Informer {
	relist, freshness := c.metrics.get()
	return controller.Informer{
		Keys:             keysapi.NewGRPCLister(c.unified, gvr),
		RelistMetrics:    relist,
		FreshnessMetrics: freshness,
		ResyncInterval:   c.resync,
		DrainTimeout:     30 * time.Second,
	}
}
