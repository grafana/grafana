package connection_test

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestValidateGithubConnection(t *testing.T) {
	tests := []struct {
		name           string
		connection     *provisioning.Connection
		setupMock      func(*connection.MockGithubFactory)
		wantErr        bool
		errMsgContains []string
	}{
		{
			name: "empty type returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec:       provisioning.ConnectionSpec{},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.type"},
		},
		{
			name: "invalid type returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: "invalid",
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.type"},
		},
		{
			name: "github type without github config returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.github"},
		},
		{
			name: "github type without private key returns error",
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
			wantErr:        true,
			errMsgContains: []string{"secure.privateKey"},
		},
		{
			name: "github type without token returns error",
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
						Create: common.NewSecretValue("test-private-key"),
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"secure.token"},
		},
		{
			name: "github type with client secret returns error",
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
					ClientSecret: common.InlineSecureValue{
						Create: common.NewSecretValue("test-client-secret"),
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"secure.clientSecret"},
		},
		{
			name: "github type without appID returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue("test-private-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.github.appID"},
		},
		{
			name: "github type without installationID returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID: "123",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "test-private-key",
					},
					Token: common.InlineSecureValue{
						Name: "test-token",
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.github.installationID"},
		},
		{
			name: "github type with valid config without private key create is valid",
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
						Create: common.NewSecretValue("test-private-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			wantErr: false,
			setupMock: func(mockFactory *connection.MockGithubFactory) {
				mockClient := github.NewMockClient(t)

				mockFactory.EXPECT().New(mock.Anything, common.NewSecretValue("")).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything, "test-token").Return(github.App{ID: 123, Slug: "test-app"}, nil)
				mockClient.EXPECT().GetAppInstallation(mock.Anything, "test-token", "456").Return(github.AppInstallation{ID: 456}, nil)
			},
		},
		{
			name: "problem getting app returns error",
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
						Create: common.NewSecretValue("test-private-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.token", "[REDACTED]"},
			setupMock: func(mockFactory *connection.MockGithubFactory) {
				mockClient := github.NewMockClient(t)

				mockFactory.EXPECT().New(mock.Anything, common.NewSecretValue("")).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything, "test-token").Return(github.App{}, assert.AnError)
			},
		},
		{
			name: "mismatched app ID returns error",
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
						Create: common.NewSecretValue("test-private-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.appID"},
			setupMock: func(mockFactory *connection.MockGithubFactory) {
				mockClient := github.NewMockClient(t)

				mockFactory.EXPECT().New(mock.Anything, common.NewSecretValue("")).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything, "test-token").Return(github.App{ID: 444, Slug: "test-app"}, nil)
			},
		},
		{
			name: "problem when getting installation returns error",
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
						Create: common.NewSecretValue("test-private-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			wantErr:        true,
			errMsgContains: []string{"spec.token", "[REDACTED]"},
			setupMock: func(mockFactory *connection.MockGithubFactory) {
				mockClient := github.NewMockClient(t)

				mockFactory.EXPECT().New(mock.Anything, common.NewSecretValue("")).Return(mockClient)
				mockClient.EXPECT().GetApp(mock.Anything, "test-token").Return(github.App{ID: 123, Slug: "test-app"}, nil)
				mockClient.EXPECT().GetAppInstallation(mock.Anything, "test-token", "456").Return(github.AppInstallation{}, assert.AnError)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghFactory := connection.NewMockGithubFactory(t)
			if tt.setupMock != nil {
				tt.setupMock(ghFactory)
			}

			validator := connection.NewValidator(ghFactory)
			err := validator.ValidateConnection(context.Background(), tt.connection)
			if tt.wantErr {
				assert.Error(t, err)
				for _, msg := range tt.errMsgContains {
					assert.Contains(t, err.Error(), msg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateBitbucketConnection(t *testing.T) {
	tests := []struct {
		name       string
		connection *provisioning.Connection
		wantErr    bool
		errMsg     string
	}{
		{
			name: "bitbucket connection without bitbucket config",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.BitbucketConnectionType,
				},
			},
			wantErr: true,
			errMsg:  "spec.bitbucket",
		},
		{
			name: "bitbucket connection without client secret",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.BitbucketConnectionType,
					Bitbucket: &provisioning.BitbucketConnectionConfig{
						ClientID: "client-123",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.clientSecret",
		},
		{
			name: "bitbucket connection with forbidden private key",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.BitbucketConnectionType,
					Bitbucket: &provisioning.BitbucketConnectionConfig{
						ClientID: "client-123",
					},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
					PrivateKey: common.InlineSecureValue{
						Name: "test-private-key",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.privateKey",
		},
		{
			name: "valid bitbucket connection",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.BitbucketConnectionType,
					Bitbucket: &provisioning.BitbucketConnectionConfig{
						ClientID: "client-123",
					},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghFactory := connection.NewMockGithubFactory(t)
			validator := connection.NewValidator(ghFactory)
			err := validator.ValidateConnection(context.Background(), tt.connection)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateGitlabConnection(t *testing.T) {
	tests := []struct {
		name       string
		connection *provisioning.Connection
		wantErr    bool
		errMsg     string
	}{
		{
			name: "gitlab connection without gitlab config",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
				},
			},
			wantErr: true,
			errMsg:  "spec.gitlab",
		},
		{
			name: "gitlab connection without client secret",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "client-456",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.clientSecret",
		},
		{
			name: "gitlab connection with forbidden private key",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "client-456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
					PrivateKey: common.InlineSecureValue{
						Name: "test-private-key",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.privateKey",
		},
		{
			name: "valid gitlab connection",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "client-456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghFactory := connection.NewMockGithubFactory(t)
			validator := connection.NewValidator(ghFactory)
			err := validator.ValidateConnection(context.Background(), tt.connection)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
