package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/retry"
	k8stracing "k8s.io/component-base/tracing"

	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type reconcilerClients struct {
	loopback apiserver.RestConfigProvider
	byGroup  map[string]apiserver.RestConfigProvider

	mu      sync.Mutex
	clients map[string]apiClients
}

type apiClients struct {
	dynamic   dynamic.Interface
	discovery client.DiscoveryClient
}

func (c *reconcilerClients) ForResource(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	clients, err := c.clientsFor(ctx, gvr.Group)
	if err != nil {
		return nil, err
	}
	if _, err := clients.discovery.GetKindForResource(gvr); err != nil {
		return nil, err
	}
	return retryingList{clients.dynamic.Resource(gvr).Namespace(namespace)}, nil
}

func (c *reconcilerClients) clientsFor(ctx context.Context, group string) (apiClients, error) {
	provider := c.loopback
	if provider != nil {
		group = ""
	} else {
		provider = c.byGroup[group]
	}
	if provider == nil {
		return apiClients{}, fmt.Errorf("no client for API group %s", group)
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if clients, ok := c.clients[group]; ok {
		return clients, nil
	}

	cfg, err := provider.GetRestConfig(ctx)
	if err != nil {
		return apiClients{}, err
	}
	cfg = rest.CopyConfig(cfg)
	cfg.Wrap(k8stracing.WrapperFor(otel.GetTracerProvider()))
	discovery, err := client.NewDiscoveryClient(cfg)
	if err != nil {
		return apiClients{}, err
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return apiClients{}, err
	}

	if c.clients == nil {
		c.clients = make(map[string]apiClients)
	}
	c.clients[group] = apiClients{dynamic: dyn, discovery: discovery}
	return c.clients[group], nil
}

var listBackoff = wait.Backoff{Duration: 100 * time.Millisecond, Factor: 2, Jitter: 0.1, Steps: 8, Cap: 5 * time.Second}

type retryingList struct {
	dynamic.ResourceInterface
}

func (c retryingList) List(ctx context.Context, opts metav1.ListOptions) (list *unstructured.UnstructuredList, err error) {
	err = retry.OnError(listBackoff, isTransientError, func() error {
		list, err = c.ResourceInterface.List(ctx, opts)
		return err
	})
	return list, err
}

func isTransientError(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	_, isOpErr := errors.AsType[*net.OpError](err)
	return apierrors.IsServiceUnavailable(err) || apierrors.IsServerTimeout(err) ||
		apierrors.IsTooManyRequests(err) || apierrors.IsTimeout(err) ||
		utilnet.IsTimeout(err) || isOpErr
}
