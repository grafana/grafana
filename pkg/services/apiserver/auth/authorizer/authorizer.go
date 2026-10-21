package authorizer

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	"k8s.io/apiserver/pkg/authorization/union"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// NewAllowAuthorizer returns an authorizer that systematically allows access for resource requests.
// Correct authorization has to be performed elsewhere (e.g. at the storage layer based on a target resource).
func NewAllowAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		return authorizer.DecisionAllow, "", nil
	})
}

var _ authorizer.Authorizer = (*GrafanaAuthorizer)(nil)

// RouteOwnership reports which custom route, if any, owns a request path for a request whose
// derived Kubernetes verb is verb. It is satisfied by the route table that embedded
// apiextensions keeps, and declared here rather than imported so this package stays free of
// the route-handling implementation, which lives in enterprise code.
type RouteOwnership interface {
	OwnerFor(path, verb string) (owner string, ok bool)
}

type GrafanaAuthorizer struct {
	// mu guards apis so per-CRD-group authorizers can be registered and
	// unregistered dynamically at runtime (e.g. by CRDRegistrationController)
	// while requests are being authorized concurrently.
	mu   sync.RWMutex
	apis map[string]authorizer.Authorizer
	// routeApis holds the authorizers for custom routes, registered per group-version by the
	// route-handling controller when embedded apiextensions serves RouteHandlers. It is a
	// separate map from apis, not a second writer to it, because a group-version can be served
	// by both a CRD and a RouteHandler: sharing one slot would mean whichever component
	// registered last silently replaced the other's authorizer.
	routeApis map[string]authorizer.Authorizer
	// routes tells whether a path belongs to a custom route, which decides whether the
	// search-request rewrite in Authorize applies. Nil in a server that serves no custom routes,
	// which is every server with route handling turned off.
	routes RouteOwnership
	auth   authorizer.Authorizer
}

// NewGrafanaBuiltInSTAuthorizer returns an authorizer configured for a grafana instance.
// should not be used anywhere except for ST builtin Grafana
// This authorizer is a chain of smaller authorizers that together form the decision if
// access should be granted.
//  1. We deny all impersonate request.
//  2. We allow all identities that belongs to `system:masters` group, regular grafana identities cannot
//     be part of this group
//  3. We check that identity is allowed to make a request for namespace.
//  4. We check the custom-route authorizer for the APIGroup/APIVersion, registered by
//     RouteHandler objects when embedded apiextensions serves custom routes.
//  5. We check authorizer that is configured speficially for an api.
//  6. We deny a group-version that a RouteHandler made servable and that nothing above
//     decided, so route-served group-versions fail closed instead of reaching the org-role
//     fallback below. Without route handling this link never has an opinion.
//  7. As a last fallback we check Role, this will only happen if an api have not configured
//     an authorizer or return authorizer.DecisionNoOpinion
func NewGrafanaBuiltInSTAuthorizer() *GrafanaAuthorizer {
	authorizers := []union.NamedAuthorizer{ //nolint:prealloc
		{AuthorizerName: "impersonation", Authorizer: NewImpersonationAuthorizer()},
		{AuthorizerName: "privileged-groups", Authorizer: authorizerfactory.NewPrivilegedGroups(k8suser.SystemPrivilegedGroup)},
		{AuthorizerName: "namespace", Authorizer: NewNamespaceAuthorizer()},
	}

	// Individual services may have explicit implementations
	apis := make(map[string]authorizer.Authorizer)
	routeApis := make(map[string]authorizer.Authorizer)
	ga := &GrafanaAuthorizer{
		apis:      apis,
		routeApis: routeApis,
	}
	// The route slot is consulted before the per-group-version one: a custom route's authorizer
	// answers only for the paths its RouteHandler owns and returns NoOpinion for everything
	// else, so on a group-version shared with a CRD the route paths get route authz while the
	// CRD's own resources still reach the CRD authorizer below.
	authorizers = append(authorizers, union.NamedAuthorizer{AuthorizerName: "route-api", Authorizer: &authorizerForAPI{apis: routeApis, mu: &ga.mu}})

	// The apiVersion flavors will run first and can return early when FGAC has appropriate rules
	authorizers = append(authorizers, union.NamedAuthorizer{AuthorizerName: "api", Authorizer: &authorizerForAPI{apis: apis, mu: &ga.mu}})

	// The multi-tenant authorizer's chain has no fallback: when every link returns
	// NoOpinion the request is denied. Single-tenant
	// Grafana's chain ends with the org-role authorizer instead, which allows a viewer's GET
	// of anything, so a route-served group-version would be decided by the org role rather
	// than by the route's own policy. Restore the fail-closed behaviour for exactly those
	// group-versions, and only for them: a group-version with no route authorizer registered
	// (which is all of them while route handling is off) is left to the chain as it stands.
	authorizers = append(authorizers, union.NamedAuthorizer{AuthorizerName: "route-group-fail-closed", Authorizer: &routeServedGroupDenier{apis: routeApis, mu: &ga.mu}})

	// org role authorizer is last -- and will return allow for verbs that match expectations
	// it is only helpful here for remote APIs in some cloud use-cases.
	//nolint:staticcheck // remove once build handler chains are untangled between local and remote APIs handling
	authorizers = append(authorizers, union.NamedAuthorizer{AuthorizerName: "role", Authorizer: NewRoleAuthorizer()})
	auth, err := union.New(authorizers...)
	if err != nil {
		panic(err)
	}
	ga.auth = auth
	return ga
}

