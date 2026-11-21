package resources

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ResourceLister reads what one repository manages. This is the whole of what the operators ask
// for, so a reader answering per repository needs nothing else.
//
//go:generate mockery --name ResourceLister --structname MockResourceLister --inpackage --filename resource_lister_mock.go --with-expecter
type ResourceLister interface {
	List(ctx context.Context, namespace, repository string, opts ListOptions) (*provisioning.ResourceList, error)
	// RepositoryStats counts what one repository manages.
	RepositoryStats(ctx context.Context, namespace, repository string) ([]provisioning.ResourceCount, error)
}

// NamespaceStatsReader counts every manager in the namespace alongside the instance and unmanaged
// totals, which only the API server's own stats route reads.
//
//go:generate mockery --name NamespaceStatsReader --structname MockNamespaceStatsReader --inpackage --filename namespace_stats_reader_mock.go --with-expecter
type NamespaceStatsReader interface {
	Stats(ctx context.Context, namespace string) (*provisioning.ResourceStats, error)
}

type ResourceStore interface {
	resourcepb.ManagedObjectIndexClient
	resourcepb.ResourceIndexClient
}

// Values of [provisioning] resource_lister, selecting where the managed-resource list and the
// repository stats are read from.
const (
	// ListerSearch reads the unified-storage managed-object index.
	ListerSearch = "search"
	// ListerAPIs reads the provisioning API server's own repository subresources.
	ListerAPIs = "apis"
)

// NewResourceListerForMode returns the lister named by [provisioning] resource_lister. Each reader
// takes one dependency and ignores the other: store in search mode, provisioningAPI and pageSize in
// apis mode.
func NewResourceListerForMode(mode string, store ResourceStore, clients ClientFactory, configured []SupportedResource, provisioningAPI rest.Interface, pageSize int64) (ResourceLister, error) {
	if err := ValidateListerMode(mode); err != nil {
		return nil, err
	}
	if mode == ListerAPIs {
		if provisioningAPI == nil {
			return nil, fmt.Errorf("[provisioning] resource_lister %q needs a provisioning API client", ListerAPIs)
		}
		return NewResourceListerFromProvisioningAPI(provisioningAPI, pageSize), nil
	}
	return NewResourceLister(store, clients, configured), nil
}

// ValidateListerMode rejects a [provisioning] resource_lister value that names no reader.
func ValidateListerMode(mode string) error {
	switch mode {
	case "", ListerSearch, ListerAPIs:
		return nil
	default:
		return fmt.Errorf("invalid [provisioning] resource_lister %q: expected %q or %q", mode, ListerSearch, ListerAPIs)
	}
}

// NeedsResourceStore reports whether a lister mode reads unified storage directly. An unrecognised
// mode needs nothing: it has to fail validation rather than a store lookup.
func NeedsResourceStore(mode string) bool { return mode == "" || mode == ListerSearch }

type ResourceListerFromSearch struct {
	store ResourceStore
	// clients lists a collection's members through the groups that serve them; nil without one.
	clients ClientFactory
	// configured is the whole configured set, disabled entries included: a kind addressable under
	// its own group keeps its index rows whether or not the pipeline acts on it.
	configured []SupportedResource
	// collections are the configured collection entries, matched on group and kind.
	collections []SupportedResource
	// external is whether any configured entry is stored outside the index.
	external bool
}

// NewResourceLister returns a lister over the managed-object index. A configured collection's
// members, and the kinds stored outside unified storage, are listed and counted through clients
// instead; see listThroughAPIGroups and countExternal. This is the only reader that also counts
// the whole namespace.
func NewResourceLister(store ResourceStore, clients ClientFactory, configured []SupportedResource) *ResourceListerFromSearch {
	return &ResourceListerFromSearch{
		store:       store,
		clients:     clients,
		configured:  configured,
		collections: collectionResources(configured),
		external:    slices.ContainsFunc(configured, SupportedResource.IsExternallyStored),
	}
}

