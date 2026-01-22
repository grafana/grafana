package github_test

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
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

func TestConnection_Test(t *testing.T) {
	tests := []struct {
		name           string
		connection     *provisioning.Connection
		setupMock      func(*github.MockGithubFactory, *github.MockClient)
		expectedCode   int
		expectedErrors []provisioning.ErrorDetails
		expectSuccess  bool
	}{
		{
			name: "success - valid app and installation",
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
			setupMock: func(mockFactory *github.MockGithubFactory, mockClient *github.MockClient) {
				mockFactory.EXPECT().New(mock.Anything, mock.Anything).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything).Return(github.App{ID: 123, Slug: "test-app"}, nil)
				mockClient.EXPECT().GetAppInstallation(mock.Anything, "456").Return(github.AppInstallation{ID: 456, Enabled: true}, nil)
			},
			expectedCode:  http.StatusOK,
			expectSuccess: true,
		},
		{
			name: "failure - GetApp returns service unavailable",
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
			setupMock: func(mockFactory *github.MockGithubFactory, mockClient *github.MockClient) {
				mockFactory.EXPECT().New(mock.Anything, mock.Anything).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything).Return(github.App{}, github.ErrServiceUnavailable)
			},
			expectedCode:  http.StatusServiceUnavailable,
			expectSuccess: false,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.token",
					Detail: github.ErrServiceUnavailable.Error(),
				},
			},
		},
		{
			name: "failure - GetApp returns other error (invalid token)",
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
			setupMock: func(mockFactory *github.MockGithubFactory, mockClient *github.MockClient) {
				mockFactory.EXPECT().New(mock.Anything, mock.Anything).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything).Return(github.App{}, errors.New("unauthorized"))
			},
			expectedCode:  http.StatusBadRequest,
			expectSuccess: false,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.token",
					Detail: "invalid token",
				},
			},
		},
		{
			name: "failure - appID mismatch",
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
			setupMock: func(mockFactory *github.MockGithubFactory, mockClient *github.MockClient) {
				mockFactory.EXPECT().New(mock.Anything, mock.Anything).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything).Return(github.App{ID: 999, Slug: "wrong-app"}, nil)
			},
			expectedCode:  http.StatusBadRequest,
			expectSuccess: false,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.appID",
					Detail: "appID mismatch: expected 123, got 999",
				},
			},
		},
		{
			name: "failure - GetAppInstallation returns service unavailable",
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
			setupMock: func(mockFactory *github.MockGithubFactory, mockClient *github.MockClient) {
				mockFactory.EXPECT().New(mock.Anything, mock.Anything).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything).Return(github.App{ID: 123, Slug: "test-app"}, nil)
				mockClient.EXPECT().GetAppInstallation(mock.Anything, "456").Return(github.AppInstallation{}, github.ErrServiceUnavailable)
			},
			expectedCode:  http.StatusServiceUnavailable,
			expectSuccess: false,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.token",
					Detail: github.ErrServiceUnavailable.Error(),
				},
			},
		},
		{
			name: "failure - GetAppInstallation returns other error (invalid installation)",
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
			setupMock: func(mockFactory *github.MockGithubFactory, mockClient *github.MockClient) {
				mockFactory.EXPECT().New(mock.Anything, mock.Anything).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything).Return(github.App{ID: 123, Slug: "test-app"}, nil)
				mockClient.EXPECT().GetAppInstallation(mock.Anything, "456").Return(github.AppInstallation{}, errors.New("not found"))
			},
			expectedCode:  http.StatusBadRequest,
			expectSuccess: false,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.installationID",
					Detail: "invalid installation ID: 456",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := github.NewMockGithubFactory(t)
			mockClient := github.NewMockClient(t)
			if tt.setupMock != nil {
				tt.setupMock(mockFactory, mockClient)
			}

			conn := github.NewConnection(tt.connection, mockFactory, github.ConnectionSecrets{
				Token: common.RawSecureValue("test-token"),
			})
			result, err := conn.Test(context.Background())

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, tt.expectedCode, result.Code)
			assert.Equal(t, tt.expectSuccess, result.Success)
			if tt.expectedErrors != nil {
				assert.Equal(t, tt.expectedErrors, result.Errors)
			}
		})
	}
}

