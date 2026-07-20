package team

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestIsK8sRedirectEnabled(t *testing.T) {
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

			require.Equal(t, tc.want, IsK8sRedirectEnabled(t.Context(), openfeature.NewDefaultClient()))
		})
	}

	t.Run("disabled without an OpenFeature client", func(t *testing.T) {
		require.False(t, IsK8sRedirectEnabled(t.Context(), nil))
	})
}

func newBooleanFlag(name string, value bool) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: "default",
		Variants:       map[string]any{"default": value},
	}
}
