package accesscontrol

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

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

var _ claims.AccessClient = (*LegacyAccessClient)(nil)

func NewLegacyAccessClient(ac AccessControl, opts ...ResourceAuthorizerOptions) *LegacyAccessClient {
	stored := map[string]ResourceAuthorizerOptions{}

	for _, o := range opts {
		if o.Mapping == nil {
			o.Mapping = map[string]string{}
		}
		stored[o.Resource] = o
	}

	return &LegacyAccessClient{ac.WithoutResolvers(), stored}
}

type LegacyAccessClient struct {
	ac   AccessControl
	opts map[string]ResourceAuthorizerOptions
}

// HasAccess implements claims.AccessClient.
func (c *LegacyAccessClient) HasAccess(ctx context.Context, id claims.AuthInfo, req claims.AccessRequest) (bool, error) {
	ident, ok := id.(identity.Requester)
	if !ok {
		return false, errors.New("expected identity.Requester for legacy access control")
	}

	opts, ok := c.opts[req.Resource]
	if !ok {
		// FIXME: how should be handle this
		if ident.GetIsGrafanaAdmin() {
			return true, nil
		}
		return false, nil
	}

	action, ok := opts.Mapping[req.Verb]
	if !ok {
		return false, fmt.Errorf("missing action for %s %s", req.Verb, req.Resource)
	}

	ns, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return false, err
	}

	var eval Evaluator
	if req.Name != "" {
		if opts.Resolver != nil {
			scopes, err := opts.Resolver.Resolve(ctx, ns, req.Name)
			if err != nil {
				return false, err
			}
			eval = EvalPermission(action, scopes...)
		} else {
			eval = EvalPermission(action, fmt.Sprintf("%s:%s:%s", opts.Resource, opts.Attr, req.Name))
		}
	} else if req.Verb == "list" {
		// For list request we need to filter out in storage layer.
		eval = EvalPermission(action)
	} else {
		// Assuming that all non list request should have a valid name
		return false, fmt.Errorf("unhandled authorization: %s %s", req.Group, req.Verb)
	}

	return c.ac.Evaluate(ctx, ident, eval)
}

// Compile implements claims.AccessClient.
func (c *LegacyAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.AccessRequest) (claims.AccessChecker, error) {
	ident, ok := id.(identity.Requester)
	if !ok {
		return nil, errors.New("expected identity.Requester for legacy access control")
	}

	opts, ok := c.opts[req.Resource]
	if !ok {
		return nil, fmt.Errorf("unsupported resource: %s", req.Resource)
	}

	action, ok := opts.Mapping[req.Verb]
	if !ok {
		return nil, fmt.Errorf("missing action for %s %s", req.Verb, req.Resource)
	}

	check := Checker(ident, action)
	return func(_, name string) bool {
		return check(fmt.Sprintf("%s:%s:%s", opts.Resource, opts.Attr, name))
	}, nil
}
