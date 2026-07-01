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

// Informer aliases the generic NATS-backed informer so provisioning wiring has a
// single import for both the constructors and the informer type.
type Informer = usinformer.Informer

// The constructors below build an Informer for each provisioning resource the
// controllers watch. Each binds LIST to that resource's typed client, and builds
// the minimal live-event object as the resource's concrete type so the
// controller's event handler keys off the right type. namespace scopes the NATS
// subscription and the LIST; pass "" to watch every namespace.

// NewRepositoryInformer builds an Informer for repositories.
func NewRepositoryInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration) *Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.Repositories(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), namespace, resync, newObject, list)
}

// NewConnectionInformer builds an Informer for connections.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration) *Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.Connections(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), namespace, resync, newObject, list)
}

// NewJobInformer builds an Informer for jobs.
func NewJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration) *Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Job{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.Jobs(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.JobResourceInfo.GroupVersionResource(), namespace, resync, newObject, list)
}

// NewHistoricJobInformer builds an Informer for historic jobs. It passes a nil
// object builder, so it is driven only by the periodic re-list of full objects:
// the cleanup handler reads each job's creation timestamp directly (it does not
// re-fetch), so a minimal live-event object would make it act on a job that has
// no age. Cleanup is resync-driven anyway, so live notifications add nothing.
func NewHistoricJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration) *Informer {
	c := client.ProvisioningV0alpha1()
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.HistoricJobs(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.HistoricJobResourceInfo.GroupVersionResource(), namespace, resync, nil, list)
}
