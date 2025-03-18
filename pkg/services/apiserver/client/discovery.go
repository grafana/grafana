package client

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/rest"
)

type DiscoveryClient interface {
	discovery.DiscoveryInterface
	GetResourceForKind(gvk schema.GroupVersionKind) (schema.GroupVersionResource, error)
	GetKindForResource(gvr schema.GroupVersionResource) (schema.GroupVersionKind, error)
	GetPreferredVesion(gr schema.GroupResource) (schema.GroupVersionResource, schema.GroupVersionKind, error)
}

type DiscoveryClientImpl struct {
	restConfig *rest.Config
	discovery.DiscoveryInterface
}

func NewDiscoveryClient(restConfig *rest.Config) (*DiscoveryClientImpl, error) {
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	return &DiscoveryClientImpl{
		restConfig:         restConfig,
		DiscoveryInterface: discoveryClient,
	}, nil
}

func (d *DiscoveryClientImpl) GetResourceForKind(gvk schema.GroupVersionKind) (schema.GroupVersionResource, error) {
	resourceList, err := d.ServerResourcesForGroupVersion(gvk.GroupVersion().String())
	if err != nil {
		return schema.GroupVersionResource{}, err
	}
	for _, resource := range resourceList.APIResources {
		if resource.Kind == gvk.Kind {
			return schema.GroupVersionResource{
				Group:    gvk.Group,
				Version:  gvk.Version,
				Resource: resource.Name,
			}, nil
		}
	}
	return schema.GroupVersionResource{}, fmt.Errorf("resource not found for %s", gvk.String())
}

func (d *DiscoveryClientImpl) GetKindForResource(gvr schema.GroupVersionResource) (schema.GroupVersionKind, error) {
	resourceList, err := d.ServerResourcesForGroupVersion(gvr.GroupVersion().String())
	if err != nil {
		return schema.GroupVersionKind{}, err
	}
	for _, resource := range resourceList.APIResources {
		if resource.Name == gvr.Resource {
			return schema.GroupVersionKind{
				Group:   gvr.Group,
				Version: gvr.Version,
				Kind:    resource.Kind,
			}, nil
		}
	}
	return schema.GroupVersionKind{}, fmt.Errorf("kind not found for %s", gvr.String())
}

func (d *DiscoveryClientImpl) GetPreferredVesion(gr schema.GroupResource) (schema.GroupVersionResource, schema.GroupVersionKind, error) {
	apiList, err := d.ServerPreferredResources()
	if err != nil {
		return schema.GroupVersionResource{}, schema.GroupVersionKind{}, err
	}
	for _, gv := range apiList {
		for _, resource := range gv.APIResources {
			if resource.Group == gr.Group && resource.Name == gr.Resource {
				return schema.GroupVersionResource{
						Group:    resource.Group,
						Version:  resource.Version,
						Resource: resource.Name,
					}, schema.GroupVersionKind{
						Group:   resource.Group,
						Version: resource.Version,
						Kind:    resource.Kind,
					}, nil
			}
		}
	}
	return schema.GroupVersionResource{}, schema.GroupVersionKind{}, fmt.Errorf("preferred version not found for %s", gr.String())
}
