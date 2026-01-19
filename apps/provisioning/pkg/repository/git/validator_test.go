package git

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
			name: "non-git repository type",
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
			name: "git repository type without git config",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  nil,
				},
			},
			expectedError: true,
			errorContains: []string{"git configuration is required"},
		},
		{
			name: "missing URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
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
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "not-a-url",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid git URL format"},
		},
		{
			name: "missing branch",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL: "https://github.com/grafana/grafana.git",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"branch"},
		},
		{
			name: "invalid branch name",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "..invalid",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid branch name"},
		},
		{
			name: "workflow requires token or connection",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
					},
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			expectedError: true,
			errorContains: []string{"token"},
		},
		{
			name: "invalid path",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
						Path:   "../invalid",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"path"},
		},
		{
			name: "absolute path",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
						Path:   "/absolute/path",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"path must be relative"},
		},
		{
			name: "valid git repository",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
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
		{
			name: "valid git repository with connection",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
						Path:   "grafana",
					},
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					Connection: &provisioning.ConnectionInfo{
						Name: "test-connection",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := Validate(context.Background(), tt.obj)
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
