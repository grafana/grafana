package authorizer

import (
	"context"
	"errors"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	claims "github.com/grafana/authlib/types"
)

func NewResourceAuthorizer(c claims.AccessClient) authorizer.Authorizer {
	return ResourceAuthorizer{c}
}

// ResourceAuthorizer is used to translate authorizer.Authorizer calls to claims.AccessClient calls
type ResourceAuthorizer struct {
	c claims.AccessClient
}

func (r ResourceAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	ident, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return authorizer.DecisionDeny, "", errors.New("no identity found for request")
	}

	res, err := r.c.Check(ctx, ident, claims.CheckRequest{
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