func (a *GrafanaAuthorizer) Register(gv schema.GroupVersion, fn authorizer.Authorizer) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.apis[gv.String()] = fn
}

// Unregister removes the authorizer for a specific GroupVersion. It is used for
// dynamic removal of authorizers when CRD-backed API groups are deleted or no
// longer served.
func (a *GrafanaAuthorizer) Unregister(gv schema.GroupVersion) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.apis, gv.String())
}

// RegisterRouteAuthorizer registers the custom-route authorizer for a GroupVersion. It is
// consulted before the authorizer registered by Register, and is expected to return
// DecisionNoOpinion for any request that is not one of its own routes so the rest of the chain
// still decides.
func (a *GrafanaAuthorizer) RegisterRouteAuthorizer(gv schema.GroupVersion, fn authorizer.Authorizer) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.routeApis[gv.String()] = fn
}

// UnregisterRouteAuthorizer removes the custom-route authorizer for a GroupVersion, used when
// the last RouteHandler targeting it goes away.
func (a *GrafanaAuthorizer) UnregisterRouteAuthorizer(gv schema.GroupVersion) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.routeApis, gv.String())
}

// SetRouteOwnership wires the lookup that tells this authorizer which paths belong to custom
// routes. It is called once while the server is being built, before any request is served; a
// server without custom route handling never calls it.
func (a *GrafanaAuthorizer) SetRouteOwnership(routes RouteOwnership) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.routes = routes
}

// IsListKeysRequest reports whether attr is a call to a kind's list-keys endpoint.
//
// Exported because the multi-tenant apiserver has its own chain and has to apply
// the same rule.
func IsListKeysRequest(attr authorizer.Attributes) bool {
	if !attr.IsResourceRequest() || attr.GetVerb() != "create" || attr.GetSubresource() != "" {
		return false
	}
	return attr.GetName() == utils.ListKeysPathSegment
}

// Authorize implements authorizer.Authorizer.
func (a *GrafanaAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	// Restated before the chain, not inside one link: the org role authorizer
	// allows a viewer to list but not to create.
	//
	// A path a custom route owns keeps the verb it arrived with. These endpoints are served
	// over POST, and the route slot classifies a request - route or CRD - by the methods its
	// verb implies; restating the POST as a "list" here would tell that slot the caller made a
	// GET, a request the CRD handler serves, so the route's own authorization would be skipped
	// and the CRD authorizer would decide instead. A route that reads is restated by the policy
	// that owns it.
	if (IsSearchRequest(attr) || IsListKeysRequest(attr)) && !a.routeOwns(attr) {
		attr = AsReadAttributes(attr)
	}
	return a.auth.Authorize(ctx, attr)
}

