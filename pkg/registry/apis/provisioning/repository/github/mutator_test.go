package github

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestMutator(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		token         string
		expectedError string
	}{
		{
			name: "trims trailing .git and slash from GitHub URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo1",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/org/repo.git/",
					},
				},
			},
		},
		{
			name: "trims only trailing slash from GitHub URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo2",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/org/repo/",
					},
				},
			},
		},
		{
			name: "trims only trailing .git from GitHub URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo3",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/org/repo.git",
					},
				},
			},
		},
		{
			name: "does not trim if no .git or slash",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo4",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/org/repo",
					},
				},
			},
		},
		{
			name: "no github spec",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: nil,
				},
			},
		},
		{
			name: "empty token",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{},
				},
			},
		},
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mutator := Mutator()
			err := mutator(context.Background(), tt.obj)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
