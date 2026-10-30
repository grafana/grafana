package resources

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
	store   ResourceStore
	clients ClientFactory
}

func NewResourceLister(store ResourceStore, clients ClientFactory) ResourceLister {
	return &ResourceListerFromSearch{store: store, clients: clients}
}

func NewResourceListerForMigrations(store ResourceStore, clients ClientFactory) ResourceLister {
	return &ResourceListerFromSearch{
		store:   store,
		clients: clients,
	}
}

func (o *ResourceListerFromSearch) kinds(ctx context.Context, namespace string) func(group, resource string) string {
	var kinds map[schema.GroupResource]string
	if o.clients != nil {
		clients, err := o.clients.Clients(ctx, namespace)
		if err == nil {
			kinds, err = clients.Kinds(ctx)
		}
		if err != nil {
			logging.FromContext(ctx).Warn("failed to resolve resource kinds", "error", err)
		}
	}
	return func(group, resource string) string {
		return kinds[schema.GroupResource{Group: group, Resource: resource}]
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

	kindOf := o.kinds(ctx, namespace)
	items := make([]provisioning.ResourceListItem, 0, len(objects.Items))
	for _, v := range objects.Items {
		items = append(items, provisioning.ResourceListItem{
			Path:     v.Path,
			Group:    v.Object.Group,
			Resource: v.Object.Resource,
			Kind:     kindOf(v.Object.Group, v.Object.Resource),
			Name:     v.Object.Name,
			Hash:     v.Hash,
			Time:     v.Time,
			Title:    v.Title,
			Folder:   v.Folder,
		})
	}
	return &provisioning.ResourceList{Items: items}, nil
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

	kindOf := o.kinds(ctx, namespace)
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
			Kind:     kindOf(v.Group, v.Resource),
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
		kind := kindOf(v.Group, v.Resource)
		stats.Instance = append(stats.Instance, provisioning.ResourceCount{
			Group:    v.Group,
			Resource: v.Resource,
			Kind:     kind,
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
				Kind:     kind,
				Count:    unmanagedCount,
			})
		}
	}
	return stats, nil
}
