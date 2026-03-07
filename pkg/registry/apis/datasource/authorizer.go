package datasource

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func (b *DataSourceAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "resource", attr.GetResource())
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "subresource", attr.GetSubresource())
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "verb", attr.GetVerb())
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "name", attr.GetName())

			if !attr.IsResourceRequest() {
				backend.Logger.Info("+++++++++++++++++++ auth for datasource, IsResourceRequest false")
				return authorizer.DecisionNoOpinion, "", nil
			}
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "user.groups", user.GetGroups())
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "user.permissions", user.GetPermissions())
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "user.globalpermissions", user.GetGlobalPermissions())

			uidScope := datasources.ScopeProvider.GetResourceScopeUID(attr.GetName())
			backend.Logger.Info("+++++++++++++++++++ auth for datasource", "uidScope", uidScope)

			// Must have query permission to access any subresource
			if attr.GetSubresource() != "" {
				scopes := []string{}
				if attr.GetName() != "" {
					scopes = []string{uidScope}
				}
				ok, err := b.accessControl.Evaluate(ctx, user, ac.EvalPermission(datasources.ActionQuery, scopes...))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "unable to query", err
				}

				if attr.GetSubresource() == "proxy" {
					return authorizer.DecisionDeny, "TODO: map the plugin settings to access rules", err
				}

				return authorizer.DecisionAllow, "", nil
			}

			// Check for the right actions for datasource CRUD
			action := "" // invalid

			switch attr.GetVerb() {
			case "list":
				ok, err := b.accessControl.Evaluate(ctx, user,
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
				return authorizer.DecisionDeny, "unsupported verb", nil
			}
			ok, err := b.accessControl.Evaluate(ctx, user,
				ac.EvalPermission(action, uidScope))
			if !ok || err != nil {
				return authorizer.DecisionDeny, fmt.Sprintf("unable to %s", action), nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}