// List implements ResourceLister.
func (o *ResourceListerFromSearch) List(ctx context.Context, namespace, repository string, opts ListOptions) (*provisioning.ResourceList, error) {
	page, err := newResourcePage(opts)
	if err != nil {
		return nil, err
	}

	objects, err := o.store.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
		Namespace: namespace,
		Kind:      string(utils.ManagerKindRepo),
		Id:        repository,
	})
	if err != nil {
		return nil, err
	}

	scan, err := o.listThroughAPIGroups(ctx, namespace, repository)
	if err != nil {
		return nil, err
	}

	collections := o.collectionGroups()
	items := make([]provisioning.ResourceListItem, 0, len(objects.Items))
	for _, v := range objects.Items {
		gr := schema.GroupResource{Group: v.Object.Group, Resource: v.Object.Resource}
		// A resource listed through its own API group is reported there, not from the index: the
		// same resource twice is deleted as an orphan at a duplicate path by full sync.
		if scan.covered.Has(gr) {
			continue
		}
		// Indexed under the collection's own key, which names neither the serving group nor the
		// served name, so no API server can be asked for it. Dropping it leaves a member of an
		// unserved collection out of cleanup; reporting it fails every reconcile of the delete.
		// A kind declared under its own name is addressable and stays, even when it is stored in
		// a group some collection also names.
		if collections.Has(gr.Group) && !scan.declared.Has(gr) {
			logging.FromContext(ctx).Warn("skipping indexed object of a collection no API group serves",
				"group", gr.Group, "resource", gr.Resource, "name", v.Object.Name)
			continue
		}
		items = append(items, provisioning.ResourceListItem{
			Path:     v.Path,
			Group:    v.Object.Group,
			Resource: v.Object.Resource,
			Name:     v.Object.Name,
			Hash:     v.Hash,
			Time:     v.Time,
			Title:    v.Title,
			Folder:   v.Folder,
		})
	}

	return page.of(append(items, scan.items...)), nil
}

// collectionGroups returns the groups the configured collections are stored under.
func (o *ResourceListerFromSearch) collectionGroups() sets.Set[string] {
	groups := sets.New[string]()
	for _, r := range o.collections {
		groups.Insert(provisioningresources.CollectionGroup(r.Group))
	}
	return groups
}

// addressableResources returns every kind that can be addressed through its own API group: the
// active set the pipeline acts on, plus the configured kinds left out of it. A disabled kind is
// still managed by a repository, and cleanup lists it, so its index rows must survive the drop.
func (o *ResourceListerFromSearch) addressableResources(clients ResourceClients) []SupportedResource {
	active := clients.SupportedResources()
	out := make([]SupportedResource, 0, len(active)+len(o.configured))
	out = append(out, active...)
	seen := sets.New[schema.GroupKind]()
	for _, r := range active {
		seen.Insert(r.GroupKind)
	}
	for _, r := range o.configured {
		if !seen.Has(r.GroupKind) && !provisioningresources.IsCollection(r.Group) {
			out = append(out, r)
		}
	}
	return out
}

// apiScan is what the API group scan answered: the resources it listed, which the index no
// longer has to report, and the resources of the kinds it did not list, which it still does.
type apiScan struct {
	items    []provisioning.ResourceListItem
	covered  sets.Set[schema.GroupResource]
	declared sets.Set[schema.GroupResource]
}

// listThroughAPIGroups lists what a repository manages that the index cannot answer for, one
// request per served group instead of one for the whole repository: the members of the configured
// collections, which the index reports under the collection's group, and possibly a different
// name, so the object it describes cannot be addressed; and the kinds stored outside unified
// storage, which the index does not hold at all.
func (o *ResourceListerFromSearch) listThroughAPIGroups(ctx context.Context, namespace, repository string) (apiScan, error) {
	scan := apiScan{
		covered:  sets.New[schema.GroupResource](),
		declared: sets.New[schema.GroupResource](),
	}
	if (len(o.collections) == 0 && !o.external) || o.clients == nil {
		return scan, nil
	}

	clients, err := o.clients.Clients(ctx, namespace)
	if err != nil {
		return scan, fmt.Errorf("get clients for unindexed resources: %w", err)
	}

	collections := o.collectionGroups()
	var items []provisioning.ResourceListItem
	for _, supported := range o.addressableResources(clients) {
		listed := o.isMember(supported.GroupKind) || supported.IsExternallyStored()
		// A kind stored in a group a collection also names is resolved as well, so its index
		// rows can be told apart by resource; no other kind needs a lookup here.
		if !listed && !collections.Has(supported.Group) {
			continue
		}
		client, gvr, err := clients.ForKind(ctx, supported.WithVersion(""))
		if err != nil {
			return scan, fmt.Errorf("get client for %s: %w", supported.GroupKind, err)
		}
		if !listed {
			scan.declared.Insert(gvr.GroupResource())
			continue
		}
		scan.covered.Insert(gvr.GroupResource())
		err = ForEach(ctx, client, func(obj *unstructured.Unstructured) error {
			if item, ok := managedResourceItem(obj, gvr, repository); ok {
				items = append(items, item)
			}
			return nil
		})
		if err != nil {
			return scan, fmt.Errorf("list %s: %w", gvr, err)
		}
	}
	scan.items = items
	return scan, nil
}

