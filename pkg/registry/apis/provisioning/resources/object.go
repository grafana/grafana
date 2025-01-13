package resources

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Get repository stats
type ResourceLister interface {
	List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error)
	Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error)
}

type ResourceListerFromSearch struct {
	index resource.RepositoryIndexClient
}

func NewResourceLister(index resource.RepositoryIndexClient) ResourceLister {
	return &ResourceListerFromSearch{
		index: index,
	}
}

// List implements ResourceLister.
func (o *ResourceListerFromSearch) List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	objects, err := o.index.ListRepositoryObjects(ctx, &resource.ListRepositoryObjectsRequest{
		Namespace: namespace,
		Name:      repository,
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
	counts, err := o.index.CountRepositoryObjects(ctx, &resource.CountRepositoryObjectsRequest{
		Namespace: namespace,
		Name:      repository,
	})
	if err != nil {
		return nil, err
	}
	if counts.Error != nil {
		return nil, resource.GetError(counts.Error)
	}

	stats := &provisioning.ResourceStats{}
	for _, v := range counts.Items {
		stats.Items = append(stats.Items, provisioning.ResourceCount{
			Repository: v.Repository,
			Group:      v.Group,
			Resource:   v.Resource,
			Count:      v.Count,
		})
	}
	return stats, nil
}
