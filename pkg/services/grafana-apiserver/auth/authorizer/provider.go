package authorizer

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/union"

	orgsvc "github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authorizer.Authorizer = (*GrafanaAuthorizer)(nil)

type GrafanaAuthorizer struct {
	apis         map[string]authorizer.Authorizer
	defaultAuthz authorizer.Authorizer

	// Wraps an authorizer in standard logic
	Wrapper func(authorizer.AuthorizerFunc) authorizer.Authorizer
}

func NewGrafanaAuthorizer(cfg *setting.Cfg, orgService orgsvc.Service) *GrafanaAuthorizer {
	wrapper := func(a authorizer.AuthorizerFunc) authorizer.Authorizer {
		authorizers := []authorizer.Authorizer{
			&impersonationAuthorizer{},
		}

		// In Hosted grafana, the StackID replaces the orgID as a valid namespace
		if cfg.StackID != "" {
			authorizers = append(authorizers, newStackIDAuthorizer(cfg))
		} else {
			authorizers = append(authorizers, newOrgIDAuthorizer(orgService))
		}

		// Individual services may have explicit implementations
		if a != nil {
			authorizers = append(authorizers, a)
		}

		// org role is last -- and will return allow for verbs that match expectations
		authorizers = append(authorizers, newOrgRoleAuthorizer(orgService))
		return union.New(authorizers...)
	}

	return &GrafanaAuthorizer{
		apis:         make(map[string]authorizer.Authorizer),
		Wrapper:      wrapper,
		defaultAuthz: wrapper(nil),
	}
}

func (a *GrafanaAuthorizer) Register(apiVersion string, auth authorizer.Authorizer) {
	a.apis[apiVersion] = auth
}

// Authorize implements authorizer.Authorizer.
func (a *GrafanaAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	auth, ok := a.apis[attr.GetAPIGroup()+"/"+attr.GetAPIVersion()]
	if ok {
		return auth.Authorize(ctx, attr)
	}
	return a.defaultAuthz.Authorize(ctx, attr)
}
