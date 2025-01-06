package request

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

// NamespaceMapper converts an orgID into a namespace
type NamespaceMapper = claims.NamespaceFormatter

// GetNamespaceMapper returns a function that will convert orgIds into a consistent namespace
func GetNamespaceMapper(cfg *setting.Cfg) NamespaceMapper {
	if cfg != nil && cfg.StackID != "" {
		stackId, err := strconv.ParseInt(cfg.StackID, 10, 64)
		if err != nil {
			stackId = 0
		}

		cloudNamespace := claims.CloudNamespaceFormatter(stackId)
		return func(_ int64) string { return cloudNamespace }
	}
	return claims.OrgNamespaceFormatter
}

func NamespaceInfoFrom(ctx context.Context, requireOrgID bool) (claims.NamespaceInfo, error) {
	info, err := claims.ParseNamespace(request.NamespaceValue(ctx))
	if err == nil && requireOrgID && info.OrgID < 1 {
		return info, fmt.Errorf("expected valid orgId in namespace")
	}
	return info, err
}

func OrgIDForList(ctx context.Context) (int64, error) {
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		user, err := identity.GetRequester(ctx)
		if user != nil {
			return user.GetOrgID(), err
		}
		return -1, err
	}
	info, err := claims.ParseNamespace(ns)
	return info.OrgID, err
}
