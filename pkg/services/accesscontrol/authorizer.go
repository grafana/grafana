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

func (c *LegacyAccessClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
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
	} else if req.Verb == utils.VerbList || req.Verb == utils.VerbCreate {
		// For list request we need to filter out in storage layer.
		// For create requests we don't have a name yet, so we can only check if the action is allowed.
		eval = EvalPermission(action)
	} else {
		// Assuming that all non list request should have a valid name
		return claims.CheckResponse{}, fmt.Errorf("unhandled authorization: %s %s", req.Group, req.Verb)
	}

	allowed, err := c.ac.Evaluate(ctx, ident, eval)
	if err != nil {
		return claims.CheckResponse{}, err
	}

	// NOTE: folder is looked up again in the evaluator:
	// pkg/services/accesscontrol/acimpl/accesscontrol.go#L77

	return claims.CheckResponse{Allowed: allowed}, nil
}

func (c *LegacyAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	ident, ok := id.(identity.Requester)
	if !ok {
		return nil, claims.NoopZookie{}, errors.New("expected identity.Requester for legacy access control")
	}

	opts, ok := c.opts[req.Resource]
	if !ok {
		return nil, claims.NoopZookie{}, fmt.Errorf("unsupported resource: %s", req.Resource)
	}

	action, ok := opts.Mapping[utils.VerbList]
	if !ok {
		return nil, claims.NoopZookie{}, fmt.Errorf("missing action for %s %s", utils.VerbList, req.Resource)
	}

	check := Checker(ident, action)
	return func(name, _ string) bool {
		return check(fmt.Sprintf("%s:%s:%s", opts.Resource, opts.Attr, name))
	}, claims.NoopZookie{}, nil
}

func (c *LegacyAccessClient) BatchCheck(ctx context.Context, id claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	ident, ok := id.(identity.Requester)
	if !ok {
		return claims.BatchCheckResponse{}, errors.New("expected identity.Requester for legacy access control")
	}

	results := make(map[string]claims.BatchCheckResult, len(req.Checks))

	// Cache checkers by action to avoid recreating them for each check
	checkerCache := make(map[string]func(scopes ...string) bool)

	for _, check := range req.Checks {
		opts, ok := c.opts[check.Resource]
		if !ok {
			// For now w  fallback to grafana admin if no options are found for resource.
			if ident.GetIsGrafanaAdmin() {
				results[check.CorrelationID] = claims.BatchCheckResult{Allowed: true}
			} else {
				results[check.CorrelationID] = claims.BatchCheckResult{Allowed: false}
			}
			continue
		}

		// Check if verb should be skipped
		if opts.Unchecked[check.Verb] {
			results[check.CorrelationID] = claims.BatchCheckResult{Allowed: true}
			continue
		}

		action, ok := opts.Mapping[check.Verb]
		if !ok {
			results[check.CorrelationID] = claims.BatchCheckResult{
				Allowed: false,
				Error:   fmt.Errorf("missing action for %s %s", check.Verb, check.Resource),
			}
			continue
		}

		// Get or create cached checker for this action
		checker, ok := checkerCache[action]
		if !ok {
			checker = Checker(ident, action)
			checkerCache[action] = checker
		}

		// Handle list and create verbs (no specific name)
		// TODO: Should we allow list/create without name in a BatchCheck request?
		if check.Name == "" {
			if check.Verb == utils.VerbList || check.Verb == utils.VerbCreate {
				// For list/create without name, check if user has the action at all
				// TODO: Is this correct for Create?
				results[check.CorrelationID] = claims.BatchCheckResult{
					Allowed: len(ident.GetPermissions()[action]) > 0,
				}
			} else {
				results[check.CorrelationID] = claims.BatchCheckResult{
					Allowed: false,
					Error:   fmt.Errorf("unhandled authorization: %s %s", check.Group, check.Verb),
				}
			}
			continue
		}

		// Check with resolver or direct scope
		var allowed bool
		if opts.Resolver != nil {
			ns, err := claims.ParseNamespace(check.Namespace)
			if err != nil {
				results[check.CorrelationID] = claims.BatchCheckResult{
					Allowed: false,
					Error:   err,
				}
				continue
			}
			scopes, err := opts.Resolver.Resolve(ctx, ns, check.Name)
			if err != nil {
				results[check.CorrelationID] = claims.BatchCheckResult{
					Allowed: false,
					Error:   err,
				}
				continue
			}
			allowed = checker(scopes...)
		} else {
			allowed = checker(fmt.Sprintf("%s:%s:%s", opts.Resource, opts.Attr, check.Name))
		}

		results[check.CorrelationID] = claims.BatchCheckResult{Allowed: allowed}
	}

	return claims.BatchCheckResponse{
		Results: results,
		Zookie:  claims.NoopZookie{},
	}, nil
}
