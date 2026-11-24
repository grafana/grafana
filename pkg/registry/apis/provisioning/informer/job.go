package informer

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	apiinformers "github.com/grafana/grafana/pkg/services/apiserver/informers"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewJobDeltaSource returns the job delta source the supplier selects. The job
// controller reads no lister, so callers need only the DeltaSource. Its event
// deliveries are reported on the informer delivery metrics, registered on reg
// (nil disables them).
func NewJobDeltaSource(supplier operator.InformerSupplier, clients resource.ClientGenerator, resync time.Duration, reg prometheus.Registerer) (DeltaSource, error) {
	source, err := newDeltaSource(supplier, clients, provisioningapis.JobResourceInfo, apiinformers.KeyedNeeds, resync,
		func() runtime.Object { return &provisioningapis.Job{} })
	if err != nil {
		return nil, err
	}
	// One metering handler observes each delivery once, however many controller
	// handlers register.
	meter := apiServerMeter{metrics: newInformerMetrics(reg), resourceName: provisioningapis.JobResourceInfo.GroupVersionResource().Resource}
	if _, err := source.AddEventHandler(meter); err != nil {
		return nil, err
	}
	return source, nil
}

// NewJobInformer builds an Informer for jobs. onRequest, when non-nil, is called
// once per LIST request the re-list issues (one per page), so callers can meter
// pagination.
func NewJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, onRequest func()) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Job{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, int64, error) {
		return listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			if onRequest != nil {
				onRequest()
			}
			return c.Jobs(namespace).List(ctx, opts)
		})
	}
	return usinformer.NewInformer(subscriber, provisioningapis.JobResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}
