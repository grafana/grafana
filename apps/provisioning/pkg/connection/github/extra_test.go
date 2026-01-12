package github_test

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestExtra_Type(t *testing.T) {
	t.Run("should return GithubConnectionType", func(t *testing.T) {
		mockFactory := github.NewMockGithubFactory(t)
		e := github.Extra(mockFactory)
		result := e.Type()
		assert.Equal(t, provisioning.GithubConnectionType, result)
	})
}

func TestExtra_Build(t *testing.T) {
	t.Run("should successfully build connection", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Create: common.NewSecretValue("test-private-key"),
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)

		e := github.Extra(mockFactory)

		result, err := e.Build(ctx, conn)
		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("should handle different connection configurations", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "another-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "789",
					InstallationID: "101112",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Name: "existing-private-key",
				},
				Token: common.InlineSecureValue{
					Name: "existing-token",
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)

		e := github.Extra(mockFactory)

		result, err := e.Build(ctx, conn)
		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("should build connection with background context", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)
		e := github.Extra(mockFactory)
		result, err := e.Build(ctx, conn)
		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("should always pass empty token to factory.New", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("some-token"),
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)
		e := github.Extra(mockFactory)
		result, err := e.Build(ctx, conn)
		require.NoError(t, err)
		require.NotNil(t, result)
	})
}
