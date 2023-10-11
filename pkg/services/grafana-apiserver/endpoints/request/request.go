package request

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apiserver/pkg/endpoints/request"
)

type NamespaceInfo struct {
	// OrgID defined in namespace (1 when using stack ids)
	OrgID int64

	// The cloud stack ID (must match the value in cfg.Settings)
	StackID string

	// For namespaces that are not org-{id} or stack-{id}
	Other string
}

func NamespaceInfoFrom(ctx context.Context, requireOrgID bool) (NamespaceInfo, error) {
	info, err := ParseNamespace(request.NamespaceValue(ctx))
	if err == nil && requireOrgID && info.OrgID < 1 {
		return info, fmt.Errorf("expected valid orgId")
	}
	return info, err
}

func ParseNamespace(ns string) (NamespaceInfo, error) {
	if ns == "default" {
		return NamespaceInfo{
			OrgID: 1,
		}, nil
	}

	if strings.HasPrefix(ns, "org-") {
		id, err := strconv.Atoi(ns[4:])
		if id < 1 {
			return NamespaceInfo{}, fmt.Errorf("invalid org id")
		}
		if id == 1 {
			return NamespaceInfo{}, fmt.Errorf("use default rather than org-1")
		}
		return NamespaceInfo{
			OrgID: int64(id),
		}, err
	}

	if strings.HasPrefix(ns, "stack-") {
		id := ns[6:]
		if len(id) < 3 {
			return NamespaceInfo{}, fmt.Errorf("invalid stack id")
		}
		return NamespaceInfo{
			OrgID:   1,
			StackID: id,
		}, nil
	}

	// For non grafana scoped namespaces
	return NamespaceInfo{
		OrgID: -1,
		Other: ns,
	}, nil
}
