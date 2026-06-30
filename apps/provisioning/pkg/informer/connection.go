package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	typedv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

func (p *provisioningV0alpha1) Connections(namespace string) typedv0alpha1.ConnectionInterface {
	return &connections{ConnectionInterface: p.ProvisioningV0alpha1Interface.Connections(namespace), fn: p.fn, namespace: namespace}
}

type connections struct {
	typedv0alpha1.ConnectionInterface
	fn        WatchFunc
	namespace string
}

func (c *connections) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	return c.fn(ctx, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), c.namespace, opts)
}
