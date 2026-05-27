package authorizer

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	claims "github.com/grafana/authlib/types"
)

func NewResourceAuthorizer(c claims.AccessChecker) authorizer.Authorizer {
	return ResourceAuthorizer{c}
}

// ResourceAuthorizer is used to translate authorizer.Authorizer calls to claims.AccessClient calls
type ResourceAuthorizer struct {
	c claims.AccessChecker
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
	}, "") // NOTE: we do not know the folder in this context

	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	if !res.Allowed {
		return authorizer.DecisionDeny, "unauthorized request", nil
	}

	return authorizer.DecisionAllow, "", nil
}

// SubresourceCheck performs an authorization check for a specific subresource.
type SubresourceCheck func(ctx context.Context, ident claims.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error)

// NewResourceAuthorizerWithSubresourceHandlers creates an authorizer that:
//   - delegates to ResourceAuthorizer when subresource is empty,
//   - runs the matching SubresourceCheck for known subresources,
//   - denies unknown subresources outright.
func NewResourceAuthorizerWithSubresourceHandlers(
	c claims.AccessChecker,
	checks map[string]SubresourceCheck,
) authorizer.Authorizer {
	delegate := NewResourceAuthorizer(c)
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}
		sub := attr.GetSubresource()
		if sub == "" {
			return delegate.Authorize(ctx, attr)
		}
		check, ok := checks[sub]
		if !ok {
			return authorizer.DecisionDeny, "", fmt.Errorf("no authorizer for subresource %q", sub)
		}
		ident, ok := claims.AuthInfoFrom(ctx)
		if !ok {
			return authorizer.DecisionDeny, "", errors.New("no identity found")
		}
		return check(ctx, ident, attr)
	})
}
