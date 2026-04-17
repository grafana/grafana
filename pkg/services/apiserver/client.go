package apiserver

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
)

type ClientProvider interface {
	// Get an grafana-app-sdk based resource client.  This will give you access to a typed client
	GetResourceClient(ctx context.Context, kind resource.Kind) (resource.Client, error)

	// Get a generic client that will return unstructured.Unstructured values
	GetDynamicClient(ctx context.Context, gvr schema.GroupVersionResource, namespace string) (dynamic.ResourceInterface, error)

	// Get a raw REST client.  This is useful when you need the raw output and full control
	GetRestClient(ctx context.Context) (rest.Interface, error)
}

type clientProvider struct {
	configs RestConfigProvider
}

// provide the provider!!
func ProvideClientProvider(configs RestConfigProvider) ClientProvider {
	return &clientProvider{configs: configs}
}

func (d *clientProvider) GetResourceClient(ctx context.Context, kind resource.Kind) (resource.Client, error) {
	restConfig, err := d.configs.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("error in GetResourceClient: %w", err)
	}
	reg := k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())
	return reg.ClientFor(kind)
}

func (d *clientProvider) GetDynamicClient(ctx context.Context, gvr schema.GroupVersionResource, namespace string) (dynamic.ResourceInterface, error) {
	restConfig, err := d.configs.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("error in GetDynamicClient: %w", err)
	}
	dyn, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	return dyn.Resource(gvr).Namespace(namespace), nil
}

// GetRestClient implements [ClientProvider].
func (d *clientProvider) GetRestClient(ctx context.Context) (rest.Interface, error) {
	restConfig, err := d.configs.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("error in GetDynamicClient: %w", err)
	}
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	return client.RESTClient(), nil
}
