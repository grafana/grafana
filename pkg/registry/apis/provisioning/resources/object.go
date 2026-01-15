package resources

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
	store ResourceStore
}

func NewResourceLister(store ResourceStore) ResourceLister {
	return &ResourceListerFromSearch{store: store}
}

func NewResourceListerForMigrations(store ResourceStore) ResourceLister {
	return &ResourceListerFromSearch{
		store: store,
	}
}

// List implements ResourceLister.
func (o *ResourceListerFromSearch) List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	objects, err := o.store.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
		Namespace: namespace,
		Kind:      string(utils.ManagerKindRepo),
		Id:        repository,
	})
	if err != nil {
		return nil, err
	}
	if objects.Error != nil {
		return nil, resource.GetError(objects.Error)
	}

	list := &provisioning.ResourceList{}
	for _, v := range objects.Items {
		list.Items = append(list.Items, provisioning.ResourceListItem{
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
	return list, nil
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
	if err != nil {
		return nil, err
	}
	if counts.Error != nil {
		return nil, resource.GetError(counts.Error)
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
