package github_test

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestValidate(t *testing.T) {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))
	invalidBase64 := base64.StdEncoding.EncodeToString([]byte("somePrivateKey"))

	tests := []struct {
		name          string
		obj           runtime.Object
		expectedError bool
		errorContains []string
	}{
		{
			name: "non-connection object",
			obj:  &runtime.Unknown{},
		},
		{
			name: "non-github connection type",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
				},
			},
		},
		{
			name: "github connection type without github config",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type:   provisioning.GithubConnectionType,
					GitHub: nil,
				},
			},
			expectedError: true,
			errorContains: []string{"github info must be specified"},
		},
		{
			name: "missing private key",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"privateKey"},
		},
		{
			name: "private key invalid base64",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: "invalid",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"privateKey"},
		},
		{
			name: "privateKey invalid RSA private key",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue(invalidBase64),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"privateKey"},
		},
		{
			name: "valid connection without token (controller will generate)",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
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
			expectedError: false,
		},
		{
			name: "forbidden client secret",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue("test-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
					ClientSecret: common.InlineSecureValue{
						Create: common.NewSecretValue("test-secret"),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"clientSecret is forbidden"},
		},
		{
			name: "missing app ID",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue("test-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"appID"},
		},
		{
			name: "missing installation ID",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID: "123",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue("test-key"),
					},
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"installationID"},
		},
		{
			name: "non-numeric app ID",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "abc123",
						InstallationID: "456",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue(privateKeyBase64),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"appID must be a numeric value"},
		},
		{
			name: "non-numeric installation ID",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "123",
						InstallationID: "xyz789",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue(privateKeyBase64),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"installationID must be a numeric value"},
		},
		{
			name: "both app ID and installation ID non-numeric",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
					GitHub: &provisioning.GitHubConnectionConfig{
						AppID:          "app-id",
						InstallationID: "install-id",
					},
				},
				Secure: provisioning.ConnectionSecure{
					PrivateKey: common.InlineSecureValue{
						Create: common.NewSecretValue(privateKeyBase64),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"appID must be a numeric value", "installationID must be a numeric value"},
		},
		{
			name: "valid github connection",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-conn",
				},
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
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := github.Validate(context.Background(), tt.obj)
			if tt.expectedError {
				assert.NotEmpty(t, list)
				if len(tt.errorContains) > 0 {
					errStr := list.ToAggregate().Error()
					for _, contains := range tt.errorContains {
						assert.Contains(t, errStr, contains)
					}
				}
			} else {
				assert.Empty(t, list)
			}
		})
	}
}