func TestConnection_TokenExpiration(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Generate a valid token using the existing function (expires in 10 minutes)
	validToken, err := github.GenerateJWTToken("123", common.RawSecureValue(privateKeyBase64))
	require.NoError(t, err)

	exp, err := getExpirationFromToken(validToken)
	require.NoError(t, err)
	require.False(t, exp.IsZero())

	tests := []struct {
		name          string
		secrets       github.ConnectionSecrets
		expectedError string
		expectTime    time.Time
	}{
		{
			name: "return correct expiration",
			secrets: github.ConnectionSecrets{
				Token:      validToken,
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			expectTime: exp,
		},
		{
			name: "invalid token format returns error",
			secrets: github.ConnectionSecrets{
				Token:      common.RawSecureValue("not-a-valid-jwt-token"),
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			expectedError: "failed to parse token",
		},
		{
			name: "invalid private key returns error",
			secrets: github.ConnectionSecrets{
				Token:      validToken,
				PrivateKey: common.RawSecureValue("not-base64"),
			},
			expectedError: "failed to decode base64 private key",
		},
		{
			name: "empty token returns error",
			secrets: github.ConnectionSecrets{
				Token:      common.RawSecureValue(""),
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			expectedError: "failed to parse token",
		},
		{
			name: "malformed private key PEM returns error",
			secrets: github.ConnectionSecrets{
				Token:      validToken,
				PrivateKey: common.RawSecureValue(base64.StdEncoding.EncodeToString([]byte("not-a-valid-pem"))),
			},
			expectedError: "failed to parse private key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := github.NewMockGithubFactory(t)
			connection := &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			}

			conn := github.NewConnection(connection, mockFactory, tt.secrets)
			exp, err := conn.TokenExpiration(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectTime, exp)
			}
		})
	}
}

