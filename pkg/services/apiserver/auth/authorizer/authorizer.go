package authorizer

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	"k8s.io/apiserver/pkg/authorization/union"
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

type GrafanaAuthorizer struct {
	// mu guards apis so per-CRD-group authorizers can be registered and
	// unregistered dynamically at runtime (e.g. by CRDRegistrationController)
	// while requests are being authorized concurrently.
	mu   sync.RWMutex
	apis map[string]authorizer.Authorizer
	auth authorizer.Authorizer
}

// NewGrafanaBuiltInSTAuthorizer returns an authorizer configured for a grafana instance.
// should not be used anywhere except for ST builtin Grafana
// This authorizer is a chain of smaller authorizers that together form the decision if
// access should be granted.
//  1. We deny all impersonate request.
//  2. We allow all identities that belongs to `system:masters` group, regular grafana identities cannot
//     be part of this group
//  3. We check that identity is allowed to make a request for namespace.
//  4. We check authorizer that is configured speficially for an api.
//  5. As a last fallback we check Role, this will only happen if an api have not configured
//     an authorizer or return authorizer.DecisionNoOpinion
func NewGrafanaBuiltInSTAuthorizer() *GrafanaAuthorizer {
	authorizers := []authorizer.Authorizer{ //nolint:prealloc
		NewImpersonationAuthorizer(),
		authorizerfactory.NewPrivilegedGroups(k8suser.SystemPrivilegedGroup),
		newNamespaceAuthorizer(),
	}

	// Individual services may have explicit implementations
	apis := make(map[string]authorizer.Authorizer)
	ga := &GrafanaAuthorizer{
		apis: apis,
	}
	// The apiVersion flavors will run first and can return early when FGAC has appropriate rules
	authorizers = append(authorizers, &authorizerForAPI{apis: apis, mu: &ga.mu})

	// org role authorizer is last -- and will return allow for verbs that match expectations
	// it is only helpful here for remote APIs in some cloud use-cases.
	//nolint:staticcheck // remove once build handler chains are untangled between local and remote APIs handling
	authorizers = append(authorizers, NewRoleAuthorizer())
	ga.auth = union.New(authorizers...)
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

// Authorize implements authorizer.Authorizer.
func (a *GrafanaAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	return a.auth.Authorize(ctx, attr)
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
