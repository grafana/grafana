package accesscontrol

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/union"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func NewAuthorizerChain(authorizers ...authorizer.Authorizer) authorizer.Authorizer {
	authorizers = append(authorizers, newLastAuthorizer())
	return union.New(authorizers...)
}

type ResourceResolver interface {
	Resolve(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error)
}

type ResourceResolverFunc func(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error)

func (r ResourceResolverFunc) Resolve(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error) {
	return r(ctx, ns, name)
}

type ResourceAuthorizerOptions struct {
	// Resource is the resource name in plural.
	Resource string
	// Attr is attribute used for resource scope.
	Attr string
	// Mapping is used to translate k8s verb to rbac action.
	Mapping map[string]string
	// Resolver if passed can translate into one or more scopes used to authorize resource.
	Resolver ResourceResolver
}

func NewResourceAuthorizer(ac AccessControl, opts ResourceAuthorizerOptions) authorizer.Authorizer {
	if opts.Mapping == nil {
		opts.Mapping = map[string]string{}
	}

	return ResourceAuthorizer{ac.WithoutResolvers(), opts}
}

type ResourceAuthorizer struct {
	ac   AccessControl
	opts ResourceAuthorizerOptions
}

// Authorize implements authorizer.Authorizer.
func (r ResourceAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	if attr.GetResource() != r.opts.Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}

	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	action, ok := r.opts.Mapping[attr.GetVerb()]
	if !ok {
		return authorizer.DecisionDeny, fmt.Sprintf("missing action for %s %s", attr.GetVerb(), attr.GetResource()), nil
	}

	ns, err := claims.ParseNamespace(attr.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	var eval Evaluator
	if attr.GetName() != "" {
		if r.opts.Resolver != nil {
			scopes, err := r.opts.Resolver.Resolve(ctx, ns, attr.GetName())
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}
			eval = EvalPermission(action, scopes...)
		} else {
			eval = EvalPermission(action, fmt.Sprintf("%s:%s:%s", r.opts.Resource, r.opts.Attr, attr.GetName()))
		}
	} else if attr.GetVerb() == "list" {
		// For list request we need to filter out in storage layer.
		eval = EvalPermission(action)
	} else {
		// Assuming that all non list request should have a valid name
		return authorizer.DecisionDeny, "unhandled authorization", nil
	}

	ok, err = r.ac.Evaluate(ctx, ident, eval)
	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	if !ok {
		return authorizer.DecisionDeny, fmt.Sprintf("cannot %s %s", attr.GetVerb(), attr.GetResource()), nil
	}

	return authorizer.DecisionAllow, "", nil
}

var _ authorizer.Authorizer = (*lastAuthorizer)(nil)

func newLastAuthorizer() authorizer.Authorizer {
	return lastAuthorizer{}
}

type lastAuthorizer struct{}

func (d lastAuthorizer) Authorize(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionAllow, "", nil
	}

	if attr.GetVerb() == "list" {
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionDeny, "", nil
}
