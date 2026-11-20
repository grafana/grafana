package client

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
)

type APIClients struct {
	configProvider restcfg.RestConfigProvider
	once           sync.Once
	dynamic        dynamic.Interface
	discovery      DiscoveryClient
	initErr        error
}

func NewAPIClients(configProvider restcfg.RestConfigProvider) *APIClients {
	return &APIClients{configProvider: configProvider}
}

func (p *APIClients) onlyOnce(ctx context.Context) error {
	p.once.Do(func() {
		restConfig, e := p.configProvider.GetRestConfig(ctx)
		if e != nil {
			p.initErr = fmt.Errorf("get rest config: %w", e)
			return
		}

		// Wrap the transport with otelhttp so outbound requests carry W3C trace
		// context. Without this the operator's writes to the apiserver (resource
		// creates, folder ensures, job status updates) are leaf spans with no
		// children — the apiserver has no incoming traceparent to continue the
		// trace. The gRPC search path already propagates via its own interceptor.
		// Copy first: GetRestConfig returns a shared config used by other clients.
		restConfig = rest.CopyConfig(restConfig)
		restConfig.Wrap(func(rt http.RoundTripper) http.RoundTripper {
			return otelhttp.NewTransport(rt)
		})

		p.dynamic, e = dynamic.NewForConfig(restConfig)
		if e != nil {
			p.initErr = fmt.Errorf("create dynamic client: %w", e)
			return
		}

		p.discovery, e = NewDiscoveryClient(restConfig)
		if e != nil {
			p.initErr = fmt.Errorf("create discovery client: %w", e)
			return
		}
	})

	return p.initErr
}

func (p *APIClients) GetClientsForKind(ctx context.Context, _ schema.GroupVersionKind) (dynamic.Interface, DiscoveryClient, error) {
	if err := p.onlyOnce(ctx); err != nil {
		return nil, nil, fmt.Errorf("get clients: %w", err)
	}

	return p.dynamic, p.discovery, nil
}

func (p *APIClients) GetClientsForResource(ctx context.Context, _ schema.GroupVersionResource) (dynamic.Interface, DiscoveryClient, error) {
	if err := p.onlyOnce(ctx); err != nil {
		return nil, nil, fmt.Errorf("get clients: %w", err)
	}

	return p.dynamic, p.discovery, nil
}

func (p *APIClients) ForResource(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	dyn, discovery, err := p.GetClientsForResource(ctx, gvr)
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
	return NewRetryResourceInterface(dyn.Resource(gvr).Namespace(namespace), DefaultRetryBackoff()), nil
}

type GroupClients map[string]*APIClients

func (groups GroupClients) ForResource(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	server := groups[gvr.Group]
	if server == nil {
		return nil, fmt.Errorf("no client for API group %s", gvr.Group)
	}
	return server.ForResource(ctx, namespace, gvr)
}
