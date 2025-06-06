package accesscontrol

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ResourceResolver is called before authorization is performed.
// It can be used to translate resoruce name into one or more valid scopes that
// will be used for authorization. If more than one scope is returned from a resolver
// only one needs to match to allow call to be authorized.
type ResourceResolver interface {
	Resolve(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error)
}

// ResourceResolverFunc is an adapter so that functions can implement ResourceResolver.
type ResourceResolverFunc func(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error)

func (r ResourceResolverFunc) Resolve(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error) {
	return r(ctx, ns, name)
}

type ResourceAuthorizerOptions struct {
	// Resource is the resource name in plural.
	Resource string
	// Unchecked is used to skip authorization checks for specified verbs.
	// This takes precedence over configured Mapping
	Unchecked map[string]bool
	// Attr is attribute used for resource scope. It's usually 'id' or 'uid'
	// depending on what is stored for the resource.
	Attr string
	// Mapping is used to translate k8s verb to rbac action.
	// Key is the desired verb and value the rbac action it should be translated into.
	// If no mapping is provided it will get a "default" mapping.
	Mapping map[string]string
	// Resolver if passed can translate into one or more scopes used to authorize resource.
	// This is useful when stored scopes are based on something else than k8s name or
	// for resources that inherit permission from folder.
	Resolver ResourceResolver
}

var _ claims.AccessClient = (*LegacyAccessClient)(nil)

func NewLegacyAccessClient(ac AccessControl, opts ...ResourceAuthorizerOptions) *LegacyAccessClient {
	stored := map[string]ResourceAuthorizerOptions{}

	defaultMapping := func(r string) map[string]string {
		return map[string]string{
			utils.VerbGet:              fmt.Sprintf("%s:read", r),
			utils.VerbList:             fmt.Sprintf("%s:read", r),
			utils.VerbWatch:            fmt.Sprintf("%s:read", r),
			utils.VerbCreate:           fmt.Sprintf("%s:create", r),
			utils.VerbUpdate:           fmt.Sprintf("%s:write", r),
			utils.VerbPatch:            fmt.Sprintf("%s:write", r),
			utils.VerbDelete:           fmt.Sprintf("%s:delete", r),
			utils.VerbDeleteCollection: fmt.Sprintf("%s:delete", r),
			utils.VerbGetPermissions:   fmt.Sprintf("%s.permissions:read", r),
			utils.VerbSetPermissions:   fmt.Sprintf("%s.permissions:write", r),
		}
	}

	for _, o := range opts {
		if o.Unchecked == nil {
			o.Unchecked = map[string]bool{}
		}

		if o.Mapping == nil {
			o.Mapping = defaultMapping(o.Resource)
		}

		stored[o.Resource] = o
	}

	return &LegacyAccessClient{ac.WithoutResolvers(), stored}
}

type LegacyAccessClient struct {
	ac   AccessControl
	opts map[string]ResourceAuthorizerOptions
}

func (c *LegacyAccessClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest) (claims.CheckResponse, error) {
	ident, ok := id.(identity.Requester)
	if !ok {
		return claims.CheckResponse{}, errors.New("expected identity.Requester for legacy access control")
	}

	opts, ok := c.opts[req.Resource]
	if !ok {
		// For now we fallback to grafana admin if no options are found for resource.
		if ident.GetIsGrafanaAdmin() {
			return claims.CheckResponse{Allowed: true}, nil
		}
		return claims.CheckResponse{}, nil
	}

	skip := opts.Unchecked[req.Verb]
	if skip {
		return claims.CheckResponse{Allowed: true}, nil
	}

	action, ok := opts.Mapping[req.Verb]
	if !ok {
		return claims.CheckResponse{}, fmt.Errorf("missing action for %s %s", req.Verb, req.Resource)
	}

	ns, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return claims.CheckResponse{}, err
	}

	var eval Evaluator
	if req.Name != "" {
		if opts.Resolver != nil {
			scopes, err := opts.Resolver.Resolve(ctx, ns, req.Name)
			if err != nil {
				return claims.CheckResponse{}, err
			}
			eval = EvalPermission(action, scopes...)
		} else {
			eval = EvalPermission(action, fmt.Sprintf("%s:%s:%s", opts.Resource, opts.Attr, req.Name))
		}
	} else if req.Verb == utils.VerbList {
		// For list request we need to filter out in storage layer.
		eval = EvalPermission(action)
	} else {
		// Assuming that all non list request should have a valid name
		return claims.CheckResponse{}, fmt.Errorf("unhandled authorization: %s %s", req.Group, req.Verb)
	}

	allowed, err := c.ac.Evaluate(ctx, ident, eval)
	if err != nil {
		return claims.CheckResponse{}, err
	}

	return claims.CheckResponse{Allowed: allowed}, nil
}

func (c *LegacyAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, error) {
	ident, ok := id.(identity.Requester)
	if !ok {
		return nil, errors.New("expected identity.Requester for legacy access control")
	}

	opts, ok := c.opts[req.Resource]
	if !ok {
		return nil, fmt.Errorf("unsupported resource: %s", req.Resource)
	}

	action, ok := opts.Mapping[utils.VerbList]
	if !ok {
		return nil, fmt.Errorf("missing action for %s %s", utils.VerbList, req.Resource)
	}

	check := Checker(ident, action)
	return func(name, _ string) bool {
		return check(fmt.Sprintf("%s:%s:%s", opts.Resource, opts.Attr, name))
	}, nil
}
