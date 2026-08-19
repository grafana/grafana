package usage

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// NamespaceLister returns the set of namespaces to collect provisioning usage
// stats for. In a single-tenant deployment this is one namespace per org.
type NamespaceLister func(ctx context.Context) ([]string, error)

func MetricCollector(tracer tracing.Tracer, namespaces NamespaceLister, repositoryLister func(ctx context.Context) ([]provisioning.Repository, error), unified resource.ResourceClient) usagestats.MetricsFunc {
	return func(ctx context.Context) (m map[string]any, err error) {
		ctx, span := tracer.Start(ctx, "Provisioning.Usage.collectProvisioningStats")
		defer func() {
			if err != nil {
				span.SetStatus(codes.Error, fmt.Sprintf("failed to fetch provisioning usage stats: %v", err))
			} else {
				span.SetStatus(codes.Ok, "")
			}
			span.End()
		}()

		m = map[string]any{}
		if unified == nil {
			// No unified storage means there is nothing to count.
			span.SetStatus(codes.Ok, "unified storage is not available")
			return m, nil
		}

		// Resolve the namespaces to collect for (one per org). When no lister is
		// wired -- the multi-tenant standalone path -- fall back to the default
		// namespace, which preserves single-tenant behaviour.
		nss := []string{"default"}
		if namespaces != nil {
			nss, err = namespaces(ctx)
			if err != nil {
				return m, fmt.Errorf("list namespaces: %w", err)
			}
		}

		// Counts are aggregated across all namespaces into the same stat keys.
		managedCounts := make(map[string]int)
		repoCounts := make(map[string]int)
		for _, ns := range nss {
			nsSpanCtx, nsSpan := tracer.Start(ctx, "Provisioning.Usage.collectProvisioningStats.countManagedObjects")

			var nsCtx context.Context
			nsCtx, _, err = identity.WithProvisioningIdentity(nsSpanCtx, ns)
			if err != nil {
				nsSpan.RecordError(err)
				nsSpan.SetStatus(codes.Error, fmt.Sprintf("failed to create provisioning identity: %v", err))
				return m, fmt.Errorf("create provisioning identity: %w", err)
			}

			nsCtx = request.WithNamespace(nsCtx, ns)
			var count *resourcepb.CountManagedObjectsResponse
			count, err = unified.CountManagedObjects(nsCtx, &resourcepb.CountManagedObjectsRequest{
				Namespace: ns,
			})
			if err != nil {
				nsSpan.RecordError(err)
				nsSpan.SetStatus(codes.Error, fmt.Sprintf("failed to count managed objects on namespace %s: %v", ns, err))
				return m, fmt.Errorf("count managed objects on namespace %s: %w", ns, err)
			}
			for _, v := range count.Items {
				managedCounts[v.Kind] += int(v.Count)
			}
			nsSpan.SetAttributes(attribute.Int("totalManagedObjectsCount", len(count.Items)))

			var repos []provisioning.Repository
			repos, err = repositoryLister(nsCtx)
			if err != nil {
				nsSpan.RecordError(err)
				nsSpan.SetStatus(codes.Error, fmt.Sprintf("failed to list repositories on namespace %s: %v", ns, err))
				return m, fmt.Errorf("list repositories on namespace %s: %w", ns, err)
			}

			for _, repo := range repos {
				repoCounts[string(repo.Spec.Type)]++
			}

			nsSpan.SetAttributes(attribute.Int("totalRepositoriesCount", len(repos)))
			nsSpan.SetStatus(codes.Ok, "")
			nsSpan.End()
		}

		span.SetAttributes(attribute.Int("namespaceCount", len(nss)))
		for k, v := range managedCounts {
			m[fmt.Sprintf("stats.managed_by.%s.count", k)] = v
		}
		// Count how many items of each repository type.
		for k, v := range repoCounts {
			m[fmt.Sprintf("stats.repository.%s.count", k)] = v
		}

		return m, nil
	}
}
