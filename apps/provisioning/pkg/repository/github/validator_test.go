package github

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/resource"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestValidate(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		allowInsecure bool
		expectedError bool
		errorContains []string
	}{
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
		},
		{
			name: "non-github repository type",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeLocal,
				},
			},
		},
		{
			name: "github repository type without github config",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.RepositorySpecTypeGithub,
					Github: nil,
				},
			},
			expectedError: true,
			errorContains: []string{"github config is required"},
		},
		{
			name: "missing URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"url"},
		},
		{
			name: "http URL with token is rejected by default",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Url:    "http://github.com/grafana/grafana",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: resource.InlineSecureValue{
						Create: resource.NewSecretValue("test-token"),
					},
				},
			},
			expectedError: true,
			errorContains: []string{"http:// is not allowed when a token is configured"},
		},
		{
			name: "http URL with token is allowed when insecure is permitted (local development)",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Url:    "http://github.com/grafana/grafana",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: resource.InlineSecureValue{
						Create: resource.NewSecretValue("test-token"),
					},
				},
			},
			allowInsecure: true,
		},
		{
			name: "http URL without token is allowed",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Url:    "http://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
		},
		{
			name: "valid github.com repository",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Url:    "https://github.com/grafana/grafana",
						Branch: "main",
						Path:   "grafana",
					},
				},
				Secure: provisioning.SecureValues{
					Token: resource.InlineSecureValue{
						Create: resource.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "webhookDisabled without spec.webhook is valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Url:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
					Webhook: &provisioning.RepositoryWebhookConfig{Disabled: true},
				},
			},
		},
		{
			name: "webhookDisabled with spec.webhook set is invalid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.RepositorySpecTypeGithub,
					Github: &provisioning.RepositoryGitHubRepositoryConfig{
						Url:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
					Webhook: &provisioning.RepositoryWebhookConfig{
						Disabled: true,
						BaseUrl:  "https://grafana.example.com",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"disabled", "cannot be true when spec.webhook.baseUrl is set"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := Validate(context.Background(), tt.obj, tt.allowInsecure)
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
