package informer

import (
	"context"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/apiserver/keys/keyslister"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against: the single repository under reconciliation, and the count for the
// quota check. Get must return a current object; the count tolerates staleness.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	// CountRepositories includes repositories awaiting their finalizers, so a
	// namespace stays at its quota until a deletion finishes. That keeps the
	// count answerable from identities alone.
	CountRepositories(ctx context.Context, namespace string) (int, error)
	// ConfirmRepositoryCount is CountRepositories from a source that cannot miss
	// repositories another replica saw. Slower; used before unblocking.
	ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API and the
// quota count from the informer's snapshot; otherwise the getter reads the
// informer's cache lister.
//
// A non-nil keys makes the NATS re-list keys-only; nil keeps the full-object
// list.
//
// freshness instruments how the getter's reads compare to the notifications
// that triggered them (see freshness.go); nil disables the observation. It
// applies to the NATS path only — the apiserver path reads a cache the watch
// keeps current, so there is no cross-replica read visibility to measure.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *operator.BusInformerMetrics, freshness *FreshnessMetrics) (DeltaSource, RepositoryGetter, error) {
	if nats.Enabled(subscriber) {
		gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
		announced := newAnnouncements()
		source, err := NewRepositoryInformer(subscriber, client, "", resync, keys, usinformer.BusSourceOptions{
			Announcements: announced,
			Metrics:       metrics,
		})
		if err != nil {
			return nil, nil, err
		}
		getter := NewClientRepositoryGetter(client.ProvisioningV0alpha1(), source)
		// The getter remembers what it read until the snapshot catches up, and a vanished repository never appears
		// there, so the delete has to reach it from the same event stream the snapshot is pruned by.
		if _, err := source.AddEventHandler(forgetDeleted{getter: getter}); err != nil {
			return nil, nil, err
		}
		return source, observeRepositoryFreshness(getter, announced, freshness.Recorder(gvr.Resource)), nil
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return inf.Informer(), NewCachedRepositoryGetter(inf.Lister()), nil
}

// NewRepositoryInformer builds the NATS-mode repository source. namespace scopes
// the subscription and the re-list; pass "" to cover every namespace.
func NewRepositoryInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, keys keysapi.Lister, opts usinformer.BusSourceOptions) (usinformer.BusSource, error) {
	c := client.ProvisioningV0alpha1()
	if keys != nil {
		opts.Keys = keyslister.New(keys)
	}
	opts.Namespace = namespace
	opts.Group = queueGroup
	// Delivered as a projection rather than the generated type: a live event carries the identity alone, and a
	// zero-valued spec on a real object would read as a spec that is set to nothing.
	list := func(ctx context.Context) ([]runtime.Object, error) {
		objs, _, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Repositories(namespace).List(ctx, opts)
		})
		return projectObjects(objs), err
	}
	return usinformer.NewBusDeltaSource(subscriber, &metav1.PartialObjectMetadata{},
		&provisioningapis.RepositoryResourceInfo, resync, list, opts)
}

// NewCachedRepositoryGetter backs a RepositoryGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedRepositoryGetter(lister listers.RepositoryLister) RepositoryGetter {
	return cachedRepositoryGetter{lister: lister}
}

type cachedRepositoryGetter struct {
	lister listers.RepositoryLister
}

func (g cachedRepositoryGetter) Get(_ context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	return g.lister.Repositories(namespace).Get(name)
}

func (g cachedRepositoryGetter) CountRepositories(_ context.Context, namespace string) (int, error) {
	repos, err := g.lister.Repositories(namespace).List(labels.Everything())
	if err != nil {
		return 0, err
	}
	return len(repos), nil
}

// ConfirmRepositoryCount reads the same lister: the apiserver watch reaches every replica.
func (g cachedRepositoryGetter) ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error) {
	return g.CountRepositories(ctx, namespace)
}

// RepositorySnapshot is the identity set an informer last reconciled with storage.
type RepositorySnapshot interface {
	Snapshot() []resource.Identifier
}

// NewClientRepositoryGetter backs Get with the API client, fresh for the
// reconcile, and the count with the informer's snapshot, which avoids an API
// LIST on every quota check.
//
// The snapshot is read-only and lags: under round-robin delivery a live ADDED
// may have reached another replica, so a repository this reconcile just read
// can be absent from it. Each successful Get is therefore remembered until a
// re-list picks it up, and dropped on NotFound, so the count that follows
// includes the repository the reconcile just read.
func NewClientRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, snapshot RepositorySnapshot) RepositoryGetter {
	return &clientRepositoryGetter{client: c, snapshot: snapshot, recent: map[resource.Identifier]struct{}{}}
}

// forgetDeleted drops a deleted repository from the getter's remembered set. Without it a repository that is gone
// is in neither the snapshot nor the set's pruning path, so the namespace would stay at its quota forever.
type forgetDeleted struct {
	getter RepositoryGetter
}

var _ cache.ResourceEventHandler = forgetDeleted{}

func (forgetDeleted) OnAdd(any, bool)   {}
func (forgetDeleted) OnUpdate(any, any) {}

func (h forgetDeleted) OnDelete(obj any) {
	getter, ok := h.getter.(*clientRepositoryGetter)
	if !ok {
		return
	}
	acc, err := meta.Accessor(obj)
	if err != nil {
		return
	}
	getter.forget(resource.Identifier{Namespace: acc.GetNamespace(), Name: acc.GetName()})
}

// forget drops one repository from the remembered set.
func (g *clientRepositoryGetter) forget(id resource.Identifier) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.recent, id)
}

type clientRepositoryGetter struct {
	client   typedclient.ProvisioningV0alpha1Interface
	snapshot RepositorySnapshot

	mu     sync.Mutex
	recent map[resource.Identifier]struct{}
}

func (g *clientRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	id := resource.Identifier{Namespace: namespace, Name: name}
	if apierrors.IsNotFound(err) {
		g.forget(id)
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	g.mu.Lock()
	g.recent[id] = struct{}{}
	g.mu.Unlock()
	return repo, nil
}

// CountRepositories counts the namespace out of the informer's snapshot plus
// anything this getter read that the snapshot has not caught up with. Entries
// the snapshot now holds are dropped as it walks, so that set drains on the next
// re-list rather than growing.
func (g *clientRepositoryGetter) CountRepositories(_ context.Context, namespace string) (int, error) {
	names := map[string]struct{}{}

	g.mu.Lock()
	defer g.mu.Unlock()
	for _, id := range g.snapshot.Snapshot() {
		delete(g.recent, id)
		if id.Namespace == namespace {
			names[id.Name] = struct{}{}
		}
	}
	for id := range g.recent {
		if id.Namespace == namespace {
			names[id.Name] = struct{}{}
		}
	}
	return len(names), nil
}

// ConfirmRepositoryCount lists the namespace from the API, which the store can lag.
func (g *clientRepositoryGetter) ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error) {
	objs, _, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return g.client.Repositories(namespace).List(ctx, opts)
	})
	if err != nil {
		return 0, err
	}
	return len(objs), nil
}
