package github_test

import (
	"context"
	"encoding/base64"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMutate(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	tests := []struct {
		name           string
		obj            runtime.Object
		wantErr        bool
		validateError  func(t *testing.T, err error)
		validateResult func(t *testing.T, obj runtime.Object)
	}{
		{
			name: "should set URL for GitHub connection",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/789012", conn.Spec.URL)
				assert.True(t, conn.Secure.Token.Create.IsZero(), "Token should not be generated without private key")
			},
		},
		{
			name: "should not generate JWT token when private key is provided",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue(privateKeyBase64),
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/789012", conn.Spec.URL)
				assert.True(t, conn.Secure.Token.Create.IsZero(), "Token should not be generated in mutator")
			},
		},
		{
			name: "should not modify token when connection has existing token",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "existing-key-reference",
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("existing-token"),
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/789012", conn.Spec.URL)
				// Token should remain unchanged
				assert.Equal(t, "existing-token", conn.Secure.Token.Create.DangerouslyExposeAndConsumeValue())
			},
		},
		{
			name: "should be no-op for non-Connection objects",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				repo := obj.(*provisioning.Repository)
				assert.Equal(t, "test-repo", repo.Name)
			},
		},
		{
			name: "should be no-op for non-GitHub connection type",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "client-id",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Empty(t, conn.Spec.URL, "URL should not be set for non-GitHub connection")
			},
		},
		{
			name: "should be no-op when GitHub config is nil",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type:   provisioning.GithubConnectionType,
					GitHub: nil,
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Empty(t, conn.Spec.URL, "URL should not be set when GitHub config is nil")
			},
		},
		{
			name: "should handle different installation IDs correctly",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "999888",
						InstallationID: "777666",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/777666", conn.Spec.URL)
			},
		},
		{
			name: "should preserve URL when mutating again",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					URL:  "https://github.com/settings/installations/000000",
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				// URL should be overwritten with the correct installation ID
				assert.Equal(t, "https://github.com/settings/installations/789012", conn.Spec.URL)
			},
		},
		{
			name: "should handle empty installation ID",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/", conn.Spec.URL)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			err := github.Mutate(ctx, tt.obj)

			if tt.wantErr {
				require.Error(t, err)
				if tt.validateError != nil {
					tt.validateError(t, err)
				}
			} else {
				require.NoError(t, err)
				if tt.validateResult != nil {
					tt.validateResult(t, tt.obj)
				}
			}
		})
	}
}

func TestMutate_MultipleCallsIdempotent(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))
	ctx := context.Background()

	conn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
		Spec: provisioning.ConnectionSpec{
			Type: provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "789012",
			},
		},
		Secure: provisioning.ConnectionSecure{
			PrivateKey: common.InlineSecureValue{
				Create: common.NewSecretValue(privateKeyBase64),
			},
		},
	}

	// First mutation
	err := github.Mutate(ctx, conn)
	require.NoError(t, err)

	firstURL := conn.Spec.URL
	assert.Equal(t, "https://github.com/settings/installations/789012", firstURL)
	assert.True(t, conn.Secure.Token.Create.IsZero(), "Token should not be generated by mutator")

	// Set a token (simulating controller generating it)
	conn.Secure.Token.Create = common.NewSecretValue("controller-generated-token")

	// Second mutation - should not modify token
	err = github.Mutate(ctx, conn)
	require.NoError(t, err)

	secondURL := conn.Spec.URL
	secondToken := conn.Secure.Token.Create.DangerouslyExposeAndConsumeValue()

	assert.Equal(t, firstURL, secondURL, "URL should remain the same")
	assert.Equal(t, "controller-generated-token", secondToken, "Token should not be modified")
}
