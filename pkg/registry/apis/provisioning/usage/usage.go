package usage

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apiserver/pkg/endpoints/request"

	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func MetricCollector(tracer tracing.Tracer, repositoryLister listers.RepositoryLister, unified resource.ResourceClient) usagestats.MetricsFunc {
	return func(ctx context.Context) (metrics map[string]any, err error) {
		ctx, span := tracer.Start(ctx, "Provisioning.Usage.collectProvisioningStats")
		defer func() {
			span.SetStatus(codes.Error, fmt.Sprintf("failed to fetch provisioning usage stats: %v", err))
			span.End()
		}()

		m := map[string]any{}
		if unified == nil {
			// FIXME: does this case make any sense? no unified storage -> no game
			span.SetStatus(codes.Ok, "unified storage is not available")
			return m, nil
		}

		// FIXME: hardcoded to "default" for now -- it works for single tenant deployments
		// we could discover the set of valid namespaces, but that would count everything for
		// each instance in cloud.
		ns := "default"
		ctx, _, err = identity.WithProvisioningIdentity(ctx, ns)
		if err != nil {
			return nil, err
		}
		ctx = request.WithNamespace(ctx, ns)

		// FIXME: hardcoded to "default" for now -- it works for single tenant deployments
		// we could discover the set of valid namespaces, but that would count everything for
		// each instance in cloud.
		//
		// We could get namespaces from the list of repos below, but that could be zero
		// while we still have resources managed by terraform, etc
		count, err := unified.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{
			Namespace: ns,
		})
		if err != nil {
			return m, fmt.Errorf("count managed objects: %w", err)
		}
		counts := make(map[string]int, 10)
		for _, v := range count.Items {
			counts[v.Kind] = counts[v.Kind] + int(v.Count)
		}

		span.SetAttributes(attribute.Int("totalManagedObjectsCount", len(count.Items)))
		for k, v := range counts {
			m[fmt.Sprintf("stats.managed_by.%s.count", k)] = v
		}

		// Inspect all configs
		repos, err := repositoryLister.List(labels.Everything())
		if err != nil {
			return m, fmt.Errorf("list repositories: %w", err)
		}
		clear(counts)
		for _, repo := range repos {
			counts[string(repo.Spec.Type)] = counts[string(repo.Spec.Type)] + 1
		}

		span.SetAttributes(attribute.Int("repositoryCount", len(repos)))
		// Count how many items of each repository type
		for k, v := range counts {
			m[fmt.Sprintf("stats.repository.%s.count", k)] = v
		}

		return m, nil
	}
}
