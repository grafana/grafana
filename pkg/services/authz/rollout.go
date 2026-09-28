package authz

import (
	"context"
	"hash/fnv"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

var rolloutLog = log.New("authz.rollout")

// rolloutBucket returns a deterministic value in [0.0, 1.0) for a given namespace and
// groupResource key. The key is included in the hash so that each resource produces an
// independent namespace distribution — the 20% of namespaces routed for dashboards is a
// different cohort from the 20% routed for folders.
func rolloutBucket(namespace, groupResource string) float64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(namespace + "|" + groupResource))
	return float64(h.Sum32()) / (1 << 32)
}

// rolloutAccessClient routes each authorization call to either the RBAC or Zanzana-primary
// shadow client based on a deterministic per-namespace, per-resource hash.
// Namespaces not covered by the rollout map always use the RBAC client.
type rolloutAccessClient struct {
	rbac    claims.AccessClient
	zanzana claims.AccessClient
	rollout map[string]float64 // "group/resource" → fraction 0.0–1.0
}

func newRolloutAccessClient(rbac, zanzana claims.AccessClient, rollout map[string]float64) claims.AccessClient {
	if rbac == nil {
		panic("newRolloutAccessClient: rbac client is nil")
	}
	if zanzana == nil {
		panic("newRolloutAccessClient: zanzana client is nil")
	}
	return &rolloutAccessClient{rbac: rbac, zanzana: zanzana, rollout: rollout}
}

// clientFor keys the rollout on group/resource/subresource. A subresource is a distinct
// key, so enabling "dashboard.grafana.app/dashboards" does not implicitly route questions
// about, say, the annotations subresource to Zanzana: those stay on RBAC until an operator
// adds "dashboard.grafana.app/dashboards/annotations" to the rollout map. This matters
// because Zanzana only holds tuples for the actions its reconciler translates, so routing
// a subresource it does not know about would silently deny access the user really has.
func (c *rolloutAccessClient) clientFor(namespace, group, resource, subresource string) claims.AccessClient {
	groupResource := common.FormatGroupResource(group, resource, subresource)
	pct, ok := c.rollout[groupResource]
	if !ok || pct <= 0 {
		return c.rbac
	}
	if pct >= 1 {
		return c.zanzana
	}
	if rolloutBucket(namespace, groupResource) < pct {
		return c.zanzana
	}
	return c.rbac
}

func (c *rolloutAccessClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	return c.clientFor(req.Namespace, req.Group, req.Resource, req.Subresource).Check(ctx, id, req, folder)
}

//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
func (c *rolloutAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return c.clientFor(req.Namespace, req.Group, req.Resource, req.Subresource).Compile(ctx, id, req) //nolint:staticcheck
}

// BatchCheck routes the entire batch to a single client based on the group, resource and
// subresource of the first item. All items in a batch are expected to share those three —
// this matches how batches are constructed in practice (one List call, one resource type,
// one namespace). If items with different combinations are detected, the batch falls back
// to the RBAC client rather than misrouting, and a warning is logged.
func (c *rolloutAccessClient) BatchCheck(ctx context.Context, id claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	if len(req.Checks) == 0 {
		return c.rbac.BatchCheck(ctx, id, req)
	}

	check := req.Checks[0]
	group, resource, subresource := check.Group, check.Resource, check.Subresource
	for _, check := range req.Checks[1:] {
		if check.Group != group || check.Resource != resource || check.Subresource != subresource {
			rolloutLog.Warn("batch contains mixed group/resource combinations, falling back to RBAC",
				"namespace", req.Namespace,
				"first_group", group, "first_resource", resource, "first_subresource", subresource,
				"conflict_group", check.Group, "conflict_resource", check.Resource, "conflict_subresource", check.Subresource,
			)
			return c.rbac.BatchCheck(ctx, id, req)
		}
	}
	return c.clientFor(req.Namespace, group, resource, subresource).BatchCheck(ctx, id, req)
}

var _ claims.AccessClient = &rolloutAccessClient{}
