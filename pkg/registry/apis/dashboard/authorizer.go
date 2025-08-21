package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements"
)

func GetAuthorizer(ac accesscontrol.AccessControl, l log.Logger) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			// Note that we will return Allow more than expected.
			// This is because we do NOT want to hit the RoleAuthorizer that would be evaluated afterwards.

			if !attr.IsResourceRequest() {
				return authorizer.DecisionDeny, "unexpected non-resource request", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "error getting requester", err
			}

			ns := attr.GetNamespace()
			if ns == "" {
				return authorizer.DecisionDeny, "expected namespace", nil
			}

			info, err := types.ParseNamespace(attr.GetNamespace())
			if err != nil {
				return authorizer.DecisionDeny, "error reading org from namespace", err
			}

			// Validate organization access before we possibly step out here.
			if user.GetOrgID() != info.OrgID {
				return authorizer.DecisionDeny, "org mismatch", dashboards.ErrUserIsNotSignedInToOrg
			}

			// Determine if this is a library panel or dashboard resource
			resource := attr.GetResource()
			isLibraryPanel := resource == dashv0.LIBRARY_PANEL_RESOURCE

			if isLibraryPanel {
				return authorizeLibraryPanel(ctx, ac, user, attr)
			} else {
				return authorizeDashboard(ctx, ac, user, attr)
			}
		})
}

func authorizeLibraryPanel(ctx context.Context, ac accesscontrol.AccessControl, user identity.Requester, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	switch attr.GetVerb() {
	case "list", "search":
		// Detailed read permissions are handled by authz, this just checks whether the user can ready *any* library panel
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(libraryelements.ActionLibraryPanelsRead))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not read any library panels", err
		}
	case "create":
		// Detailed create permissions are handled by authz, this just checks whether the user can create *any* library panel
		// TODO: Check if this is working as expected
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(libraryelements.ActionLibraryPanelsCreate))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not create any library panels", err
		}
	case "get":
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(libraryelements.ActionLibraryPanelsRead, libraryelements.ScopeLibraryPanelsProvider.GetResourceScopeUID(attr.GetName())))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not view library panel", err
		}
	case "update", "patch":
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(libraryelements.ActionLibraryPanelsWrite, libraryelements.ScopeLibraryPanelsProvider.GetResourceScopeUID(attr.GetName())))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not edit library panel", err
		}
	case "delete":
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(libraryelements.ActionLibraryPanelsDelete, libraryelements.ScopeLibraryPanelsProvider.GetResourceScopeUID(attr.GetName())))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not delete library panel", err
		}
	default:
		return authorizer.DecisionDeny, "unsupported verb for library panels", nil
	}
	return authorizer.DecisionAllow, "", nil
}

func authorizeDashboard(ctx context.Context, ac accesscontrol.AccessControl, user identity.Requester, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	switch attr.GetVerb() {
	case "list", "search":
		// Detailed read permissions are handled by authz, this just checks whether the user can ready *any* dashboard
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not read any dashboards", err
		}
	case "create":
		// Detailed create permissions are handled by authz, this just checks whether the user can create *any* dashboard
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not create any dashboards", err
		}
	case "get":
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName())))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not view dashboard", err
		}
	case "update", "patch":
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName())))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not edit dashboard", err
		}
	case "delete":
		ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName())))
		if !ok || err != nil {
			return authorizer.DecisionDeny, "can not delete dashboard", err
		}
	default:
		return authorizer.DecisionDeny, "unsupported verb for dashboards", nil
	}
	return authorizer.DecisionAllow, "", nil
}
