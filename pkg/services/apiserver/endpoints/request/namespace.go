package request

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/authz"
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
		stackIdInt, err := strconv.Atoi(cfg.StackID)
		if err != nil {
			stackIdInt = 0
		}
		cloudNamespace := claims.CloudNamespaceFormatter(int64(stackIdInt))
		return func(_ int64) string { return cloudNamespace }
	}
	return claims.OrgNamespaceFormatter
}

// GetNamespaceAccessCheckerType returns a function that is used to enforce authn depending on our use-case
// e.g. OSS or cloud
func GetNamespaceAccessCheckerType(cfg *setting.Cfg) authz.NamespaceAccessCheckerType {
	if cfg != nil && cfg.StackID != "" {
		return authz.NamespaceAccessCheckerTypeCloud
	}
	return authz.NamespaceAccessCheckerTypeOrg
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
