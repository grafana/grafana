package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestValidateOAuthConnectionsEnabled(t *testing.T) {
	oauthConnection := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{
			OAuth: &provisioning.ConnectionOAuthConfig{},
		},
	}
	oauthConnection.Name = "oauth-connection"

	t.Run("rejects OAuth connections when disabled", func(t *testing.T) {
		err := validateOAuthConnectionsEnabled(t.Context(), oauthConnection, func(context.Context) bool { return false })

		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err))
		require.ErrorContains(t, err, "provisioning.oauthConnections")
	})

	t.Run("allows OAuth connections when enabled", func(t *testing.T) {
		require.NoError(t, validateOAuthConnectionsEnabled(t.Context(), oauthConnection, func(context.Context) bool { return true }))
	})

	t.Run("allows non-OAuth connections when disabled", func(t *testing.T) {
		githubConnection := &provisioning.Connection{
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
			},
		}

		require.NoError(t, validateOAuthConnectionsEnabled(t.Context(), githubConnection, func(context.Context) bool { return false }))
	})
}
