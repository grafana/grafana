package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"k8s.io/client-go/dynamic"
)

var _ client.Resource = (*Resource)(nil)

type Resource struct {
	dynamic.ResourceInterface

	clientSet *client.Clientset
	kind      *dashboard.Kind
}

func ProvideResource(clientset *client.Clientset, kinds *corekind.Base) (*Resource, error) {
	err := clientset.RegisterKind(context.Background(), CRD)
	if err != nil {
		return nil, err
	}
	resourceClient, err := clientset.GetResourceClient(CRD)
	if err != nil {
		return nil, err
	}
	return &Resource{
		ResourceInterface: resourceClient,
		clientSet:         clientset,
		kind:              kinds.Dashboard(),
	}, nil
}
