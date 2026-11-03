package resources

import (
	"context"
	"fmt"

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
	// clients lists the members of a collection through the API groups that serve them; nil when
	// no collection is configured.
	clients ClientFactory
	// collections are the configured wildcard patterns, empty unless one is configured.
	collections []string
}

// NewResourceLister returns a lister over the managed-object index. The members of a configured
// collection are listed through clients instead; see listCollectionMembers.
func NewResourceLister(store ResourceStore, clients ClientFactory, configured []SupportedResource) ResourceLister {
	return &ResourceListerFromSearch{
		store:       store,
		clients:     clients,
		collections: collectionPatterns(configured),
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

	collections := o.collectionGroups()
	items := make([]provisioning.ResourceListItem, 0, len(objects.Items))
	for _, v := range objects.Items {
		// A collection's members are indexed under the collection's own key, which names neither
		// the group that serves them nor the name it serves them under. They are listed through
		// their own API groups below instead.
		if collections.Has(v.Object.Group) {
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

	members, err := o.listCollectionMembers(ctx, namespace, repository)
	if err != nil {
		return nil, err
	}

	return &provisioning.ResourceList{Items: append(items, members...)}, nil
}

// collectionGroups returns the groups the configured collections are stored under.
func (o *ResourceListerFromSearch) collectionGroups() sets.Set[string] {
	groups := sets.New[string]()
	for _, pattern := range o.collections {
		groups.Insert(provisioningresources.CollectionGroup(pattern))
	}
	return groups
}

// listCollectionMembers lists what a repository manages inside the configured collections, one
// request per served group, filtering on the same manager annotations the index does.
//
// The index cannot answer this. A collection's members are stored under the collection's group,
// and may be stored under a different name than the one they are served by, so an item it reports
// identifies an object no API server can be asked for. Going through the served groups costs a
// request per member rather than one for the whole repository, but it is the only answer that
// yields an addressable resource and it needs nothing from unified storage.
func (o *ResourceListerFromSearch) listCollectionMembers(ctx context.Context, namespace, repository string) ([]provisioning.ResourceListItem, error) {
	if len(o.collections) == 0 || o.clients == nil {
		return nil, nil
	}

	clients, err := o.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("get clients for collection members: %w", err)
	}

	var items []provisioning.ResourceListItem
	for _, supported := range clients.SupportedResources() {
		if !o.isMember(supported.Group) {
			continue
		}
		client, gvr, err := clients.ForKind(ctx, supported.WithVersion(""))
		if err != nil {
			return nil, fmt.Errorf("get client for %s: %w", supported.GroupKind, err)
		}
		err = ForEach(ctx, client, func(obj *unstructured.Unstructured) error {
			if item, ok := managedResourceItem(obj, gvr, repository); ok {
				items = append(items, item)
			}
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("list %s: %w", gvr, err)
		}
	}
	return items, nil
}

// isMember reports whether a served group belongs to one of the configured collections.
func (o *ResourceListerFromSearch) isMember(group string) bool {
	for _, pattern := range o.collections {
		if provisioningresources.MatchesGroup(pattern, group) {
			return true
		}
	}
	return false
}

// managedResourceItem builds the list item for an object managed by repository, from the same
// source properties the index reports. It returns false for anything repository does not manage.
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
