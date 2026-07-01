package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	typedv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

func (p *provisioningV0alpha1) HistoricJobs(namespace string) typedv0alpha1.HistoricJobInterface {
	return &historicJobs{HistoricJobInterface: p.ProvisioningV0alpha1Interface.HistoricJobs(namespace), fn: p.fn, namespace: namespace}
}

type historicJobs struct {
	typedv0alpha1.HistoricJobInterface
	fn        WatchFunc
	namespace string
}

func (h *historicJobs) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	get := func(ctx context.Context, name string, o metav1.GetOptions) (runtime.Object, error) {
		return h.Get(ctx, name, o)
	}
	return h.fn(ctx, provisioningapis.HistoricJobResourceInfo.GroupVersionResource(), h.namespace, get, opts)
}
