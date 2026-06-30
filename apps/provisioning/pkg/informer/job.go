package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	typedv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

func (p *provisioningV0alpha1) Jobs(namespace string) typedv0alpha1.JobInterface {
	return &jobs{JobInterface: p.ProvisioningV0alpha1Interface.Jobs(namespace), fn: p.fn, namespace: namespace}
}

type jobs struct {
	typedv0alpha1.JobInterface
	fn        WatchFunc
	namespace string
}

func (j *jobs) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	return j.fn(ctx, provisioningapis.JobResourceInfo.GroupVersionResource(), j.namespace, opts)
}