// isMember reports whether a served group and kind belong to one of the configured collections.
// The kind matters: a broad pattern such as *.grafana.app covers the group of a kind declared on
// its own, which is reported from the index and must not be listed here as well.
func (o *ResourceListerFromSearch) isMember(gk schema.GroupKind) bool {
	for _, r := range o.collections {
		if r.Kind == gk.Kind && provisioningresources.CoversGroup(r.Group, gk.Group) {
			return true
		}
	}
	return false
}

// managedResourceItem builds the list item for an object managed by repository, from the same
// properties the index reports. It returns false for anything else.
func managedResourceItem(obj *unstructured.Unstructured, gvr schema.GroupVersionResource, repository string) (provisioning.ResourceListItem, bool) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return provisioning.ResourceListItem{}, false
	}
	manager, ok := meta.GetManagerProperties()
	if !ok || manager.Kind != utils.ManagerKindRepo || manager.Identity != repository {
		return provisioning.ResourceListItem{}, false
	}
	source, _ := meta.GetSourceProperties()
	return provisioning.ResourceListItem{
		Path:     source.Path,
		Group:    gvr.Group,
		Resource: gvr.Resource,
		Name:     obj.GetName(),
		Hash:     source.Checksum,
		Time:     source.TimestampMillis,
		Title:    meta.FindTitle(""),
		Folder:   meta.GetFolder(),
	}, true
}

// RepositoryStats implements ResourceLister.
func (o *ResourceListerFromSearch) RepositoryStats(ctx context.Context, namespace, repository string) ([]provisioning.ResourceCount, error) {
	ext, err := o.countExternal(ctx, namespace)
	if err != nil {
		return nil, err
	}
	stats, err := o.managedStats(ctx, &resourcepb.CountManagedObjectsRequest{
		Namespace: namespace,
		Kind:      string(utils.ManagerKindRepo),
		Id:        repository,
	}, ext)
	if err != nil {
		return nil, err
	}
	// Kind narrows the request but cannot be relied on to have been applied: search can run at an
	// older deployment cadence than this caller, and a server predating grafana/grafana#137504
	// returns every manager sharing the id -- which the bootstrap repository does with its
	// file-provisioning manager.
	for _, manager := range stats.Managed {
		if manager.Kind == utils.ManagerKindRepo && manager.Identity == repository {
			return manager.Stats, nil
		}
	}
	return nil, apierrors.NewNotFound(schema.GroupResource{Group: provisioning.GROUP, Resource: "stats"}, repository)
}

// externalStats counts the kinds stored outside unified storage, in the rows the index answers
// with. covered names their resources: a row the index holds for one replaces nothing, it is
// dropped, so a resource is never counted from both.
type externalStats struct {
	covered  sets.Set[schema.GroupResource]
	managed  []*resourcepb.CountManagedObjectsResponse_ResourceCount
	instance []*resourcepb.ResourceStatsResponse_Stats
}

type managerKey struct {
	kind     utils.ManagerKind
	identity string
}

// countExternal counts every object of the externally stored kinds through its API group, both
// in total and per manager. Unlike the index, the API server has no count, so each is listed.
func (o *ResourceListerFromSearch) countExternal(ctx context.Context, namespace string) (externalStats, error) {
	ext := externalStats{covered: sets.New[schema.GroupResource]()}
	if !o.external || o.clients == nil {
		return ext, nil
	}

	clients, err := o.clients.Clients(ctx, namespace)
	if err != nil {
		return ext, fmt.Errorf("get clients for externally stored resources: %w", err)
	}

	for _, supported := range o.addressableResources(clients) {
		if !supported.IsExternallyStored() {
			continue
		}
		client, gvr, err := clients.ForKind(ctx, supported.WithVersion(""))
		if err != nil {
			return ext, fmt.Errorf("get client for %s: %w", supported.GroupKind, err)
		}
		ext.covered.Insert(gvr.GroupResource())

		var total int64
		var managers []managerKey
		managed := make(map[managerKey]int64)
		err = ForEach(ctx, client, func(obj *unstructured.Unstructured) error {
			meta, err := utils.MetaAccessor(obj)
			if err != nil {
				return fmt.Errorf("read metadata of %s: %w", obj.GetName(), err)
			}
			total++
			manager, ok := meta.GetManagerProperties()
			if !ok {
				return nil
			}
			key := managerKey{kind: manager.Kind, identity: manager.Identity}
			if _, seen := managed[key]; !seen {
				managers = append(managers, key)
			}
			managed[key]++
			return nil
		})
		if err != nil {
			return ext, fmt.Errorf("count %s: %w", gvr, err)
		}

		if total > 0 {
			ext.instance = append(ext.instance, &resourcepb.ResourceStatsResponse_Stats{
				Group: gvr.Group, Resource: gvr.Resource, Count: total,
			})
		}
		for _, m := range managers {
			ext.managed = append(ext.managed, &resourcepb.CountManagedObjectsResponse_ResourceCount{
				Kind: string(m.kind), Id: m.identity, Group: gvr.Group, Resource: gvr.Resource, Count: managed[m],
			})
		}
	}
	return ext, nil
}

