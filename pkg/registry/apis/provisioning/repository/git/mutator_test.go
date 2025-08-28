package git

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestMutate(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		token         string
		expectedError string
		expectedURL   string
	}{
		{
			name: "no git spec",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Git:  nil,
				},
			},
		},
		{
			name: "no git spec for git repository type",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  nil,
				},
			},
			expectedError: "git configuration is required for git repository type",
		},
		{
			name: "empty token",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git:  &provisioning.GitRepositoryConfig{},
				},
			},
		},
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
		},
		{
			name: "URL normalization - add .git suffix",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL: "https://github.com/grafana/grafana",
					},
				},
			},
			expectedURL: "https://github.com/grafana/grafana.git",
		},
		{
			name: "URL normalization - keep existing .git suffix",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL: "https://github.com/grafana/grafana.git",
					},
				},
			},
			expectedURL: "https://github.com/grafana/grafana.git",
		},
		{
			name: "URL normalization - remove trailing slash and add .git",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL: "https://github.com/grafana/grafana/",
					},
				},
			},
			expectedURL: "https://github.com/grafana/grafana.git",
		},
		{
			name: "URL normalization - trim whitespace and add .git",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL: "  https://github.com/grafana/grafana  ",
					},
				},
			},
			expectedURL: "https://github.com/grafana/grafana.git",
		},
		{
			name: "URL normalization - empty URL after trim",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
						URL: "   ",
					},
				},
			},
			expectedURL: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Mutate(context.Background(), tt.obj)
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)

				// Check that token was cleared and encrypted token was set
				if repo, ok := tt.obj.(*provisioning.Repository); ok && repo.Spec.Git != nil {
					// Check URL normalization
					if tt.expectedURL != "" {
						assert.Equal(t, tt.expectedURL, repo.Spec.Git.URL, "URL should be normalized correctly")
					}
				}
			}
		})
	}
}
