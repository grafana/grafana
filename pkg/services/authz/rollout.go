package authz

import (
	"context"
	"hash/fnv"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

var rolloutLog = log.New("authz.rollout")

// rolloutBucket returns a deterministic value in [0.0, 1.0) for a given namespace and resource.
// The resource is included in the hash so that each resource produces an independent namespace
// distribution — the 20% of namespaces routed for dashboards is a different cohort from
// the 20% routed for folders.
func rolloutBucket(namespace, group, resource string) float64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(namespace + "|" + group + "/" + resource))
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

func (c *rolloutAccessClient) clientFor(namespace, group, resource string) claims.AccessClient {
	pct, ok := c.rollout[common.FormatGroupResource(group, resource, "")]
	if !ok || pct <= 0 {
		return c.rbac
	}
	if pct >= 1 {
		return c.zanzana
	}
	if rolloutBucket(namespace, group, resource) < pct {
		return c.zanzana
	}
	return c.rbac
}

func (c *rolloutAccessClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	return c.clientFor(req.Namespace, req.Group, req.Resource).Check(ctx, id, req, folder)
}

//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
func (c *rolloutAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return c.clientFor(req.Namespace, req.Group, req.Resource).Compile(ctx, id, req) //nolint:staticcheck
}

// BatchCheck routes the entire batch to a single client based on the group and resource of the
// first item. All items in a batch are expected to share the same group and resource — this
// matches how batches are constructed in practice (one List call, one resource type, one
// namespace). If items with different group/resource combinations are detected, the batch falls
// back to the RBAC client rather than misrouting, and a warning is logged.
func (c *rolloutAccessClient) BatchCheck(ctx context.Context, id claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	if len(req.Checks) == 0 {
		return c.rbac.BatchCheck(ctx, id, req)
	}
	group, resource := req.Checks[0].Group, req.Checks[0].Resource
	for _, check := range req.Checks[1:] {
		if check.Group != group || check.Resource != resource {
			rolloutLog.Warn("batch contains mixed group/resource combinations, falling back to RBAC",
				"namespace", req.Namespace,
				"first_group", group, "first_resource", resource,
				"conflict_group", check.Group, "conflict_resource", check.Resource,
			)
			return c.rbac.BatchCheck(ctx, id, req)
		}
	}
	return c.clientFor(req.Namespace, group, resource).BatchCheck(ctx, id, req)
}

var _ claims.AccessClient = &rolloutAccessClient{}
