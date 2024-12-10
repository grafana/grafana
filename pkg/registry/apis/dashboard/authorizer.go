package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func GetAuthorizer(dashboardService dashboards.DashboardService, l log.Logger) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			// Use the standard authorizer
			if !attr.IsResourceRequest() || attr.GetResource() == "search" {
				return authorizer.DecisionNoOpinion, "", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}

			if attr.GetName() == "" {
				// Discourage use of the "list" command for non super admin users
				if attr.GetVerb() == "list" && attr.GetResource() == dashboard.DashboardResourceInfo.GroupResource().Resource {
					if !user.GetIsGrafanaAdmin() {
						return authorizer.DecisionDeny, "list summary objects (or connect as GrafanaAdmin)", err
					}
				}
				return authorizer.DecisionNoOpinion, "", nil
			}

			ns := attr.GetNamespace()
			if ns == "" {
				return authorizer.DecisionDeny, "expected namespace", nil
			}

			info, err := claims.ParseNamespace(attr.GetNamespace())
			if err != nil {
				return authorizer.DecisionDeny, "error reading org from namespace", err
			}

			// expensive path to lookup permissions for a single dashboard
			// must include deleted to allow for restores
			dto, err := dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
				UID:            attr.GetName(),
				OrgID:          info.OrgID,
				IncludeDeleted: true,
			})
			if err != nil {
				return authorizer.DecisionDeny, "error loading dashboard", err
			}

			ok := false
			guardian, err := guardian.NewByDashboard(ctx, dto, info.OrgID, user)
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}

			switch attr.GetVerb() {
			case "get":
				ok, err = guardian.CanView()
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not view dashboard", err
				}
			case "create":
				fallthrough
			case "post":
				ok, err = guardian.CanSave() // vs Edit?
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not save dashboard", err
				}
			case "update":
				fallthrough
			case "patch":
				fallthrough
			case "put":
				ok, err = guardian.CanEdit() // vs Save
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not edit dashboard", err
				}
			case "delete":
				ok, err = guardian.CanDelete()
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not delete dashboard", err
				}
			default:
				l.Info("unknown verb", "verb", attr.GetVerb())
				return authorizer.DecisionNoOpinion, "unsupported verb", nil // Unknown verb
			}
			return authorizer.DecisionAllow, "", nil
		})
}
