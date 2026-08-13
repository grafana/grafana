package dashboard

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func setGlobalVariablesToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaDashboardGlobalVariables: {
			Key:            featuremgmt.FlagGrafanaDashboardGlobalVariables,
			DefaultVariant: variant,
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

// TestDashboardsAPIBuilderVariableAuthorizer verifies that the global variables
// feature is gated per request in the authorizer: variable storage is always
// registered, so enablement is enforced here rather than at route-registration time.
func TestDashboardsAPIBuilderVariableAuthorizer(t *testing.T) {
	ctx := context.Background()
	authz := (&DashboardsAPIBuilder{}).GetAuthorizer()

	t.Run("denies variable requests for every verb when disabled", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		for _, verb := range []string{"get", "list", "watch", "create", "update", "delete", "deletecollection"} {
			t.Run(verb, func(t *testing.T) {
				decision, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), verb))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Equal(t, "global dashboard variables feature is not enabled", reason)
			})
		}
	})

	t.Run("falls through to the service authorizer for variables when enabled", func(t *testing.T) {
		setGlobalVariablesToggle(t, true)
		// The service authorizer rejects a request with no identity in context and
		// surfaces a non-nil error; the variable gate never returns an error, so a
		// "no identity" error proves the request fell through rather than being
		// short-circuited by the feature gate.
		_, _, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), "get"))
		require.ErrorContains(t, err, "no identity found")
	})

	t.Run("does not gate other resources on the global variables flag", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		// Dashboards must reach the service authorizer regardless of the global
		// variables flag being off.
		_, _, err := authz.Authorize(ctx, authzAttributes(dashv0.DashboardResourceInfo.GetName(), "get"))
		require.ErrorContains(t, err, "no identity found")
	})
}
