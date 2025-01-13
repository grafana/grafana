package resources

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Get repository stats
type ObjectLister interface {
	List(ctx context.Context, namespace, repository string) (*provisioning.ObjectList, error)
	Stats(ctx context.Context, namespace, repository string) (*provisioning.ObjectStats, error)
}

type objectListerFromSearch struct {
	index resource.RepositoryIndexClient
}

func NewObjectLister(index resource.RepositoryIndexClient) ObjectLister {
	return &objectListerFromSearch{
		index: index,
	}
}

// List implements ObjectLister.
func (o *objectListerFromSearch) List(ctx context.Context, namespace, repository string) (*provisioning.ObjectList, error) {
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

	list := &provisioning.ObjectList{}
	for _, v := range objects.Items {
		list.Items = append(list.Items, provisioning.ObjectListItem{
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

// Stats implements ObjectLister.
func (o *objectListerFromSearch) Stats(ctx context.Context, namespace, repository string) (*provisioning.ObjectStats, error) {
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

	stats := &provisioning.ObjectStats{}
	for _, v := range counts.Items {
		stats.Items = append(stats.Items, provisioning.ResourceObjectCount{
			Repository: v.Repository,
			Group:      v.Group,
			Resource:   v.Resource,
			Count:      v.Count,
		})
	}
	return stats, nil
}
