package github

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestValidate(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
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
					Type: provisioning.LocalRepositoryType,
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
					Type:   provisioning.GitHubRepositoryType,
					GitHub: nil,
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
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"url"},
		},
		{
			name: "invalid URL format",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://gitlab.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"URL must start with https://github.com/"},
		},
		{
			name: "valid github repository",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Path:   "grafana",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Validate(context.Background(), tt.obj)
			if tt.expectedError {
				assert.Error(t, err)
				if len(tt.errorContains) > 0 {
					errStr := err.Error()
					for _, contains := range tt.errorContains {
						assert.Contains(t, errStr, contains)
					}
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
