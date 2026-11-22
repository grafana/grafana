package informer

import (
	"context"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

// Cache is the read and write-through surface of an informer's identity
// snapshot that a getter keeps warm. The unified storage informer's Store
// satisfies it.
type Cache interface {
	List(ctx context.Context) []runtime.Object
	// Update writes obj into the store and reports whether the store took it.
	Update(ctx context.Context, obj runtime.Object) bool
	Delete(ctx context.Context, namespace, name string)
}

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

// NewClientRepositoryGetter backs Get with the API client, fresh for the
// reconcile, and the count with the NATS informer's store, which avoids an API
// LIST on every quota check. Each Get is written back into the store (or evicted
// on NotFound), so the count includes the repository the reconcile just read.
func NewClientRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, store Cache) RepositoryGetter {
	return clientRepositoryGetter{client: c, store: store}
}

type clientRepositoryGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
	store  Cache
}

func (g clientRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		g.store.Delete(ctx, namespace, name)
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	// Under round-robin delivery the live ADDED may have reached another
	// replica, and live MODIFIED events are not stored, so this store may not
	// hold the repository yet. The quota check that follows has to count it.
	g.store.Update(ctx, Identity(repo.Namespace, repo.Name, repo.ResourceVersion))
	return repo, nil
}

// CountRepositories walks the cluster-wide store. It holds identities only and
// one entry per repository, so the walk stays cheap next to the reconcile it
// serves.
func (g clientRepositoryGetter) CountRepositories(ctx context.Context, namespace string) (int, error) {
	count := 0
	for _, obj := range g.store.List(ctx) {
		if acc, err := meta.Accessor(obj); err == nil && acc.GetNamespace() == namespace {
			count++
		}
	}
	return count, nil
}

// ConfirmRepositoryCount lists the namespace from the API, which the store can lag.
func (g clientRepositoryGetter) ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error) {
	objs, _, err := ListAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return g.client.Repositories(namespace).List(ctx, opts)
	})
	if err != nil {
		return 0, err
	}
	return len(objs), nil
}

// ConnectionGetter is the read seam the connection controller reconciles
// against. It exposes only the single connection under reconciliation, so the
// source can be swapped without touching the controller.
type ConnectionGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error)
}

// NewCachedConnectionGetter backs a ConnectionGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedConnectionGetter(lister listers.ConnectionLister) ConnectionGetter {
	return cachedConnectionGetter{lister: lister}
}

type cachedConnectionGetter struct {
	lister listers.ConnectionLister
}

func (g cachedConnectionGetter) Get(_ context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.lister.Connections(namespace).Get(name)
}

// NewClientConnectionGetter backs a ConnectionGetter with the API client, for
// the NATS watch where there is no informer cache to serve a fresh reconcile read.
func NewClientConnectionGetter(c typedclient.ProvisioningV0alpha1Interface) ConnectionGetter {
	return clientConnectionGetter{client: c}
}

type clientConnectionGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
}

func (g clientConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.client.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
}

// PageFunc reads one page of a LIST.
type PageFunc func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error)

// Identity is what the informer snapshots hold in place of an object.
func Identity(namespace, name, resourceVersion string) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
		Namespace:       namespace,
		Name:            name,
		ResourceVersion: resourceVersion,
	}}
}

// ListAllPages reads every page of a LIST, following continue tokens: unified
// storage caps a single page at 500 items / 2 MB, and the informers' re-list
// must be complete — a truncated list would strand objects beyond the first
// page and make the informer's snapshot diff report them as deleted.
//
// It also returns the resource version the snapshot was read at, which the
// informer uses to reconcile the re-list against live write-throughs that raced
// it. A paginated LIST pins the resource version across pages via the continue
// token, so the first page's is the snapshot version.
func ListAllPages(ctx context.Context, page PageFunc) ([]runtime.Object, int64, error) {
	var listRV int64
	capture := func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		obj, err := page(ctx, opts)
		if err == nil && listRV == 0 {
			if acc, aerr := meta.ListAccessor(obj); aerr == nil {
				if rv, perr := strconv.ParseInt(acc.GetResourceVersion(), 10, 64); perr == nil {
					listRV = rv
				}
			}
		}
		return obj, err
	}
	p := pager.New(capture)
	// On an expired continue token the pager's default fallback re-issues one
	// unpaginated LIST — which the server would silently cap again, handing the
	// informer exactly the truncated snapshot this helper exists to prevent.
	// Fail instead; the informer retries the whole re-list on its next tick.
	p.FullListIfExpired = false
	var out []runtime.Object
	if err := p.EachListItem(ctx, metav1.ListOptions{Limit: 500}, func(obj runtime.Object) error {
		out = append(out, obj)
		return nil
	}); err != nil {
		return nil, 0, err
	}
	return out, listRV, nil
}
