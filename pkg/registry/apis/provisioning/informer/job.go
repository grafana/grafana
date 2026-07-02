package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewJobDeltaSource returns the job delta source: a NATS-backed informer when the
// subscriber is enabled, otherwise an apiserver-backed SharedIndexInformer. The
// job controller reads no lister, so callers need only the DeltaSource.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) DeltaSource {
	return newDeltaSource(subscriber, client, provisioningapis.JobResourceInfo, resync, NewJobInformer)
}

// NewJobInformer builds an Informer for jobs.
func NewJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	return newDeltaSourceInformer(subscriber, provisioningapis.JobResourceInfo, namespace, resync, store, true,
		typedListFunc(func(ctx context.Context) (runtime.Object, error) {
			return c.Jobs(namespace).List(ctx, metav1.ListOptions{})
		}))
}
