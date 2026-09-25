package usage

import (
	"context"
	"strconv"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// UsageNamespaceLister returns the NamespaceLister the usage-stats collector uses to
// decide which namespaces to count. On-prem (no StackID) it enumerates one namespace
// per org so counts are aggregated across every org; on a cloud stack it just lists the single namespace
// accessible to the stack.
func UsageNamespaceLister(cfg *setting.Cfg, orgSvc org.Service) NamespaceLister {
	if cfg.StackID == "" {
		return orgNamespaceLister(request.GetNamespaceMapper(cfg), orgSvc)
	}
	return stackNamespaceLister(cfg.StackID)
}

// orgNamespaceLister lists one namespace per org in the instance, deduplicated.
// Deduplication matters because a namespace mapper can map several orgs to the same
// namespace (e.g. the cloud mapper), which would otherwise be counted once per org.
func orgNamespaceLister(namespacer request.NamespaceMapper, orgSvc org.Service) NamespaceLister {
	return func(ctx context.Context) ([]string, error) {
		orgs, err := orgSvc.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return nil, err
		}

		// Deduplicate the namespaces.
		seen := make(map[string]struct{}, len(orgs))
		out := make([]string, 0, len(orgs))
		for _, o := range orgs {
			ns := namespacer(o.ID)
			if _, ok := seen[ns]; ok {
				continue
			}
			seen[ns] = struct{}{}
			out = append(out, ns)
		}

		return out, nil
	}
}

// stackNamespaceLister always reports just the given namespace, which is the
// only namespace accessible to the given stack.
func stackNamespaceLister(stackID string) NamespaceLister {
	return func(ctx context.Context) ([]string, error) {
		stackId, err := strconv.ParseInt(stackID, 10, 64)
		if err != nil {
			stackId = 0
		}

		cloudNamespace := claims.CloudNamespaceFormatter(stackId)
		return []string{cloudNamespace}, nil
	}
}
