package prometheus

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	prometheusv0alpha1 "github.com/grafana/grafana/apps/prometheus/pkg/apis/prometheus/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func (p *PrometheusAppProvider) authorizer(accessControl ac.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			// require a user
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			uidScope := datasources.ScopeProvider.GetResourceScopeUID(attr.GetName())

			// Must have query access to see a connection
			gvr := schema.GroupVersionResource{
				Group:    prometheusv0alpha1.PrometheusKind().Group(),
				Version:  prometheusv0alpha1.PrometheusKind().Version(),
				Resource: prometheusv0alpha1.PrometheusKind().Plural(),
			}

			if attr.GetResource() == gvr.Resource {
				scopes := []string{}
				if attr.GetName() != "" {
					scopes = []string{uidScope}
				}
				ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(datasources.ActionQuery, scopes...))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "unable to query", err
				}

				if attr.GetSubresource() == "proxy" {
					return authorizer.DecisionDeny, "TODO: map the plugin settings to access rules", err
				}

				return authorizer.DecisionAllow, "", nil
			}

			// Must have query access to see a connection
			action := "" // invalid

			switch attr.GetVerb() {
			case "list":
				ok, err := accessControl.Evaluate(ctx, user,
					ac.EvalPermission(datasources.ActionRead)) // Can see any datasource values
				if !ok || err != nil {
					return authorizer.DecisionDeny, "unable to read", err
				}
				return authorizer.DecisionAllow, "", nil

			case "get":
				action = datasources.ActionRead
			case "create":
				action = datasources.ActionWrite
			case "post":
				fallthrough
			case "update":
				fallthrough
			case "patch":
				fallthrough
			case "put":
				action = datasources.ActionWrite
			case "delete":
				action = datasources.ActionDelete
			default:
				//b.log.Info("unknown verb", "verb", attr.GetVerb())
				return authorizer.DecisionDeny, "unsupported verb", nil // Unknown verb
			}
			ok, err := accessControl.Evaluate(ctx, user,
				ac.EvalPermission(action, uidScope))
			if !ok || err != nil {
				return authorizer.DecisionDeny, fmt.Sprintf("unable to %s", action), nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}
