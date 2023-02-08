package dashboards

import (
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
)

type Resource struct {
	crd   *k8ssys.Kind
	kind  *dashboard.Kind
	model *dashboard.Dashboard

	informer cache.SharedIndexInformer
	resource dynamic.ResourceInterface
}

func ProvideResource() {

}
