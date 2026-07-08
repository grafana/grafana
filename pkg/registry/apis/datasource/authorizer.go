package datasource

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const queryServiceIdentity = "query.grafana.app"

func (b *DataSourceAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	group := b.GetGroupVersion().Group
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			req := authlib.CheckRequest{
				Group:     group,
				Resource:  "datasources",
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
				Verb:      attr.GetVerb(),
			}

			var svcIdentity []string
			if authInfo, ok := authlib.AuthInfoFrom(ctx); ok {
				svcIdentity = authInfo.GetExtra()[authn.ServiceIdentityKey]
			}

			backend.Logger.Debug(
				"datasource authorizer check",
				"group", req.Group,
				"resource", req.Resource,
				"subresource", req.Subresource,
				"verb", req.Verb,
				"namespace", req.Namespace,
				"name", req.Name,
				"svcIdentity", svcIdentity,
				"user_subject", user.GetSubject(),
				"user_identity_type", string(user.GetIdentityType()),
				"token_delegated_permissions", user.GetTokenDelegatedPermissions(),
				"token_permissions", user.GetTokenPermissions(),
			)

			if sub := attr.GetSubresource(); sub != "" {
				req.Verb = utils.VerbCreate
				req.Subresource = "query"
			}

			rsp, err := b.accessClient.Check(ctx, user, req, "")
			if err != nil {
				return authorizer.DecisionDeny, "failed to check permissions", err
			}
			if rsp.Allowed {
				return authorizer.DecisionAllow, "", nil
			}
			if req.Subresource != "" {
				return authorizer.DecisionDeny, "missing `" + req.Subresource + "` subresource permission", nil
			}
			return authorizer.DecisionDeny, "access denied", nil
		})
}
