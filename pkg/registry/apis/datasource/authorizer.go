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
		allowed, reason, err := AuthorizeDatasourceRequest(ctx, b.accessClient, DatasourceAuthorizationRequest{
			Group:       b.GetGroupVersion().Group,
			Namespace:   attr.GetNamespace(),
			UID:         attr.GetName(),
			Verb:        attr.GetVerb(),
			Subresource: attr.GetSubresource(),
		})
		if allowed {
			return authorizer.DecisionAllow, reason, err
		}
		return authorizer.DecisionDeny, reason, err
	})
}

type DatasourceAuthorizationRequest struct {
	Group       string
	Namespace   string
	UID         string
	Verb        string
	Subresource string
}

// AuthorizeDatasourceRequest shares datasource permission semantics across HTTP servers.
// Subresources all require create on datasources/query; read-only get/list retain their own verb.
func AuthorizeDatasourceRequest(ctx context.Context, access authlib.AccessClient, request DatasourceAuthorizationRequest) (bool, string, error) {
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
		recordAuthzDecision(request.Group, request.Subresource, request.Verb, caller, "deny", "no_user")
		return false, "valid user is required", err
	}

	req := authlib.CheckRequest{
		Group:     request.Group,
		Resource:  "datasources",
		Namespace: request.Namespace,
		Name:      request.UID,
		Verb:      request.Verb,
	}

	if request.Subresource != "" {
		req.Verb = utils.VerbCreate
		req.Subresource = "query"
	}

	rsp, err := access.Check(ctx, user, req, "")
	if err != nil {
		recordAuthzDecision(request.Group, request.Subresource, request.Verb, caller, "deny", "error")
		return false, "failed to check permissions", err
	}
	if rsp.Allowed {
		recordAuthzDecision(request.Group, request.Subresource, request.Verb, caller, "allow", "")
		return true, "", nil
	}
	if req.Subresource != "" {
		recordAuthzDecision(request.Group, request.Subresource, request.Verb, caller, "deny", "missing_permissions")
		return false, "missing `query` subresource permission", nil
	}

	recordAuthzDecision(request.Group, request.Subresource, request.Verb, caller, "deny", "access_denied")
	return false, "access denied", nil
}
