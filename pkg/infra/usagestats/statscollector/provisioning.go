package statscollector

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (s *Service) collectProvisioningStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	if s.unified == nil {
		return m, nil
	}

	count, err := s.unified.CountManagedObjects(ctx, &resource.CountManagedObjectsRequest{
		Namespace: "default", // or stack id???
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
	res, err := s.unified.Search(ctx, &resource.ResourceSearchRequest{
		Limit: 0,
		Facet: map[string]*resource.ResourceSearchRequest_Facet{
			"type": {
				Field: "xxxx", // unknown field (for now)
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
