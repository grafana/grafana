package authz

import (
	"context"
	"hash/fnv"
	"maps"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/registry/apis/iam/datasourcek8s"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

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
	if c.routesToZanzana(namespace, group, resource, subresource) {
		return c.zanzana
	}
	return c.rbac
}

func (c *rolloutAccessClient) routesToZanzana(namespace, group, resource, subresource string) bool {
	group, resource, subresource = datasourcek8s.AuthorizationResource(group, resource, subresource)
	groupResource := common.FormatGroupResource(group, resource, subresource)
	pct, ok := c.rollout[groupResource]
	if !ok || pct <= 0 {
		return false
	}
	if pct >= 1 {
		return true
	}
	return rolloutBucket(namespace, groupResource) < pct
}

func (c *rolloutAccessClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	return c.clientFor(req.Namespace, req.Group, req.Resource, req.Subresource).Check(ctx, id, req, folder)
}

//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
func (c *rolloutAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return c.clientFor(req.Namespace, req.Group, req.Resource, req.Subresource).Compile(ctx, id, req) //nolint:staticcheck
}

// BatchCheck partitions mixed batches by rollout destination so each check follows the
// same route it would take individually.
func (c *rolloutAccessClient) BatchCheck(ctx context.Context, id claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	if err := req.Validate(); err != nil {
		return claims.BatchCheckResponse{}, err
	}
	if len(req.Checks) == 0 {
		return c.rbac.BatchCheck(ctx, id, req)
	}

	rbacRequest := claims.BatchCheckRequest{Namespace: req.Namespace, SkipCache: req.SkipCache}
	zanzanaRequest := claims.BatchCheckRequest{Namespace: req.Namespace, SkipCache: req.SkipCache}
	for _, check := range req.Checks {
		if c.routesToZanzana(req.Namespace, check.Group, check.Resource, check.Subresource) {
			zanzanaRequest.Checks = append(zanzanaRequest.Checks, check)
		} else {
			rbacRequest.Checks = append(rbacRequest.Checks, check)
		}
	}

	results := make(map[string]claims.BatchCheckResult, len(req.Checks))
	if len(rbacRequest.Checks) > 0 {
		response, err := c.rbac.BatchCheck(ctx, id, rbacRequest)
		if err != nil {
			return claims.BatchCheckResponse{}, err
		}
		maps.Copy(results, response.Results)
	}
	if len(zanzanaRequest.Checks) > 0 {
		response, err := c.zanzana.BatchCheck(ctx, id, zanzanaRequest)
		if err != nil {
			return claims.BatchCheckResponse{}, err
		}
		maps.Copy(results, response.Results)
	}
	return claims.BatchCheckResponse{Results: results}, nil
}

var _ claims.AccessClient = (*rolloutAccessClient)(nil)
