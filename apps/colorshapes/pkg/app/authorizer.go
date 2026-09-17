package app

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// GetAuthorizer allows any authenticated Grafana user — see apps/colorshapes/plan.md
// for the visibility decision (no per-user restriction, just "must be signed in").
// It must be wired into the installer's GetAuthorizer method (see
// pkg/registry/apps/colorshapes/register.go) — the apiserver panics on a nil authorizer
// for a registered API group.
func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			if _, err := identity.GetRequester(ctx); err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			return authorizer.DecisionAllow, "", nil
		},
	)
}