// routeOwns reports whether a custom route owns the request's path. It is false when no
// ownership lookup has been wired, which leaves the rewrite unconditional as it is without
// route handling.
func (a *GrafanaAuthorizer) routeOwns(attr authorizer.Attributes) bool {
	a.mu.RLock()
	routes := a.routes
	a.mu.RUnlock()
	if routes == nil {
		return false
	}
	_, ok := routes.OwnerFor(attr.GetPath(), attr.GetVerb())
	return ok
}

// ConditionsAwareAuthorize implements authorizer.Authorizer.
func (a *GrafanaAuthorizer) ConditionsAwareAuthorize(ctx context.Context, attr authorizer.Attributes) authorizer.ConditionsAwareDecision {
	return authorizer.ConditionsAwareDecisionFromParts(a.Authorize(ctx, attr))
}

// EvaluateConditions implements authorizer.Authorizer.
func (a *GrafanaAuthorizer) EvaluateConditions(_ context.Context, _ authorizer.ConditionsAwareDecision, _ authorizer.ConditionsData) (authorizer.Decision, string, error) {
	return authorizer.DecisionDeny, "", authorizer.ErrorConditionEvaluationNotSupported
}

// routeServedGroupDenier denies a resource request to a group-version that a RouteHandler made
// servable and that no earlier link in the chain decided.
//
// It reads the same map as the route slot, so its scope is exactly the group-versions custom
// route handling covers; every other group-version gets no opinion and the chain continues to
// the org-role fallback unchanged. Non-resource requests (discovery, openapi) are left alone:
// they are not custom routes and are allowed earlier for every served group.
type routeServedGroupDenier struct {
	mu   *sync.RWMutex
	apis map[string]authorizer.Authorizer
}

func (a *routeServedGroupDenier) Authorize(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}
	a.mu.RLock()
	_, served := a.apis[attr.GetAPIGroup()+"/"+attr.GetAPIVersion()]
	a.mu.RUnlock()
	if !served {
		return authorizer.DecisionNoOpinion, "", nil
	}
	return authorizer.DecisionDeny, "no custom route or custom resource authorized this request", nil
}

func (a *routeServedGroupDenier) ConditionsAwareAuthorize(ctx context.Context, attr authorizer.Attributes) authorizer.ConditionsAwareDecision {
	return authorizer.ConditionsAwareDecisionFromParts(a.Authorize(ctx, attr))
}

func (*routeServedGroupDenier) EvaluateConditions(_ context.Context, _ authorizer.ConditionsAwareDecision, _ authorizer.ConditionsData) (authorizer.Decision, string, error) {
	return authorizer.DecisionDeny, "", authorizer.ErrorConditionEvaluationNotSupported
}

type authorizerForAPI struct {
	mu   *sync.RWMutex
	apis map[string]authorizer.Authorizer
}

func (a *authorizerForAPI) Authorize(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	a.mu.RLock()
	auth, ok := a.apis[attr.GetAPIGroup()+"/"+attr.GetAPIVersion()]
	a.mu.RUnlock()
	if ok {
		return auth.Authorize(ctx, attr)
	}
	return authorizer.DecisionNoOpinion, "", nil
}

// ConditionsAwareAuthorize implements authorizer.Authorizer.
func (a *authorizerForAPI) ConditionsAwareAuthorize(ctx context.Context, attr authorizer.Attributes) authorizer.ConditionsAwareDecision {
	return authorizer.ConditionsAwareDecisionFromParts(a.Authorize(ctx, attr))
}

// EvaluateConditions implements authorizer.Authorizer.
func (a *authorizerForAPI) EvaluateConditions(_ context.Context, _ authorizer.ConditionsAwareDecision, _ authorizer.ConditionsData) (authorizer.Decision, string, error) {
	return authorizer.DecisionDeny, "", authorizer.ErrorConditionEvaluationNotSupported
}
