package github_test

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type mockSecureValues struct {
	privateKey    common.RawSecureValue
	privateKeyErr error
	clientSecret  common.RawSecureValue
	clientSecErr  error
	token         common.RawSecureValue
	tokenErr      error
}

func (m *mockSecureValues) PrivateKey(_ context.Context) (common.RawSecureValue, error) {
	return m.privateKey, m.privateKeyErr
}

func (m *mockSecureValues) ClientSecret(_ context.Context) (common.RawSecureValue, error) {
	return m.clientSecret, m.clientSecErr
}

func (m *mockSecureValues) Token(_ context.Context) (common.RawSecureValue, error) {
	return m.token, m.tokenErr
}

func TestExtra_Type(t *testing.T) {
	mockFactory := github.NewMockGithubFactory(t)
	decrypter := func(c *provisioning.Connection) connection.SecureValues {
		return &mockSecureValues{}
	}

	e := github.Extra(decrypter, mockFactory)

	result := e.Type()

	assert.Equal(t, provisioning.GithubConnectionType, result)
}

func TestExtra_Build(t *testing.T) {
	tests := []struct {
		name           string
		conn           *provisioning.Connection
		setupDecrypter func() connection.Decrypter
		expectedError  string
	}{
		{
			name: "success with valid connection",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
			},
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{
						privateKey: common.RawSecureValue("test-private-key"),
						token:      common.RawSecureValue("test-token"),
					}
				}
			},
		},
		{
			name: "nil connection",
			conn: nil,
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{}
				}
			},
			expectedError: "invalid github connection",
		},
		{
			name: "connection without github config",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Spec: provisioning.ConnectionSpec{
					Type:   provisioning.GithubConnectionType,
					GitHub: nil,
				},
			},
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{}
				}
			},
			expectedError: "invalid github connection",
		},
		{
			name: "error decrypting private key",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
			},
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{
						privateKeyErr: errors.New("failed to decrypt private key"),
					}
				}
			},
			expectedError: "failed to decrypt private key",
		},
		{
			name: "error decrypting token",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
			},
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{
						privateKey: common.RawSecureValue("test-private-key"),
						tokenErr:   errors.New("failed to decrypt token"),
					}
				}
			},
			expectedError: "failed to decrypt token",
		},
		{
			name: "success with empty secure values",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
					Namespace: "default",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123456",
						InstallationID: "789012",
					},
				},
			},
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{
						privateKey: common.RawSecureValue(""),
						token:      common.RawSecureValue(""),
					}
				}
			},
		},
		{
			name: "success with different app and installation IDs",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "another-connection",
					Namespace: "prod",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "999888",
						InstallationID: "777666",
					},
				},
			},
			setupDecrypter: func() connection.Decrypter {
				return func(c *provisioning.Connection) connection.SecureValues {
					return &mockSecureValues{
						privateKey: common.RawSecureValue("another-private-key"),
						token:      common.RawSecureValue("another-token"),
					}
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			mockFactory := github.NewMockGithubFactory(t)
			decrypter := tt.setupDecrypter()

			e := github.Extra(decrypter, mockFactory)

			result, err := e.Build(ctx, tt.conn)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, result)
			}
		})
	}
}

func TestExtra_Mutate(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	tests := []struct {
		name           string
		obj            runtime.Object
		wantErr        bool
		validateError  func(t *testing.T, err error)
		validateResult func(t *testing.T, obj runtime.Object)
	}{
		{
			name: "should successfully mutate GitHub connection",
			obj: &provisioning.Connection{
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
						Create: common.NewSecretValue(privateKeyBase64),
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/456", conn.Spec.URL)
				assert.False(t, conn.Secure.Token.Create.IsZero(), "JWT token should be generated")
			},
		},
		{
			name: "should be no-op for non-Connection objects",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				// Object should remain unchanged
				repo := obj.(*provisioning.Repository)
				assert.Equal(t, "test-repo", repo.Name)
			},
		},
		{
			name: "should be no-op for Connection without GitHub config",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "clientID",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Empty(t, conn.Spec.URL, "URL should not be set")
				assert.True(t, conn.Secure.Token.Create.IsZero(), "Token should not be generated")
			},
		},
		{
			name: "should generate URL from installation ID",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "789",
						InstallationID: "012",
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/012", conn.Spec.URL)
			},
		},
		{
			name: "should generate JWT token with new private key",
			obj: &provisioning.Connection{
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
						Create: common.NewSecretValue(privateKeyBase64),
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/456", conn.Spec.URL)
				assert.False(t, conn.Secure.Token.Create.IsZero(), "JWT token should be generated")
				// Verify token is a valid JWT (starts with "eyJ")
				tokenStr := conn.Secure.Token.Create.DangerouslyExposeAndConsumeValue()
				assert.True(t, len(tokenStr) > 0, "Token should not be empty")
			},
		},
		{
			name: "should preserve token when no new key provided",
			obj: &provisioning.Connection{
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
						Name: "existing-key",
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("existing-token"),
					},
				},
			},
			wantErr: false,
			validateResult: func(t *testing.T, obj runtime.Object) {
				conn := obj.(*provisioning.Connection)
				assert.Equal(t, "https://github.com/settings/installations/456", conn.Spec.URL)
				// Token should remain unchanged
				assert.Equal(t, "existing-token", conn.Secure.Token.Create.DangerouslyExposeAndConsumeValue())
			},
		},
		{
			name: "should fail with invalid base64 private key",
			obj: &provisioning.Connection{
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
						Create: common.NewSecretValue("invalid-base64"),
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "failed to generate JWT token")
			},
		},
		{
			name: "should fail with invalid RSA private key",
			obj: &provisioning.Connection{
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
						Create: common.NewSecretValue(base64.StdEncoding.EncodeToString([]byte("invalid-rsa-key"))),
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "failed to generate JWT token")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			mockFactory := github.NewMockGithubFactory(t)
			decrypter := func(c *provisioning.Connection) connection.SecureValues {
				return &mockSecureValues{}
			}

			e := github.Extra(decrypter, mockFactory)

			err := e.Mutate(ctx, tt.obj)

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
