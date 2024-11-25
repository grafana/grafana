package authorizer

import (
	"context"
	"errors"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func NewResourceAuthorizer(c authz.AccessClient) authorizer.Authorizer {
	return ResourceAuthorizer{c}
}

// ResourceAuthorizer is used to translate authorizer.Authorizer calls to claims.AccessClient calls
type ResourceAuthorizer struct {
	c authz.AccessClient
}

func (r ResourceAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	ident, ok := claims.From(ctx)
	if !ok {
		return authorizer.DecisionDeny, "", errors.New("no identity found for request")
	}

	res, err := r.c.Check(ctx, ident, authz.CheckRequest{
		Verb:        attr.GetVerb(),
		Group:       attr.GetAPIGroup(),
		Resource:    attr.GetResource(),
		Namespace:   attr.GetNamespace(),
		Name:        attr.GetName(),
		Subresource: attr.GetSubresource(),
		Path:        attr.GetPath(),
	})

	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	if !res.Allowed {
		return authorizer.DecisionDeny, "unauthorized request", nil
	}

	return authorizer.DecisionAllow, "", nil
}
