package informer

import (
	"context"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"

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
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics Metrics, freshness *operator.FreshnessMetrics) (DeltaSource, RepositoryGetter, error) {
	if nats.Enabled(subscriber) {
		announced := operator.NewAnnouncementTracker(operator.AnnouncementTrackerOptions{})
		source, err := NewRepositoryInformer(subscriber, client, "", resync, keys, usinformer.BusSourceOptions{
			Announcements: announced,
			Metrics:       metrics.Bus,
			Delivery:      metrics.Delivery,
		})
		if err != nil {
			return nil, nil, err
		}
		getter := NewClientRepositoryGetter(client.ProvisioningV0alpha1(), source)
		return source, observedRepositoryGetter{
			RepositoryGetter: getter,
			tracker:          announced,
			recorder:         freshness.Recorder(usinformer.SDKKind(&provisioningapis.RepositoryResourceInfo)),
		}, nil
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
	page := func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Repositories(namespace).List(ctx, opts)
	}
	return usinformer.NewBusDeltaSource(subscriber, &metav1.PartialObjectMetadata{},
		&provisioningapis.RepositoryResourceInfo, resync, page, opts)
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

// RepositoryCounter is the informer's view of how many repositories a namespace holds, with the read-through a
// shared delivery group makes necessary.
type RepositoryCounter interface {
	Count(namespace string) int
	Observe(obj resource.Object)
	Forget(id resource.Identifier)
}

// NewClientRepositoryGetter backs Get with the API client, fresh for the
// reconcile, and the count with the informer's snapshot, which avoids an API
// LIST on every quota check.
//
// Each read is written back through the counter: under round-robin delivery the
// live ADDED may have reached another replica, so the repository this reconcile
// just read can be absent from the snapshot, and the quota check that follows
// has to count it. A re-list absorbs the entry either way.
func NewClientRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, counter RepositoryCounter) RepositoryGetter {
	return &clientRepositoryGetter{client: c, counter: counter}
}

type clientRepositoryGetter struct {
	client  typedclient.ProvisioningV0alpha1Interface
	counter RepositoryCounter
}

func (g *clientRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		g.counter.Forget(resource.Identifier{Namespace: namespace, Name: name})
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	g.counter.Observe(resource.NewWrappedObject[resource.WrappedObjectType](repo))
	return repo, nil
}

// CountRepositories reads the informer's snapshot, which includes the repository
// this reconcile just read.
func (g *clientRepositoryGetter) CountRepositories(_ context.Context, namespace string) (int, error) {
	return g.counter.Count(namespace), nil
}

// ConfirmRepositoryCount lists the namespace from the API, which the snapshot can lag.
func (g *clientRepositoryGetter) ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error) {
	p := pager.New(func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return g.client.Repositories(namespace).List(ctx, opts)
	})
	// An expired continue token must not fall back to one unpaginated list: the server would cap it again and the
	// confirmation would under-count exactly when it is relied on to release a block.
	p.FullListIfExpired = false
	count := 0
	if err := p.EachListItem(ctx, metav1.ListOptions{Limit: 500}, func(runtime.Object) error {
		count++
		return nil
	}); err != nil {
		return 0, err
	}
	return count, nil
}

// observedRepositoryGetter records how each reconcile read compared to the notification that triggered it. Reads
// pass through untouched; only the observation is added.
type observedRepositoryGetter struct {
	RepositoryGetter
	tracker  *operator.AnnouncementTracker
	recorder operator.FreshnessRecorder
}

func (g observedRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	return operator.ObserveRead(ctx, g.tracker, g.recorder, resource.Identifier{Namespace: namespace, Name: name},
		func(ctx context.Context) (*provisioningapis.Repository, error) {
			return g.RepositoryGetter.Get(ctx, namespace, name)
		})
}
