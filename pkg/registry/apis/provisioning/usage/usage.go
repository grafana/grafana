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
		// Keys are fixed (bounded enums or booleans) so the phoned-home stat set
		// stays stable and low cardinality -- per-repository detail lives in the
		// reconcile snapshot log lines, not here.
		managedCounts := make(map[string]int)
		repoCounts := make(map[string]int)
		syncTargetCounts := make(map[string]int)
		syncStateCounts := make(map[string]int)
		agg := repoAggregate{}
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
				agg.observe(repo, syncTargetCounts, syncStateCounts)
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
		// Count repositories by sync target and by last sync state.
		for k, v := range syncTargetCounts {
			m[fmt.Sprintf("stats.repository.sync_target.%s.count", k)] = v
		}
		for k, v := range syncStateCounts {
			m[fmt.Sprintf("stats.repository.sync_state.%s.count", k)] = v
		}
		// Fleet-wide repository dimensions. These complement the per-type counts
		// above and mirror the dimensions carried by the reconcile snapshot logs.
		m["stats.repository.count"] = agg.total
		m["stats.repository.healthy.count"] = agg.healthy
		m["stats.repository.unhealthy.count"] = agg.total - agg.healthy
		m["stats.repository.sync_enabled.count"] = agg.syncEnabled
		m["stats.repository.read_only.count"] = agg.readOnly
		m["stats.repository.webhook_disabled.count"] = agg.webhookDisabled
		m["stats.repository.workflow.write.count"] = agg.writeWorkflow
		m["stats.repository.workflow.branch.count"] = agg.branchWorkflow

		return m, nil
	}
}

// repoAggregate accumulates fleet-wide repository dimensions while iterating the
// repositories of every namespace. All fields are simple counters so the emitted
// stat keys stay fixed and low cardinality.
type repoAggregate struct {
	total           int
	healthy         int
	syncEnabled     int
	readOnly        int
	webhookDisabled int
	writeWorkflow   int
	branchWorkflow  int
}

// observe folds a single repository into the aggregate. syncTargetCounts and
// syncStateCounts are keyed by the repository's configured sync target and last
// observed sync state respectively; empty values are skipped so unset fields do
// not create an empty-string bucket.
func (a *repoAggregate) observe(repo provisioning.Repository, syncTargetCounts, syncStateCounts map[string]int) {
	a.total++
	if repo.Status.Health.Healthy {
		a.healthy++
	}
	if repo.Spec.Sync.Enabled {
		a.syncEnabled++
	}
	// A repository with no write workflows cannot be edited (read-only).
	if len(repo.Spec.Workflows) == 0 {
		a.readOnly++
	}
	for _, w := range repo.Spec.Workflows {
		switch w {
		case provisioning.WriteWorkflow:
			a.writeWorkflow++
		case provisioning.BranchWorkflow:
			a.branchWorkflow++
		}
	}
	if repo.Spec.Webhook != nil && repo.Spec.Webhook.Disabled {
		a.webhookDisabled++
	}
	if t := repo.Spec.Sync.Target; t != "" {
		syncTargetCounts[string(t)]++
	}
	if s := repo.Status.Sync.State; s != "" {
		syncStateCounts[string(s)]++
	}
}