// withoutCovered returns the index rows of the resources the external counts do not cover.
func withoutCovered[T interface {
	GetGroup() string
	GetResource() string
}](rows []T, covered sets.Set[schema.GroupResource]) []T {
	return slices.DeleteFunc(slices.Clone(rows), func(row T) bool {
		return covered.Has(schema.GroupResource{Group: row.GetGroup(), Resource: row.GetResource()})
	})
}

// managedStats counts the managed objects the request selects, one entry per manager, with the
// externally stored kinds counted from ext rather than the index.
func (o *ResourceListerFromSearch) managedStats(ctx context.Context, req *resourcepb.CountManagedObjectsRequest, ext externalStats) (*provisioning.ResourceStats, error) {
	counts, err := o.store.CountManagedObjects(ctx, req)
	if err != nil {
		return nil, err
	}

	lookup := make(map[string]*provisioning.ManagerStats)
	for _, v := range append(withoutCovered(counts.Items, ext.covered), ext.managed...) {
		key := v.Kind + ":" + v.Id
		m := lookup[key]
		if m == nil {
			m = &provisioning.ManagerStats{
				Kind:     utils.ManagerKind(v.Kind),
				Identity: v.Id,
			}
			lookup[key] = m
		}
		m.Stats = append(m.Stats, provisioning.ResourceCount{
			Group:    v.Group,
			Resource: v.Resource,
			Count:    v.Count,
		})
	}
	stats := &provisioning.ResourceStats{
		TypeMeta: metav1.TypeMeta{
			APIVersion: provisioning.SchemeGroupVersion.String(),
			Kind:       "ResourceStats",
		},
	}
	for _, v := range lookup {
		stats.Managed = append(stats.Managed, *v)
	}
	return stats, nil
}

// Stats implements NamespaceStatsReader.
func (o *ResourceListerFromSearch) Stats(ctx context.Context, namespace string) (*provisioning.ResourceStats, error) {
	ext, err := o.countExternal(ctx, namespace)
	if err != nil {
		return nil, err
	}
	stats, err := o.managedStats(ctx, &resourcepb.CountManagedObjectsRequest{Namespace: namespace}, ext)
	if err != nil {
		return nil, err
	}

	// Get full instance stats
	info, err := o.store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
		Namespace: namespace,
	})
	if err != nil {
		return nil, err
	}

	// Create a map to track managed counts by group/resource
	managedCounts := make(map[string]int64)
	for _, manager := range stats.Managed {
		for _, managedStat := range manager.Stats {
			key := managedStat.Group + ":" + managedStat.Resource
			managedCounts[key] += managedStat.Count
		}
	}

	for _, v := range append(withoutCovered(info.Stats, ext.covered), ext.instance...) {
		stats.Instance = append(stats.Instance, provisioning.ResourceCount{
			Group:    v.Group,
			Resource: v.Resource,
			Count:    v.Count,
		})

		// Calculate unmanaged count: total - managed
		key := v.Group + ":" + v.Resource
		managedCount := managedCounts[key]
		unmanagedCount := v.Count - managedCount

		if unmanagedCount > 0 {
			stats.Unmanaged = append(stats.Unmanaged, provisioning.ResourceCount{
				Group:    v.Group,
				Resource: v.Resource,
				Count:    unmanagedCount,
			})
		}
	}
	return stats, nil
}

var (
	_ ResourceLister       = (*ResourceListerFromSearch)(nil)
	_ NamespaceStatsReader = (*ResourceListerFromSearch)(nil)
)
