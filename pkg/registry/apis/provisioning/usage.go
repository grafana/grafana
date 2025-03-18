package provisioning

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (b *APIBuilder) collectProvisioningStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	if b.unified == nil {
		return m, nil
	}
	ns := "default"

	count, err := b.unified.CountManagedObjects(ctx, &resource.CountManagedObjectsRequest{
		Namespace: ns,
	})
	if err != nil {
		return m, err
	}

	total := int64(0)
	for _, v := range count.Items {
		total += v.Count
	}
	m["stats.provisioning.resources.count"] = total

	// Find all repos (with type)
	res, err := b.unified.Search(ctx, &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key: &resource.ResourceKey{
				Namespace: ns,
				Group:     provisioning.GROUP,
				Resource:  provisioning.RepositoryResourceInfo.GroupResource().Resource,
			},
		},
		Limit: 0,
		Facet: map[string]*resource.ResourceSearchRequest_Facet{
			"type": {
				Field: "xxxx", // TODO... index the type unknown field (for now)
			},
		},
	})
	if err != nil {
		return m, err
	}

	// Count how many items of each type
	m["stats.provisioning.repo.count"] = res.TotalHits
	for _, val := range res.Facet {
		for _, v := range val.Terms {
			m["stats.provisioning.repo."+v.Term+".count"] = v.Count
		}
	}

	return m, nil
}
