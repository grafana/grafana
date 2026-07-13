package datasource

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

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

			// Must have query permission to access any subresource
			if attr.GetSubresource() != "" {
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
				return authorizer.DecisionDeny, "missing `query` subresource permission", nil
			}
			return authorizer.DecisionDeny, "access denied", nil
		})
}
