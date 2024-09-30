package authorizer

import (
	"context"

	orgsvc "github.com/grafana/grafana/pkg/services/org"
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

func NewGrafanaAuthorizer(cfg *setting.Cfg, orgService orgsvc.Service) *GrafanaAuthorizer {
	authorizers := []authorizer.Authorizer{
		&impersonationAuthorizer{},
		authorizerfactory.NewPrivilegedGroups(k8suser.SystemPrivilegedGroup),
	}

	// In Hosted grafana, the StackID replaces the orgID as a valid namespace
	if cfg.StackID != "" {
		authorizers = append(authorizers, newStackIDAuthorizer(cfg))
	} else {
		authorizers = append(authorizers, newOrgIDAuthorizer(orgService))
	}

	// Individual services may have explicit implementations
	apis := make(map[string]authorizer.Authorizer)
	authorizers = append(authorizers, &authorizerForAPI{apis})

	// org role is last -- and will return allow for verbs that match expectations
	// The apiVersion flavors will run first and can return early when FGAC has appropriate rules
	authorizers = append(authorizers, newOrgRoleAuthorizer(orgService))
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
