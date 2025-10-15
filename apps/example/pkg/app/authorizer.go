package app

import (
	"context"
	"fmt"
	"regexp"

	"github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var namespacedSomethingRouteMatcher = regexp.MustCompile(fmt.Sprintf(`^/apis/%s/%s/namespaces/([^\/]+)/something$`, v1alpha1.APIGroup, v1alpha1.APIVersion))

// GetAuthorizer returns an authorizer for all kinds managed by the example app.
// It must be added to the installer in pkg/registry/apps/example/register.go to be used
func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			// require a user
			u, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// check if is admin
			if u.GetIsGrafanaAdmin() {
				return authorizer.DecisionAllow, "", nil
			}

			// Only allow admins to call the custom subresource
			if attr.GetSubresource() == "custom" {
				return authorizer.DecisionDeny, "forbidden", nil
			}

			// Only allow admins to call the namespaced and cluster routes
			// There's no easy way to check that from attrs like with GetSubresource(),
			// so we look at the full path and check
			if namespacedSomethingRouteMatcher.MatchString(attr.GetPath()) {
				return authorizer.DecisionDeny, "forbidden", nil
			}
			if attr.GetPath() == fmt.Sprintf("/apis/%s/%s/other", v1alpha1.APIGroup, v1alpha1.APIVersion) {
				return authorizer.DecisionDeny, "forbidden", nil
			}

			// Otherwise, allow
			return authorizer.DecisionAllow, "", nil
		},
	)
}
