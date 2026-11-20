package server

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type reconcilerClients struct {
	loopback *client.APIClients
	byGroup  map[string]*client.APIClients
}

func (c reconcilerClients) ForResource(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	server := c.loopback
	if server == nil {
		server = c.byGroup[gvr.Group]
		if server == nil {
			return nil, fmt.Errorf("no client for API group %s", gvr.Group)
		}
	}

	dyn, discovery, err := server.Clients(ctx)
	if err != nil {
		return nil, err
	}
	if gvr.Version == "" {
		gvr, _, err = discovery.GetPreferredVersion(ctx, gvr.GroupResource())
	} else {
		_, err = discovery.GetKindForResource(gvr)
	}
	if err != nil {
		return nil, err
	}
	return client.NewRetryResourceInterface(dyn.Resource(gvr).Namespace(namespace), client.DefaultRetryBackoff()), nil
}
