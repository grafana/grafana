package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

func GetAuthorizer(dashboardService dashboards.DashboardService, ac accesscontrol.AccessControl, l log.Logger) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			// Use the standard authorizer
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}

			// Allow search and list requests
			if attr.GetResource() == "search" || attr.GetName() == "" {
				return authorizer.DecisionNoOpinion, "", nil
			}

			ns := attr.GetNamespace()
			if ns == "" {
				return authorizer.DecisionDeny, "expected namespace", nil
			}

			ok := false

			switch attr.GetVerb() {
			case "get":
				evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName()))
				ok, err = ac.Evaluate(ctx, user, evaluator)
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not view dashboard", err
				}
			case "create":
				fallthrough
			case "post":
				evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName()))
				ok, err = ac.Evaluate(ctx, user, evaluator)
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not save dashboard", err
				}
			case "update":
				fallthrough
			case "patch":
				fallthrough
			case "put":
				evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName()))
				ok, err = ac.Evaluate(ctx, user, evaluator)
				if !ok || err != nil {
					return authorizer.DecisionDeny, "can not edit dashboard", err
				}
			case "delete":
				evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(attr.GetName()))
				ok, err = ac.Evaluate(ctx, user, evaluator)
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
