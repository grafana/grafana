package connection_test

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestValidateConnection(t *testing.T) {
	tests := []struct {
		name       string
		connection *provisioning.Connection
		wantErr    bool
		errMsg     string
	}{
		{
			name: "empty type returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec:       provisioning.ConnectionSpec{},
			},
			wantErr: true,
			errMsg:  "spec.type",
		},
		{
			name: "invalid type returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: "invalid",
				},
			},
			wantErr: true,
			errMsg:  "spec.type",
		},
		{
			name: "github type without github config returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			wantErr: true,
			errMsg:  "spec.github",
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
			wantErr: true,
			errMsg:  "secure.privateKey",
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
					PrivateKey: common.InlineSecureValue{
						Name: "test-private-key",
					},
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.clientSecret",
		},
		{
			name: "github type with github config is valid",
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
						Name: "test-private-key",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "bitbucket type without bitbucket config returns error",
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
			name: "bitbucket type without client secret returns error",
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
			name: "bitbucket type with private key returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.BitbucketConnectionType,
					Bitbucket: &provisioning.BitbucketConnectionConfig{
						ClientID: "client-123",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "test-private-key",
					},
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.privateKey",
		},
		{
			name: "bitbucket type with bitbucket config is valid",
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
		{
			name: "gitlab type without gitlab config returns error",
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
			name: "gitlab type without client secret returns error",
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
			name: "gitlab type with private key returns error",
			connection: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
					Gitlab: &provisioning.GitlabConnectionConfig{
						ClientID: "client-456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Name: "test-private-key",
					},
					ClientSecret: common.InlineSecureValue{
						Name: "test-client-secret",
					},
				},
			},
			wantErr: true,
			errMsg:  "secure.privateKey",
		},
		{
			name: "gitlab type with gitlab config is valid",
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
			err := connection.ValidateConnection(tt.connection)
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
