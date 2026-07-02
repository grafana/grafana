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

// NewJobDeltaSource returns the job delta source: a NATS-backed informer when the
// subscriber is enabled, otherwise an apiserver-backed SharedIndexInformer. The
// job controller reads no lister, so callers need only the DeltaSource — the kind
// contributes only its ResourceInfo and its typed LIST.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) DeltaSource {
	return getterlessDeltaSource(subscriber, client, provisioningapis.JobResourceInfo, resync, true,
		func(ctx context.Context, namespace string) (runtime.Object, error) {
			return client.ProvisioningV0alpha1().Jobs(namespace).List(ctx, metav1.ListOptions{})
		})
}
