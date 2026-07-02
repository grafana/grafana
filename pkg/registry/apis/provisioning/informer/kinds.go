package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
)

// This file declares the provisioning resource kinds the controllers watch. Each
// kind is one constructor that hands the generic selectors (getterlessDeltaSource
// / getterDeltaSource, see generic.go) its ResourceInfo plus the few things the
// generated clientset can't express generically: its typed LIST, and — for kinds
// whose controller reconciles against a getter — its typed GET and cache lister.

// --- Jobs: the controller reads no lister, so callers need only the DeltaSource.

// NewJobDeltaSource returns the job delta source: a NATS-backed informer when the
// subscriber is enabled, otherwise an apiserver-backed SharedIndexInformer.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) DeltaSource {
	return getterlessDeltaSource(subscriber, client, provisioningapis.JobResourceInfo, resync, true,
		func(ctx context.Context, namespace string) (runtime.Object, error) {
			return client.ProvisioningV0alpha1().Jobs(namespace).List(ctx, metav1.ListOptions{})
		})
}

// --- Historic jobs: like jobs, but with live notifications disabled
// (liveObjects=false) so the informer is driven only by the periodic re-list of
// full objects. The cleanup handler reads each job's creation timestamp directly
// rather than re-fetching, so a minimal live-event object would make it act on a
// job that has no age; cleanup is resync-driven anyway, so live events add nothing.

// NewHistoricJobDeltaSource returns the historic-job delta source: a NATS-backed
// informer when the subscriber is enabled, otherwise an apiserver-backed
// SharedIndexInformer.
func NewHistoricJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) DeltaSource {
	return getterlessDeltaSource(subscriber, client, provisioningapis.HistoricJobResourceInfo, resync, false,
		func(ctx context.Context, namespace string) (runtime.Object, error) {
			return client.ProvisioningV0alpha1().HistoricJobs(namespace).List(ctx, metav1.ListOptions{})
		})
}

// --- Repositories: the controller reconciles against a Get and a namespace-wide
// List (the quota count).

// RepositoryGetter is the read seam the repository controller reconciles against.
// Get must return a current object (the reconcile acts on its spec); List backs
// the quota count, which tolerates staleness. *Source[*Repository] satisfies it.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	List(ctx context.Context, namespace string) ([]*provisioningapis.Repository, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the
// RepositoryGetter it backs as one Source. Under NATS, Get reads fresh from the
// API and writes through into the informer's shared snapshot; List (the quota
// count) reads that snapshot. Otherwise both read the informer's cache lister.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) *Source[*provisioningapis.Repository] {
	c := client.ProvisioningV0alpha1()
	return getterDeltaSource(subscriber, client, provisioningapis.RepositoryResourceInfo, resync,
		func(ctx context.Context, namespace string) (runtime.Object, error) {
			return c.Repositories(namespace).List(ctx, metav1.ListOptions{})
		},
		func(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
			return c.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
		},
		true, // List is the quota count, backed by the informer's shared snapshot.
		func(f informers.SharedInformerFactory) Getter[*provisioningapis.Repository] {
			return NewCachedRepositoryGetter(f.Provisioning().V0alpha1().Repositories().Lister())
		})
}

// NewCachedRepositoryGetter backs a RepositoryGetter with the informer's
// generated lister. It is the getter the non-NATS delta source embeds, and is
// exposed for controllers that reconcile against a lister in tests.
func NewCachedRepositoryGetter(lister listers.RepositoryLister) Getter[*provisioningapis.Repository] {
	return Getter[*provisioningapis.Repository]{
		get: func(_ context.Context, namespace, name string) (*provisioningapis.Repository, error) {
			return lister.Repositories(namespace).Get(name)
		},
		list: func(_ context.Context, namespace string) ([]*provisioningapis.Repository, error) {
			return lister.Repositories(namespace).List(labels.Everything())
		},
	}
}

// --- Connections: the controller reconciles against Get only.

// ConnectionGetter is the read seam the connection controller reconciles against.
// It exposes only the single connection under reconciliation.
// *Source[*Connection] satisfies it.
type ConnectionGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error)
}

// NewConnectionDeltaSource returns the connection delta source and the
// ConnectionGetter it backs as one Source. Under NATS, Get reads fresh from the
// API (there is no cache); otherwise it reads the informer's cache lister.
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) *Source[*provisioningapis.Connection] {
	c := client.ProvisioningV0alpha1()
	return getterDeltaSource(subscriber, client, provisioningapis.ConnectionResourceInfo, resync,
		func(ctx context.Context, namespace string) (runtime.Object, error) {
			return c.Connections(namespace).List(ctx, metav1.ListOptions{})
		},
		func(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
			return c.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
		},
		false, // Get-only: the controller needs no namespace-wide List.
		func(f informers.SharedInformerFactory) Getter[*provisioningapis.Connection] {
			return NewCachedConnectionGetter(f.Provisioning().V0alpha1().Connections().Lister())
		})
}

// NewCachedConnectionGetter backs a ConnectionGetter with the informer's
// generated lister. It is the getter the non-NATS delta source embeds, and is
// exposed for controllers that reconcile against a lister in tests.
func NewCachedConnectionGetter(lister listers.ConnectionLister) Getter[*provisioningapis.Connection] {
	return Getter[*provisioningapis.Connection]{
		get: func(_ context.Context, namespace, name string) (*provisioningapis.Connection, error) {
			return lister.Connections(namespace).Get(name)
		},
	}
}
