package resources

import (
	"context"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

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
	Search(ctx context.Context, namespace, repository string, resourceTypes []schema.GroupResource) (*provisioning.ResourceList, error)
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

	items := make([]provisioning.ResourceListItem, 0, len(objects.Items))
	for _, v := range objects.Items {
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

// Search lists repository-managed resources of the requested types in a namespace,
// collecting all pages and deduplicating by resource identity. It returns only
// identities, source paths, and folders for link resolution and authorization.
//
// Callers must check read access before exposing results, since search does not
// enforce permissions for every resource kind.
func (o *ResourceListerFromSearch) Search(ctx context.Context, namespace, repository string, resourceTypes []schema.GroupResource) (*provisioning.ResourceList, error) {
	list := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}
	seenTypes := make(map[schema.GroupResource]bool, len(resourceTypes))
	seenResources := make(map[string]bool)
	for _, resourceType := range resourceTypes {
		if seenTypes[resourceType] {
			continue
		}
		seenTypes[resourceType] = true
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: namespace,
					Group:     resourceType.Group,
					Resource:  resourceType.Resource,
				},
				Fields: []*resourcepb.Requirement{
					{Key: resource.SEARCH_FIELD_MANAGER_KIND, Operator: string(selection.Equals), Values: []string{string(utils.ManagerKindRepo)}},
					{Key: resource.SEARCH_FIELD_MANAGER_ID, Operator: string(selection.Equals), Values: []string{repository}},
				},
			},
			// Folder is needed for authorization; source path resolves repository links.
			Fields: []string{
				resource.SEARCH_FIELD_FOLDER,
				resource.SEARCH_FIELD_SOURCE_PATH,
			},
			Limit:        100,
			SortBy:       []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_NAME}},
			ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		}
		var rowsRead int64
		for {
			response, err := o.store.Search(ctx, req)
			if err != nil {
				return nil, fmt.Errorf("search managed %s: %w", resourceType, err)
			}
			if response == nil {
				return nil, fmt.Errorf("search managed %s: missing response", resourceType)
			}
			if response.Error != nil {
				return nil, fmt.Errorf("search managed %s: %w", resourceType, resource.GetError(response.Error))
			}
			if response.ResultFormat != resourcepb.ResourceSearchRequest_UNSPECIFIED && response.ResultFormat != resourcepb.ResourceSearchRequest_RESOURCE_TABLE {
				return nil, fmt.Errorf("search managed %s: unsupported result format %s", resourceType, response.ResultFormat)
			}
			if response.Results == nil {
				return nil, fmt.Errorf("search managed %s: missing result table", resourceType)
			}
			// Authorization can shorten a page and leave the total hit count approximate.
			if len(response.Results.Rows) == 0 {
				break
			}
			items, err := decodeResourceListTable(response.Results, req.Options.Key, req.Fields)
			if err != nil {
				return nil, fmt.Errorf("search managed %s: %w", resourceType, err)
			}
			for _, item := range items {
				identity := item.Group + "/" + item.Resource + "/" + item.Name
				if !seenResources[identity] {
					seenResources[identity] = true
					list.Items = append(list.Items, item)
				}
			}
			rowsRead += int64(len(response.Results.Rows))
			// Cursors avoid reauthorizing preceding hits on every page.
			if cursor := response.Results.Rows[len(response.Results.Rows)-1].SortFields; len(cursor) > 0 {
				req.SearchAfter = slices.Clone(cursor)
				req.Offset = 0
			} else {
				req.SearchAfter = nil
				req.Offset = rowsRead
			}
		}
	}
	return list, nil
}

func decodeResourceListTable(table *resourcepb.ResourceTable, scope *resourcepb.ResourceKey, fields []string) ([]provisioning.ResourceListItem, error) {
	columns := make(map[string]int, len(table.Columns))
	for i, column := range table.Columns {
		if column == nil {
			return nil, fmt.Errorf("missing column definition at index %d", i)
		}
		if _, exists := columns[column.Name]; exists {
			return nil, fmt.Errorf("duplicate column %q", column.Name)
		}
		columns[column.Name] = i
	}
	for _, field := range fields {
		if _, exists := columns[field]; !exists {
			return nil, fmt.Errorf("missing column %q", field)
		}
	}

	items := make([]provisioning.ResourceListItem, 0, len(table.Rows))
	for _, row := range table.Rows {
		if row == nil || row.Key == nil || row.Key.Name == "" {
			return nil, fmt.Errorf("missing resource key")
		}
		if row.Key.Namespace != scope.Namespace || row.Key.Group != scope.Group || row.Key.Resource != scope.Resource {
			return nil, fmt.Errorf("resource key does not match the requested namespace and resource type")
		}
		if len(row.Cells) != len(table.Columns) {
			return nil, fmt.Errorf("row has %d cells but the table declares %d columns", len(row.Cells), len(table.Columns))
		}
		item := provisioning.ResourceListItem{Group: row.Key.Group, Resource: row.Key.Resource, Name: row.Key.Name}
		for _, field := range fields {
			i := columns[field]
			value, err := resource.DecodeCell(table.Columns[i], i, row.Cells[i])
			if err != nil {
				return nil, fmt.Errorf("decoding column %q: %w", field, err)
			}
			if value == nil {
				continue
			}
			text, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("expected string in column %q", field)
			}
			switch field {
			case resource.SEARCH_FIELD_FOLDER:
				item.Folder = text
			case resource.SEARCH_FIELD_SOURCE_PATH:
				item.Path = text
			}
		}
		items = append(items, item)
	}
	return items, nil
}
