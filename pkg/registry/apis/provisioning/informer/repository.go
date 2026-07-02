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
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against. It exposes exactly what the controller needs — the single repository
// under reconciliation, and a namespace-wide list for the quota count — so the
// source can be swapped without touching the controller.
//
// Get must return a current object (the reconcile acts on its spec); List backs
// the quota count, which tolerates staleness.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	List(ctx context.Context, namespace string) ([]*provisioningapis.Repository, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the read seam
// it backs as one Source: the informer the controller registers its handler on,
// merged with the RepositoryGetter it reconciles against.
//
// Under NATS, Get reads reconcile state fresh from the API and writes it into the
// informer's shared snapshot; List (the quota count) reads that snapshot, which
// tolerates staleness (as stale as the resync interval) and so avoids an API LIST
// per check while the write-through keeps it warm between re-lists. Without NATS,
// both Get and List read the informer's generated cache lister.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) *Source[*provisioningapis.Repository] {
	c := client.ProvisioningV0alpha1()
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		return &Source[*provisioningapis.Repository]{
			DeltaSource: newDeltaSourceInformer(subscriber, provisioningapis.RepositoryResourceInfo, "", resync, store, true,
				typedListFunc(func(ctx context.Context) (runtime.Object, error) {
					return c.Repositories("").List(ctx, metav1.ListOptions{})
				})),
			Getter: Getter[*provisioningapis.Repository]{
				get: func(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
					return c.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
				},
				store: store,
			},
		}
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return &Source[*provisioningapis.Repository]{
		DeltaSource: inf.Informer(),
		Getter:      NewCachedRepositoryGetter(inf.Lister()),
	}
}

// NewCachedRepositoryGetter backs a RepositoryGetter with the informer's
// generated lister, i.e. the informer's local cache. It is the getter the
// non-NATS delta source embeds, and is exposed for controllers that reconcile
// against a lister in tests.
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
