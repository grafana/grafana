package team

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestIsK8sRedirectEnabledForNamespace(t *testing.T) {
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	})

	testCases := []struct {
		name          string
		teamsAPI      bool
		teamsRedirect bool
		usersAPI      bool
		want          bool
	}{
		{
			name:          "enabled when Teams API, Teams redirect, and Users API are enabled",
			teamsAPI:      true,
			teamsRedirect: true,
			usersAPI:      true,
			want:          true,
		},
		{
			name:          "disabled when Teams API is disabled",
			teamsAPI:      false,
			teamsRedirect: true,
			usersAPI:      true,
			want:          false,
		},
		{
			name:          "disabled when Teams redirect is disabled",
			teamsAPI:      true,
			teamsRedirect: false,
			usersAPI:      true,
			want:          false,
		},
		{
			name:          "disabled when Users API is disabled",
			teamsAPI:      true,
			teamsRedirect: true,
			usersAPI:      false,
			want:          false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagKubernetesTeamsApi:      newBooleanFlag(featuremgmt.FlagKubernetesTeamsApi, tc.teamsAPI),
				featuremgmt.FlagKubernetesTeamsRedirect: newBooleanFlag(featuremgmt.FlagKubernetesTeamsRedirect, tc.teamsRedirect),
				featuremgmt.FlagKubernetesUsersApi:      newBooleanFlag(featuremgmt.FlagKubernetesUsersApi, tc.usersAPI),
			})
			require.NoError(t, openfeature.SetProviderAndWait(provider))

			got, err := IsK8sRedirectEnabledForNamespace(t.Context(), openfeature.NewDefaultClient(), "stacks-123")
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}

	t.Run("disabled without an OpenFeature client", func(t *testing.T) {
		got, err := IsK8sRedirectEnabledForNamespace(t.Context(), nil, "stacks-123")
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("rejects an empty namespace", func(t *testing.T) {
		got, err := IsK8sRedirectEnabledForNamespace(t.Context(), openfeature.NewDefaultClient(), "")
		require.EqualError(t, err, "namespace is required to evaluate the Team k8s redirect")
		require.False(t, got)
	})

	t.Run("evaluates flags for the requested namespace", func(t *testing.T) {
		namespaceEvaluator := func(flag memprovider.InMemoryFlag, flatCtx openfeature.FlattenedContext) (any, openfeature.ProviderResolutionDetail) {
			enabled := flatCtx[openfeature.TargetingKey] == "stacks-123" && flatCtx["namespace"] == "stacks-123"
			return enabled, openfeature.ProviderResolutionDetail{}
		}
		provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagKubernetesTeamsApi: {
				Key:              featuremgmt.FlagKubernetesTeamsApi,
				DefaultVariant:   "default",
				Variants:         map[string]any{"default": false},
				ContextEvaluator: &namespaceEvaluator,
			},
			featuremgmt.FlagKubernetesTeamsRedirect: newBooleanFlag(featuremgmt.FlagKubernetesTeamsRedirect, true),
			featuremgmt.FlagKubernetesUsersApi:      newBooleanFlag(featuremgmt.FlagKubernetesUsersApi, true),
		})
		require.NoError(t, openfeature.SetProviderAndWait(provider))

		ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("stacks-old", map[string]any{
			"namespace": "stacks-old",
		}))
		got, err := IsK8sRedirectEnabledForNamespace(ctx, openfeature.NewDefaultClient(), "stacks-123")
		require.NoError(t, err)
		require.True(t, got)
	})
}

func newBooleanFlag(name string, value bool) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: "default",
		Variants:       map[string]any{"default": value},
	}
}
