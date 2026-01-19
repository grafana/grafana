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

func TestMutator(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		expectedObj   runtime.Object
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
			expectedObj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo1",
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
			expectedObj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo2",
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
			expectedObj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo3",
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
			expectedObj: &provisioning.Repository{
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
			name: "should add token",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo4",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/org/repo",
					},
					Connection: &provisioning.ConnectionInfo{
						Name: "someConnection",
					},
				},
			},
			expectedObj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo4",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/org/repo",
					},
					Connection: &provisioning.ConnectionInfo{
						Name: "someConnection",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.RawSecureValue("someConnection"),
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
			expectedObj: &provisioning.Repository{
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
			expectedObj: &provisioning.Repository{
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
			name:        "non-repository object",
			obj:         &runtime.Unknown{},
			expectedObj: &runtime.Unknown{},
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
				assert.Equal(t, tt.expectedObj, tt.obj)
			}
		})
	}
}
