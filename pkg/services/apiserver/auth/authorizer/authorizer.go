package authorizer

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	"k8s.io/apiserver/pkg/authorization/union"
)

var _ authorizer.Authorizer = (*GrafanaAuthorizer)(nil)

type GrafanaAuthorizer struct {
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
func NewGrafanaBuiltInSTAuthorizer(cfg *setting.Cfg) *GrafanaAuthorizer {
	authorizers := []authorizer.Authorizer{
		newImpersonationAuthorizer(),
		authorizerfactory.NewPrivilegedGroups(k8suser.SystemPrivilegedGroup),
		newNamespaceAuthorizer(),
	}

	// Individual services may have explicit implementations
	apis := make(map[string]authorizer.Authorizer)
	authorizers = append(authorizers, &authorizerForAPI{apis})

	// org role is last -- and will return allow for verbs that match expectations
	// The apiVersion flavors will run first and can return early when FGAC has appropriate rules
	authorizers = append(authorizers, newRoleAuthorizer())
	return &GrafanaAuthorizer{
		apis: apis,
		auth: union.New(authorizers...),
	}
}

func (a *GrafanaAuthorizer) Register(gv schema.GroupVersion, fn authorizer.Authorizer) {
	a.apis[gv.String()] = fn
}

// Authorize implements authorizer.Authorizer.
func (a *GrafanaAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	return a.auth.Authorize(ctx, attr)
}

type authorizerForAPI struct {
	apis map[string]authorizer.Authorizer
}

func (a *authorizerForAPI) Authorize(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	auth, ok := a.apis[attr.GetAPIGroup()+"/"+attr.GetAPIVersion()]
	if ok {
		return auth.Authorize(ctx, attr)
	}
	return authorizer.DecisionNoOpinion, "", nil
}
