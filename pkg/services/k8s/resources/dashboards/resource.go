package dashboards

import (
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
)

var _ client.Resource = (*Resource)(nil)

type Resource struct {
	cache.SharedIndexInformer
	dynamic.ResourceInterface

	crd  k8ssys.Kind
	kind *dashboard.Kind
}

func ProvideResource(clientset *client.Clientset, reg *corecrd.Registry, kinds *corekind.Base) (*Resource, error) {
	resourceClient, err := clientset.GetResourceClient(reg.Dashboard())
	if err != nil {
		return nil, err
	}
	return &Resource{
		ResourceInterface:   resourceClient,
		SharedIndexInformer: clientset.GetResourceInformer(reg.Dashboard()),
		crd:                 reg.Dashboard(),
		kind:                kinds.Dashboard(),
	}, nil
}
