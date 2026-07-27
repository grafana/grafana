package informer

import (
	"context"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// NewJobDeltaSource returns the job delta source and, when it is the NATS-backed
// informer, the snapshot the job store reads claim candidates from. The job
// controller reads no lister, so callers need only the DeltaSource for
// notifications; the returned Cache lets the driver claim from the informer
// snapshot instead of a cluster-wide `!claim` List. It is nil for the
// apiserver-backed source, whose callers fall back to the List path.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) (DeltaSource, usinformer.Cache) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		inf := NewJobInformer(subscriber, client, "", resync, store)
		// Keep the snapshot fresh between re-lists so a just-created job becomes a
		// claim candidate immediately rather than at the next re-list. Registered
		// before the controller handler so the store is written before the
		// notification that wakes a driver to claim.
		// Registration only rejects a nil handler, and losing it would merely make
		// the snapshot refresh at re-list cadence rather than break claiming, so
		// there is nothing for this constructor to report.
		_, _ = inf.AddEventHandler(jobCacheWriteThrough(store))
		return inf, store
	}
	return informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Jobs().Informer(), nil
}

// jobCacheWriteThrough mirrors informer adds into the shared store so a job
// created between re-lists is claimable right away.
//
// It deliberately does NOT handle updates. A live notification carries only
// namespace/name (see informer.ObjectFunc), and the informer dispatches DELETED
// as OnUpdate — so mirroring updates would write label-less stubs over full
// cached jobs, hiding the `job-claim` label the claim path pre-filters on, and
// would resurrect just-deleted jobs as claim candidates. Both only cost wasted
// Gets against the per-claim budget, but under job churn that budget is exactly
// what the claim path cannot afford to waste. Re-lists refresh the store
// wholesale, and the claim path writes back the objects it Gets, so updates need
// no mirroring here.
func jobCacheWriteThrough(store usinformer.Store) cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			if o, ok := obj.(runtime.Object); ok {
				store.Update(context.Background(), o)
			}
		},
		DeleteFunc: func(obj interface{}) {
			if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
				obj = tombstone.Obj
			}
			if o, ok := obj.(runtime.Object); ok {
				if m, err := meta.Accessor(o); err == nil {
					store.Delete(context.Background(), m.GetNamespace(), m.GetName())
				}
			}
		},
	}
}

// NewJobInformer builds an Informer for jobs.
func NewJobInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store) *usinformer.Informer {
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
	return usinformer.NewInformer(subscriber, provisioningapis.JobResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}
