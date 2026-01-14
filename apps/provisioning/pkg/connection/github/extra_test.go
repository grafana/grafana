package github_test

import (
	"context"
	"errors"
	"testing"

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
