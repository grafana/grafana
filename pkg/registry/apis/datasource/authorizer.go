package datasource

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

var queryTypesResource = datasourceV0.QueryTypeDefinitionResourceInfo.GroupResource().Resource

func (b *DataSourceAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	group := b.GetGroupVersion().Group
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			sub := attr.GetSubresource()

			var svcIdentity []string
			if authInfo, ok := authlib.AuthInfoFrom(ctx); ok {
				svcIdentity = authInfo.GetExtra()[authn.ServiceIdentityKey]
			}

			// Observe svc_identity state for future enforcement.
			caller := "empty"
			if len(svcIdentity) > 0 {
				caller = svcIdentity[0]
			}

			verb := attr.GetVerb()

			user, err := identity.GetRequester(ctx)
			if err != nil {
				recordAuthzDecision(group, sub, verb, caller, "deny", "no_user")
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// Query types are static plugin schemas, the same for every tenant, and
			// the OpenAPI document already shows them to the same callers. They are
			// cluster-scoped, so the namespaced datasource check below would fail
			// with a namespace mismatch for any caller that is not cluster-wide.
			//
			// validate is open only because it is a stub that reads nothing. A real
			// validator needs its own permission decision here.
			if attr.GetResource() == queryTypesResource {
				allowed := verb == utils.VerbGet || verb == utils.VerbList
				if sub != "" {
					allowed = sub == "validate" && verb == utils.VerbCreate
				}
				if allowed {
					recordAuthzDecision(group, sub, verb, caller, "allow", "")
					return authorizer.DecisionAllow, "", nil
				}
				recordAuthzDecision(group, sub, verb, caller, "deny", "access_denied")
				return authorizer.DecisionDeny, "unsupported verb or subresource for query types", nil
			}

			req := authlib.CheckRequest{
				Group:     group,
				Resource:  "datasources",
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
				Verb:      verb,
			}

			if sub != "" {
				req.Verb = utils.VerbCreate
				req.Subresource = "query"
			}

			rsp, err := b.accessClient.Check(ctx, user, req, "")
			if err != nil {
				recordAuthzDecision(group, sub, verb, caller, "deny", "error")
				return authorizer.DecisionDeny, "failed to check permissions", err
			}
			if rsp.Allowed {
				recordAuthzDecision(group, sub, verb, caller, "allow", "")
				return authorizer.DecisionAllow, "", nil
			}
			if req.Subresource != "" {
				recordAuthzDecision(group, sub, verb, caller, "deny", "missing_permissions")
				return authorizer.DecisionDeny, "missing `query` subresource permission", nil
			}

			recordAuthzDecision(group, sub, verb, caller, "deny", "access_denied")
			return authorizer.DecisionDeny, "access denied", nil
		})
}
