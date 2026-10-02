package datasource

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func (b *DataSourceAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}
		allowed, reason, err := AuthorizeDatasourceRequest(ctx, b.accessClient, b.GetGroupVersion().Group,
			attr.GetNamespace(), attr.GetName(), attr.GetVerb(), attr.GetSubresource())
		if allowed {
			return authorizer.DecisionAllow, reason, err
		}
		return authorizer.DecisionDeny, reason, err
	})
}

// AuthorizeDatasourceRequest shares datasource permission semantics across HTTP servers.
// Subresources all require create on datasources/query; read-only get/list retain their own verb.
func AuthorizeDatasourceRequest(ctx context.Context, access authlib.AccessClient, group, namespace, uid, verb, sub string) (bool, string, error) {
	var svcIdentity []string
	if authInfo, ok := authlib.AuthInfoFrom(ctx); ok {
		svcIdentity = authInfo.GetExtra()[authn.ServiceIdentityKey]
	}

	// Observe svc_identity state for future enforcement.
	caller := "empty"
	if len(svcIdentity) > 0 {
		caller = svcIdentity[0]
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		recordAuthzDecision(group, sub, verb, caller, "deny", "no_user")
		return false, "valid user is required", err
	}

	req := authlib.CheckRequest{
		Group:     group,
		Resource:  "datasources",
		Namespace: namespace,
		Name:      uid,
		Verb:      verb,
	}

	if sub != "" {
		req.Verb = utils.VerbCreate
		req.Subresource = "query"
	}

	rsp, err := access.Check(ctx, user, req, "")
	if err != nil {
		recordAuthzDecision(group, sub, verb, caller, "deny", "error")
		return false, "failed to check permissions", err
	}
	if rsp.Allowed {
		recordAuthzDecision(group, sub, verb, caller, "allow", "")
		return true, "", nil
	}
	if req.Subresource != "" {
		recordAuthzDecision(group, sub, verb, caller, "deny", "missing_permissions")
		return false, "missing `query` subresource permission", nil
	}

	recordAuthzDecision(group, sub, verb, caller, "deny", "access_denied")
	return false, "access denied", nil
}
