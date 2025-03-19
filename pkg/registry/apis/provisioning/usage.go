package provisioning

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (b *APIBuilder) collectProvisioningStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}
	if b.unified == nil {
		return m, nil
	}

	// FIXME: hardcoded to "default" for now -- it works for single tenant deployments
	// we could discover the set of valid namespaces, but that would count everything for
	// each instance in cloud.
	//
	// We could get namespaces from the list of repos below, but that could be zero
	// while we still have resources managed by terraform, etc
	ns := "default"
	count, err := b.unified.CountManagedObjects(ctx, &resource.CountManagedObjectsRequest{
		Namespace: ns,
	})
	if err != nil {
		return m, err
	}
	counts := make(map[string]int, 10)
	for _, v := range count.Items {
		counts[v.Kind] = counts[v.Kind] + int(v.Count)
	}
	for k, v := range counts {
		m[fmt.Sprintf("stats.managed_by.%s.count", k)] = v
	}

	// Inspect all configs
	repos, err := b.repositoryLister.List(labels.Everything())
	if err != nil {
		return m, err
	}
	clear(counts)
	for _, repo := range repos {
		counts[string(repo.Spec.Type)] = counts[string(repo.Spec.Type)] + 1
	}

	// Count how many items of each repository type
	for k, v := range counts {
		m[fmt.Sprintf("stats.repository.%s.count", k)] = v
	}

	return m, nil
}
