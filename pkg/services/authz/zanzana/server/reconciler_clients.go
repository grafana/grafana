package server

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type reconcilerClients struct {
	loopback *reconcilerAPIServer
	byGroup  map[string]*reconcilerAPIServer
}

type reconcilerAPIServer struct {
	config    func(context.Context) (*rest.Config, error)
	mu        sync.Mutex
	dynamic   dynamic.Interface
	discovery client.DiscoveryClient
}

func (s *reconcilerAPIServer) clients(ctx context.Context) (dynamic.Interface, client.DiscoveryClient, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dynamic != nil {
		return s.dynamic, s.discovery, nil
	}
	cfg, err := s.config(ctx)
	if err != nil {
		return nil, nil, err
	}
	cfg = rest.CopyConfig(cfg)
	cfg.Wrap(func(rt http.RoundTripper) http.RoundTripper { return otelhttp.NewTransport(rt) })
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, nil, err
	}
	discovery, err := client.NewDiscoveryClient(cfg)
	if err != nil {
		return nil, nil, err
	}
	s.dynamic, s.discovery = dyn, discovery
	return dyn, discovery, nil
}

func (c reconcilerClients) ForResource(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	server := c.loopback
	if server == nil {
		server = c.byGroup[gvr.Group]
		if server == nil {
			return nil, fmt.Errorf("no client for API group %s", gvr.Group)
		}
	}

	dyn, discovery, err := server.clients(ctx)
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
	return dyn.Resource(gvr).Namespace(namespace), nil
}
