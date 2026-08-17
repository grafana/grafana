package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

func TestValidateOAuthConnectionsEnabled(t *testing.T) {
	oauthConnection := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{
			OAuth: &provisioning.ConnectionOAuthConfig{},
		},
	}
	oauthConnection.Name = "oauth-connection"

	t.Run("rejects OAuth connections when disabled", func(t *testing.T) {
		builder := &APIBuilder{
			oauthConnectionsEnabled: func(context.Context) bool { return false },
		}

		err := builder.validateOAuthConnectionsEnabled(t.Context(), oauthConnection)

		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err))
		require.ErrorContains(t, err, "provisioning.oauthConnections")
	})

	t.Run("allows OAuth connections when enabled", func(t *testing.T) {
		builder := &APIBuilder{
			oauthConnectionsEnabled: func(context.Context) bool { return true },
		}

		require.NoError(t, builder.validateOAuthConnectionsEnabled(t.Context(), oauthConnection))
	})

	t.Run("allows non-OAuth connections when disabled", func(t *testing.T) {
		builder := &APIBuilder{
			oauthConnectionsEnabled: func(context.Context) bool { return false },
		}
		githubConnection := &provisioning.Connection{
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
			},
		}

		require.NoError(t, builder.validateOAuthConnectionsEnabled(t.Context(), githubConnection))
	})
}

func TestOAuthFeatureGatedConnectionFactory(t *testing.T) {
	oauthConnection := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{
			OAuth: &provisioning.ConnectionOAuthConfig{},
		},
	}
	oauthConnection.Name = "oauth-connection"

	t.Run("does not build OAuth connections when disabled", func(t *testing.T) {
		factory := connection.NewMockFactory(t)
		gated := &oauthFeatureGatedConnectionFactory{
			Factory: factory,
			enabled: func(context.Context) bool { return false },
		}

		built, err := gated.Build(t.Context(), oauthConnection)

		require.Nil(t, built)
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("does not delegate validation for OAuth connections when disabled", func(t *testing.T) {
		factory := connection.NewMockFactory(t)
		gated := &oauthFeatureGatedConnectionFactory{
			Factory: factory,
			enabled: func(context.Context) bool { return false },
		}

		errs := gated.Validate(t.Context(), oauthConnection)

		require.Len(t, errs, 1)
		require.Equal(t, "spec.oauth", errs[0].Field)
		require.Contains(t, errs[0].Detail, "provisioning.oauthConnections")
	})
}
