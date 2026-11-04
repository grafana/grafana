package resources

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Get repository stats
//
//go:generate mockery --name ResourceLister --structname MockResourceLister --inpackage --filename resource_lister_mock.go --with-expecter
type ResourceLister interface {
	List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error)
	Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error)
}

type ResourceStore interface {
	resourcepb.ManagedObjectIndexClient
	resourcepb.ResourceIndexClient
}

type ResourceListerFromSearch struct {
	store ResourceStore
	// clients lists a collection's members through the groups that serve them; nil without one.
	clients ClientFactory
	// collections are the configured wildcard entries, matched on group pattern and kind.
	collections []SupportedResource
}

// NewResourceLister returns a lister over the managed-object index. A configured collection's
// members are listed through clients instead; see listCollectionMembers.
func NewResourceLister(store ResourceStore, clients ClientFactory, configured []SupportedResource) ResourceLister {
	return &ResourceListerFromSearch{
		store:       store,
		clients:     clients,
		collections: collectionResources(configured),
	}
}

// List implements ResourceLister.
func (o *ResourceListerFromSearch) List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	objects, err := o.store.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
		Namespace: namespace,
		Kind:      string(utils.ManagerKindRepo),
		Id:        repository,
	})
	if err := resource.ErrorFromResponse(objects.GetError(), err); err != nil {
		return nil, err
	}

	members, covered, err := o.listCollectionMembers(ctx, namespace, repository)
	if err != nil {
		return nil, err
	}

	collections := o.collectionGroups()
	items := make([]provisioning.ResourceListItem, 0, len(objects.Items))
	for _, v := range objects.Items {
		gr := schema.GroupResource{Group: v.Object.Group, Resource: v.Object.Resource}
		// A member listed through its own API group is reported there, not from the index: the
		// same resource twice is deleted as an orphan at a duplicate path by full sync.
		if covered.Has(gr) {
			continue
		}
		// Indexed under the collection's own key, which names neither the serving group nor the
		// served name, so no API server can be asked for it. Dropping it leaves a member of an
		// unserved collection out of cleanup; reporting it fails every reconcile of the delete.
		if collections.Has(v.Object.Group) {
			logging.FromContext(ctx).Warn("skipping indexed object of a collection no API group serves",
				"group", v.Object.Group, "resource", v.Object.Resource, "name", v.Object.Name)
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

	return &provisioning.ResourceList{Items: append(items, members...)}, nil
}

// collectionGroups returns the groups the configured collections are stored under.
func (o *ResourceListerFromSearch) collectionGroups() sets.Set[string] {
	groups := sets.New[string]()
	for _, r := range o.collections {
		groups.Insert(provisioningresources.CollectionGroup(r.Group))
	}
	return groups
}

// listCollectionMembers lists what a repository manages inside the configured collections, one
// request per served group instead of one for the whole repository, and returns the resources it
// answered for. The index cannot answer it: it reports a member under the collection's group, and
// possibly a different name, so the object it describes cannot be addressed.
func (o *ResourceListerFromSearch) listCollectionMembers(ctx context.Context, namespace, repository string) ([]provisioning.ResourceListItem, sets.Set[schema.GroupResource], error) {
	covered := sets.New[schema.GroupResource]()
	if len(o.collections) == 0 || o.clients == nil {
		return nil, covered, nil
	}

	clients, err := o.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, nil, fmt.Errorf("get clients for collection members: %w", err)
	}

	var items []provisioning.ResourceListItem
	for _, supported := range clients.SupportedResources() {
		if !o.isMember(supported.GroupKind) {
			continue
		}
		client, gvr, err := clients.ForKind(ctx, supported.WithVersion(""))
		if err != nil {
			return nil, nil, fmt.Errorf("get client for %s: %w", supported.GroupKind, err)
		}
		covered.Insert(gvr.GroupResource())
		err = ForEach(ctx, client, func(obj *unstructured.Unstructured) error {
			if item, ok := managedResourceItem(obj, gvr, repository); ok {
				items = append(items, item)
			}
			return nil
		})
		if err != nil {
			return nil, nil, fmt.Errorf("list %s: %w", gvr, err)
		}
	}
	return items, covered, nil
}

// isMember reports whether a served group and kind belong to one of the configured collections.
// The kind matters: a broad pattern such as *.grafana.app covers the group of a kind declared on
// its own, which is reported from the index and must not be listed here as well.
func (o *ResourceListerFromSearch) isMember(gk schema.GroupKind) bool {
	for _, r := range o.collections {
		if r.Kind == gk.Kind && provisioningresources.MatchesGroup(r.Group, gk.Group) {
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

// Stats implements ResourceLister.
func (o *ResourceListerFromSearch) Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error) {
	req := &resourcepb.CountManagedObjectsRequest{
		Namespace: namespace,
	}
	if repository != "" {
		req.Kind = string(utils.ManagerKindRepo)
		req.Id = repository
	}

	counts, err := o.store.CountManagedObjects(ctx, req)
	if err := resource.ErrorFromResponse(counts.GetError(), err); err != nil {
		return nil, err
	}

	lookup := make(map[string]*provisioning.ManagerStats)
	for _, v := range counts.Items {
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

	// When selecting an explicit repository, do not fetch global stats
	if repository != "" {
		return stats, nil
	}

	// Get full instance stats
	info, err := o.store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
		Namespace: namespace,
	})
	if err := resource.ErrorFromResponse(info.GetError(), err); err != nil {
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

	for _, v := range info.Stats {
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
