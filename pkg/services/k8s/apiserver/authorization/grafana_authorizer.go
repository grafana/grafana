package authorization

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/services/org"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
)

type GrafanaAuthorizer struct {
}

func NewGrafanaAuthorizer() *GrafanaAuthorizer {
	return &GrafanaAuthorizer{}
}

func (auth GrafanaAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if userInfo, ok := request.UserFrom(ctx); ok {
		extra := userInfo.GetExtra()
		groups := userInfo.GetGroups()

		if orgId := extra["org-id"]; len(orgId) > 0 {
			// We are being called using a Grafana token
			if orgRole := extra["org-role"]; len(orgRole) > 0 {
				switch org.RoleType(orgRole[0]) {
				case org.RoleAdmin:
					return authorizer.DecisionAllow, "", nil
				case org.RoleEditor:
					switch a.GetVerb() {
					case "get", "list", "watch", "create", "update", "patch", "delete", "put", "post":
						return authorizer.DecisionAllow, "", nil
					}
				case org.RoleViewer:
					switch a.GetVerb() {
					case "get", "list", "watch":
						return authorizer.DecisionAllow, "", nil
					}
				default:
					return authorizer.DecisionDeny, fmt.Sprintf("Grafana user's org role (%s) didn't allow access on requested resource=%s, path=%s", orgRole[0], a.GetResource(), a.GetPath()), nil
				}
			}
		} else if groups != nil && len(groups) > 0 {
			for _, gr := range groups {
				if gr == "system:masters" {
					// We are being called using LoopbackConfig / internal privileged access
					return authorizer.DecisionAllow, "", nil
				}
			}
			return authorizer.DecisionDeny, fmt.Sprintf("K8s groups didn't allow access on requested resource=%s, path=%s", a.GetResource(), a.GetPath()), nil
		} else {
			fmt.Printf("Didn't match the K8s or Grafana code paths for groups=%v, extra=%v", groups, extra)
		}
	}
	return authorizer.DecisionDeny, fmt.Sprintf("Neither Grafana token rules nor K8s token rules were applicable, denied access on requested resource=%s, path=%s", a.GetResource(), a.GetPath()), nil
}
