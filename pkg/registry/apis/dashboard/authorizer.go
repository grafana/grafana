package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func (b *DashboardsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			user, err := appcontext.User(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}

			if attr.GetName() == "" {
				// Discourage use of the "list" command for non super admin users
				if attr.GetVerb() == "list" && attr.GetResource() == v0alpha1.DashboardResourceInfo.GroupResource().Resource {
					if !user.IsGrafanaAdmin {
						return authorizer.DecisionDeny, "list summary objects (or connect as GrafanaAdmin)", err
					}
				}
				return authorizer.DecisionNoOpinion, "", nil
			}

			ns := attr.GetNamespace()
			if ns == "" {
				return authorizer.DecisionDeny, "expected namespace", nil
			}

			info, err := request.ParseNamespace(attr.GetNamespace())
			if err != nil {
				return authorizer.DecisionDeny, "error reading org from namespace", err
			}

			// expensive path to lookup permissions for a single dashboard
			dto, err := b.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
				UID:   attr.GetName(),
				OrgID: info.OrgID,
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
				b.log.Info("unknown verb", "verb", attr.GetVerb())
				return authorizer.DecisionNoOpinion, "unsupported verb", nil // Unknown verb
			}
			return authorizer.DecisionAllow, "", nil
		})
}
