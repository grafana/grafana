package dashboards

import (
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
)

var _ client.Resource = (*Resource)(nil)

type Resource struct {
	cache.SharedIndexInformer
	dynamic.ResourceInterface

	crd   *k8ssys.Kind
	kind  *dashboard.Kind
	model *dashboard.Dashboard
}

func ProvideResource(clientset *client.Clientset) *Resource {
	return &Resource{}
}
