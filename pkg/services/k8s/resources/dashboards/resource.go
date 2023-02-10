package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"k8s.io/client-go/dynamic"
)

var _ client.Resource = (*Resource)(nil)

type Resource struct {
	dynamic.ResourceInterface

	clientSet *client.Clientset
	crd       k8ssys.Kind
	kind      *dashboard.Kind
}

func ProvideResource(clientset *client.Clientset, reg *corecrd.Registry, kinds *corekind.Base) (*Resource, error) {
	err := clientset.RegisterKind(context.Background(), reg.Dashboard())
	if err != nil {
		return nil, err
	}
	resourceClient, err := clientset.GetResourceClient(reg.Dashboard())
	if err != nil {
		return nil, err
	}
	return &Resource{
		ResourceInterface: resourceClient,
		clientSet:         clientset,
		crd:               reg.Dashboard(),
		kind:              kinds.Dashboard(),
	}, nil
}