func TestConnection_GenerateConnectionToken(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	tests := []struct {
		name          string
		connection    *provisioning.Connection
		secrets       github.ConnectionSecrets
		expectedError string
		validateToken func(t *testing.T, token common.RawSecureValue)
	}{
		{
			name: "success - generates valid JWT token",
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
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			validateToken: func(t *testing.T, token common.RawSecureValue) {
				// Verify token is not empty
				assert.NotEmpty(t, token)

				// Verify token is a valid JWT by parsing it
				privateKeyPEM, err := base64.StdEncoding.DecodeString(privateKeyBase64)
				require.NoError(t, err)
				key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
				require.NoError(t, err)

				parsedToken, err := jwt.Parse(string(token), func(_ *jwt.Token) (any, error) {
					return &key.PublicKey, nil
				}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
				require.NoError(t, err)
				assert.True(t, parsedToken.Valid)

				// Verify claims
				claims, ok := parsedToken.Claims.(jwt.MapClaims)
				require.True(t, ok)
				assert.Equal(t, "123", claims["iss"])
			},
		},
		{
			name: "success - generates different token each time",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "789",
						InstallationID: "456",
					},
				},
			},
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			validateToken: func(t *testing.T, token common.RawSecureValue) {
				// Generate a second token and verify they're different (due to different timestamps)
				time.Sleep(1 * time.Second) // Ensure different iat claim
				token2, err := github.GenerateJWTToken("789", common.RawSecureValue(privateKeyBase64))
				require.NoError(t, err)
				assert.NotEqual(t, token, token2, "tokens should differ due to timestamp")
			},
		},
		{
			name: "error - connection without GitHub config",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "clientID",
					},
				},
			},
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			expectedError: "connection is not a GitHub connection",
		},
		{
			name: "error - nil GitHub config",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type:   provisioning.GithubConnectionType,
					GitHub: nil,
				},
			},
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue(privateKeyBase64),
			},
			expectedError: "connection is not a GitHub connection",
		},
		{
			name: "error - invalid private key (not base64)",
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
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue("not-valid-base64!@#"),
			},
			expectedError: "failed to decode base64 private key",
		},
		{
			name: "error - invalid PEM format",
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
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue(base64.StdEncoding.EncodeToString([]byte("not-a-valid-pem-format"))),
			},
			expectedError: "failed to parse private key",
		},
		{
			name: "error - empty private key",
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
			secrets: github.ConnectionSecrets{
				PrivateKey: common.RawSecureValue(""),
			},
			expectedError: "failed to parse private key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := github.NewMockGithubFactory(t)

			conn := github.NewConnection(tt.connection, mockFactory, tt.secrets)
			token, err := conn.GenerateConnectionToken(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.NotEmpty(t, token)
				if tt.validateToken != nil {
					tt.validateToken(t, token)
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
		expectedToken *connection.ExpirableSecureValue
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
					Return(github.InstallationToken{
						Token:     "ghs_repository_token_123",
						ExpiresAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
					}, nil)
			},
			expectedToken: &connection.ExpirableSecureValue{
				Token:     common.RawSecureValue("ghs_repository_token_123"),
				ExpiresAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			},
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

func TestConnection_ListRepositories(t *testing.T) {
	t.Run("should list repositories successfully", func(t *testing.T) {
		c := &provisioning.Connection{
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
					Create: common.NewSecretValue("test-token"),
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)
		mockClient := github.NewMockClient(t)

		mockFactory.EXPECT().New(mock.Anything, common.RawSecureValue("test-token")).Return(mockClient)
		mockClient.EXPECT().ListInstallationRepositories(mock.Anything, "456").Return([]github.Repository{
			{Name: "repo1", Owner: "owner1", URL: "https://github.com/owner1/repo1"},
			{Name: "repo2", Owner: "owner2", URL: "https://github.com/owner2/repo2"},
		}, nil)

		conn := github.NewConnection(c, mockFactory, github.ConnectionSecrets{
			Token: common.RawSecureValue("test-token"),
		})
		repos, err := conn.ListRepositories(context.Background())

		require.NoError(t, err)
		require.Len(t, repos, 2)
		assert.Equal(t, "repo1", repos[0].Name)
		assert.Equal(t, "owner1", repos[0].Owner)
		assert.Equal(t, "https://github.com/owner1/repo1", repos[0].URL)
		assert.Equal(t, "repo2", repos[1].Name)
		assert.Equal(t, "owner2", repos[1].Owner)
		assert.Equal(t, "https://github.com/owner2/repo2", repos[1].URL)
	})

	t.Run("should return error when GitHub config is nil", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GitlabConnectionType,
			},
		}

		mockFactory := github.NewMockGithubFactory(t)
		conn := github.NewConnection(c, mockFactory, github.ConnectionSecrets{})
		_, err := conn.ListRepositories(context.Background())

		require.Error(t, err)
		assert.Contains(t, err.Error(), "github configuration is required")
	})

	t.Run("should return error when listing repositories fails", func(t *testing.T) {
		c := &provisioning.Connection{
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
					Create: common.NewSecretValue("test-token"),
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)
		mockClient := github.NewMockClient(t)

		mockFactory.EXPECT().New(mock.Anything, common.RawSecureValue("test-token")).Return(mockClient)
		mockClient.EXPECT().ListInstallationRepositories(mock.Anything, "456").Return(nil, assert.AnError)

		conn := github.NewConnection(c, mockFactory, github.ConnectionSecrets{
			Token: common.RawSecureValue("test-token"),
		})
		_, err := conn.ListRepositories(context.Background())

		require.Error(t, err)
		assert.Contains(t, err.Error(), "list installation repositories")
	})

	t.Run("should return empty list when no repositories", func(t *testing.T) {
		c := &provisioning.Connection{
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
					Create: common.NewSecretValue("test-token"),
				},
			},
		}

		mockFactory := github.NewMockGithubFactory(t)
		mockClient := github.NewMockClient(t)

		mockFactory.EXPECT().New(mock.Anything, common.RawSecureValue("test-token")).Return(mockClient)
		mockClient.EXPECT().ListInstallationRepositories(mock.Anything, "456").Return([]github.Repository{}, nil)

		conn := github.NewConnection(c, mockFactory, github.ConnectionSecrets{
			Token: common.RawSecureValue("test-token"),
		})
		repos, err := conn.ListRepositories(context.Background())

		require.NoError(t, err)
		require.Len(t, repos, 0)
	})
}

func getExpirationFromToken(token common.RawSecureValue) (time.Time, error) {
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	parsedToken, _, err := parser.ParseUnverified(string(token), &jwt.RegisteredClaims{})
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := parsedToken.Claims.(*jwt.RegisteredClaims)
	if !ok {
		return time.Time{}, fmt.Errorf("unexpected token claims")
	}

	return claims.ExpiresAt.Time, nil
}
