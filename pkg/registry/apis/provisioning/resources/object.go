package resources

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Get repository stats
//
//go:generate mockery --name ResourceLister --structname MockResourceLister --inpackage --filename resource_lister_mock.go --with-expecter
type ResourceLister interface {
	List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error)
	Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error)
}

type ResourceListerFromSearch struct {
	managed        resource.ManagedObjectIndexClient
	index          resource.ResourceIndexClient
	legacyMigrator legacy.LegacyMigrator
	storageStatus  dualwrite.Service
}

func NewResourceLister(
	managed resource.ManagedObjectIndexClient,
	index resource.ResourceIndexClient,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
) ResourceLister {
	return &ResourceListerFromSearch{
		index:          index,
		managed:        managed,
		legacyMigrator: legacyMigrator,
		storageStatus:  storageStatus,
	}
}

// List implements ResourceLister.
func (o *ResourceListerFromSearch) List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	objects, err := o.managed.ListManagedObjects(ctx, &resource.ListManagedObjectsRequest{
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
	req := &resource.CountManagedObjectsRequest{
		Namespace: namespace,
	}
	if repository != "" {
		req.Kind = string(utils.ManagerKindRepo)
		req.Id = repository
	}

	counts, err := o.managed.CountManagedObjects(ctx, req)
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

	// Get the stats based on what a migration could support
	if dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, o.storageStatus) {
		rsp, err := o.legacyMigrator.Migrate(ctx, legacy.MigrateOptions{
			Namespace: namespace,
			Resources: []schema.GroupResource{{
				Group: dashboard.GROUP, Resource: dashboard.DASHBOARD_RESOURCE,
			}, {
				Group: folders.GROUP, Resource: folders.RESOURCE,
			}},
			WithHistory: false,
			OnlyCount:   true,
		})
		if err != nil {
			return nil, err
		}
		for _, v := range rsp.Summary {
			stats.Instance = append(stats.Instance, provisioning.ResourceCount{
				Group:    v.Group,
				Resource: v.Resource,
				Count:    v.Count,
			})
		}
		return stats, nil
	}

	// Get full instance stats
	info, err := o.index.GetStats(ctx, &resource.ResourceStatsRequest{
		Namespace: namespace,
	})
	if err != nil {
		return nil, err
	}
	for _, v := range info.Stats {
		stats.Instance = append(stats.Instance, provisioning.ResourceCount{
			Group:    v.Group,
			Resource: v.Resource,
			Count:    v.Count,
		})
	}
	return stats, nil
}
