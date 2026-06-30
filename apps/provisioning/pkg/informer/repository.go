package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	typedv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

func (p *provisioningV0alpha1) Repositories(namespace string) typedv0alpha1.RepositoryInterface {
	return &repositories{RepositoryInterface: p.ProvisioningV0alpha1Interface.Repositories(namespace), fn: p.fn, namespace: namespace}
}

type repositories struct {
	typedv0alpha1.RepositoryInterface
	fn        WatchFunc
	namespace string
}

func (r *repositories) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	return r.fn(ctx, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), r.namespace, opts)
}
