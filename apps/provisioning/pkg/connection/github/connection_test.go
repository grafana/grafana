package github_test

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

//nolint:gosec // Test RSA private key (generated for testing purposes only)
const testPrivateKeyPEM = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAoInVbLY9io2Q/wHvUIXlEHg2Qyvd8eRzBAVEJ92DS6fx9H10
06V0VRm78S0MXyo6i+n8ZAbZ0/R+GWpP2Ephxm0Gs2zo+iO2mpB19xQFI4o6ZTOw
b2WyjSaa2Vr4oyDkqti6AvfjW4VUAu932e08GkgwmmQSHXj7FX2CMWjgUwTTcuaX
65SHNKLNYLUP0HTumLzoZeqDTdoMMpKNdgH9Avr4/8vkVJ0mD6rqvxnw3JHsseNO
WdQTxf2aApBNHIIKxWZ2i/ZmjLNey7kltgjEquGiBdJvip3fHhH5XHdkrXcjRtnw
OJDnDmi5lQwv5yUBOSkbvbXRv/L/m0YLoD/fbwIDAQABAoIBAFfl//hM8/cnuesV
+R1Con/ZAgTXQOdPqPXbmEyniVrkMqMmCdBUOBTcST4s5yg36+RtkeaGpb/ajyyF
PAB2AYDucwvMpudGpJWOYTiOOp4R8hU1LvZfXVrRd1lo6NgQi4NLtNUpOtACeVQ+
H4Yv0YemXQ47mnuOoRNMK/u3q5NoIdSahWptXBgUno8KklNpUrH3IYWaUxfBzDN3
2xsVRTn2SfTSyoDmTDdTgptJONmoK1/sV7UsgWksdFc6XyYhsFAZgOGEJrBABRvF
546dyQ0cWxuPyVXpM7CN3tqC5ssvLjElg3LicK1V6gnjpdRnnvX88d1Eh3Uc/9IM
OZInT2ECgYEA6W8sQXTWinyEwl8SDKKMbB2ApIghAcFgdRxprZE4WFxjsYNCNL70
dnSB7MRuzmxf5W77cV0N7JhH66N8HvY6Xq9olrpQ5dNttR4w8Pyv3wavDe8x7seL
5L2Xtbu7ihDr8Dk27MjiBSin3IxhBP5CJS910+pR6LrAWtEuU+FzFfECgYEAsA6y
qxHhCMXlTnauXhsnmPd1g61q7chW8kLQFYtHMLlQlgjHTW7irDZ9cPbPYDNjwRLO
7KLorcpv2NKe7rqq2ZyCm6hf1b9WnlQjo3dLpNWMu6fhy/smK8MgbRqcWpX+oTKF
79mK6hbY7o6eBzsQHBl7Z+LBNuwYmp9qOodPa18CgYEArv6ipKdcNhFGzRfMRiCN
OHederp6VACNuP2F05IsNUF9kxOdTEFirnKE++P+VU01TqA2azOhPp6iO+ohIGzi
MR06QNSH1OL9OWvasK4dggpWrRGF00VQgDgJRTnpS4WH+lxJ6pRlrAxgWpv6F24s
VAgSQr1Ejj2B+hMasdMvHWECgYBJ4uE4yhgXBnZlp4kmFV9Y4wF+cZkekaVrpn6N
jBYkbKFVVfnOlWqru3KJpgsB5I9IyAvvY68iwIKQDFSG+/AXw4dMrC0MF3DSoZ0T
TU2Br92QI7SvVod+djV1lGVp3ukt3XY4YqPZ+hywgUnw3uiz4j3YK2HLGup4ec6r
IX5DIQKBgHRLzvT3zqtlR1Oh0vv098clLwt+pGzXOxzJpxioOa5UqK13xIpFXbcg
iWUVh5YXCcuqaICUv4RLIEac5xQitk9Is/9IhP0NJ/81rHniosvdSpCeFXzxTImS
B8Uc0WUgheB4+yVKGnYpYaSOgFFI5+1BYUva/wDHLy2pWHz39Usb
-----END RSA PRIVATE KEY-----`

func TestConnection_Mutate(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	tests := []struct {
		name           string
		connection     *provisioning.Connection
		secrets        github.ConnectionSecrets
		wantErr        bool
		validateError  func(t *testing.T, err error)
		validateResult func(t *testing.T, connection *provisioning.Connection)
	}{
		{
			name: "should add URL to Github connection",
			connection: &provisioning.Connection{
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
			secrets: github.ConnectionSecrets{
				PrivateKey: common.NewSecretValue(privateKeyBase64),
			},
			wantErr: false,
			validateResult: func(t *testing.T, connection *provisioning.Connection) {
				assert.Equal(t, "https://github.com/settings/installations/456", connection.Spec.URL)
			},
		},
		{
			name: "should generate JWT token when private key is provided",
			connection: &provisioning.Connection{
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
			secrets: github.ConnectionSecrets{
				PrivateKey: common.NewSecretValue(privateKeyBase64),
			},
			wantErr: false,
			validateResult: func(t *testing.T, connection *provisioning.Connection) {
				assert.Equal(t, "https://github.com/settings/installations/456", connection.Spec.URL)
				assert.False(t, connection.Secure.Token.Create.IsZero(), "JWT token should be generated")
			},
		},
		{
			name: "should not generate JWT token when no new private key is provided",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection", Generation: 1},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						// The private key is already in the stoere
						Name: "somePrivateKey",
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("someToken"),
					},
				},
			},
			secrets: github.ConnectionSecrets{
				PrivateKey: common.NewSecretValue(privateKeyBase64),
				Token:      common.NewSecretValue("someToken"),
			},
			wantErr: false,
			validateResult: func(t *testing.T, connection *provisioning.Connection) {
				assert.Equal(t, "https://github.com/settings/installations/456", connection.Spec.URL)
				assert.False(t, connection.Secure.Token.Create.IsZero(), "JWT token should be generated")
				assert.Equal(t, "someToken", connection.Secure.Token.Create.DangerouslyExposeAndConsumeValue())
			},
		},
		{
			name: "should do nothing when GitHub config is nil",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "clientID",
					},
				},
			},
			secrets: github.ConnectionSecrets{},
			wantErr: false,
		},
		{
			name: "should fail when private key is not base64",
			connection: &provisioning.Connection{
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
						Create: common.NewSecretValue("invalid-key"),
					},
				},
			},
			secrets: github.ConnectionSecrets{
				PrivateKey: "invalid-key",
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "failed to generate JWT token")
				assert.Contains(t, err.Error(), "failed to decode base64 private key")
			},
		},
		{
			name: "should fail when private key is invalid",
			connection: &provisioning.Connection{
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
						Create: common.NewSecretValue(base64.StdEncoding.EncodeToString([]byte("invalid-key"))),
					},
				},
			},
			secrets: github.ConnectionSecrets{},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "failed to generate JWT token")
				assert.Contains(t, err.Error(), "failed to parse private key")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := github.Mutate(context.Background(), tt.connection)

			if tt.wantErr {
				require.Error(t, err)
				if tt.validateError != nil {
					tt.validateError(t, err)
				}
			} else {
				require.NoError(t, err)
				if tt.validateResult != nil {
					tt.validateResult(t, tt.connection)
				}
			}
		})
	}
}

func TestConnection_GenerateRepositoryToken(t *testing.T) {
	tests := []struct {
		name          string
		connection    *provisioning.Connection
		repo          *provisioning.Repository
		setupMock     func(*github.MockGithubFactory)
		expectedToken common.RawSecureValue
		expectedError string
	}{
		{
			name: "success",
			connection: &provisioning.Connection{
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
						Create: common.RawSecureValue("jwt-token"),
					},
				},
			},
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test-owner/test-repo",
					},
				},
			},
			setupMock: func(mockFactory *github.MockGithubFactory) {
				mockClient := github.NewMockClient(t)
				mockFactory.EXPECT().New(mock.Anything, common.RawSecureValue("jwt-token")).Return(mockClient)
				mockClient.EXPECT().CreateInstallationAccessToken(mock.Anything, "456", "test-repo").
					Return(github.InstallationToken{Token: "ghs_repository_token_123", ExpiresAt: "2024-01-01T00:00:00Z"}, nil)
			},
			expectedToken: common.RawSecureValue("ghs_repository_token_123"),
		},
		{
			name: "nil repository returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			},
			repo:          nil,
			expectedError: "a repository is required to generate a token",
		},
		{
			name: "connection without GitHub config returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "clientID",
					},
				},
			},
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test-owner/test-repo",
					},
				},
			},
			expectedError: "connection is not a GitHub connection",
		},
		{
			name: "repository without GitHub config returns error",
			connection: &provisioning.Connection{
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
						Create: common.RawSecureValue("jwt-token"),
					},
				},
			},
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.GitHubRepositoryType,
					GitHub: nil,
				},
			},
			expectedError: "repository is not a GitHub repo",
		},
		{
			name: "invalid repository URL returns error",
			connection: &provisioning.Connection{
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
						Create: common.RawSecureValue("jwt-token"),
					},
				},
			},
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "invalid-url",
					},
				},
			},
			expectedError: "failed to parse repo URL",
		},
		{
			name: "GitHub API error",
			connection: &provisioning.Connection{
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
						Create: common.RawSecureValue("jwt-token"),
					},
				},
			},
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test-owner/test-repo",
					},
				},
			},
			setupMock: func(mockFactory *github.MockGithubFactory) {
				mockClient := github.NewMockClient(t)
				mockFactory.EXPECT().New(mock.Anything, common.RawSecureValue("jwt-token")).Return(mockClient)
				mockClient.EXPECT().CreateInstallationAccessToken(mock.Anything, "456", "test-repo").
					Return(github.InstallationToken{}, errors.New("API rate limit exceeded"))
			},
			expectedError: "failed to create installation access token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := github.NewMockGithubFactory(t)
			if tt.setupMock != nil {
				tt.setupMock(mockFactory)
			}

			conn := github.NewConnection(tt.connection, mockFactory, github.ConnectionSecrets{
				Token:      tt.connection.Secure.Token.Create,
				PrivateKey: tt.connection.Secure.PrivateKey.Create,
			})
			token, err := conn.GenerateRepositoryToken(context.Background(), tt.repo)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedToken, token)
			}
		})
	}
}
