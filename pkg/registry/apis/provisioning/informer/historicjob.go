package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
)

// NewHistoricJobDeltaSource returns the historic-job delta source: a NATS-backed
// informer when the subscriber is enabled, otherwise an apiserver-backed
// SharedIndexInformer. Cleanup reads no lister, so callers need only the
// DeltaSource.
//
// It disables live notifications (liveObjects=false), so the informer is driven
// only by the periodic re-list of full objects: the cleanup handler reads each
// job's creation timestamp directly (it does not re-fetch), so a minimal
// live-event object would make it act on a job that has no age. Cleanup is
// resync-driven anyway, so live notifications add nothing.
func NewHistoricJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) DeltaSource {
	return getterlessDeltaSource(subscriber, client, provisioningapis.HistoricJobResourceInfo, resync, false,
		func(ctx context.Context, namespace string) (runtime.Object, error) {
			return client.ProvisioningV0alpha1().HistoricJobs(namespace).List(ctx, metav1.ListOptions{})
		})
}
