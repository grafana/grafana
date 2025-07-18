package github

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMutator(t *testing.T) {
	tests := []struct {
		name                   string
		obj                    runtime.Object
		token                  string
		setupMocks             func(*secrets.MockRepositorySecrets)
		expectedToken          string
		expectedEncryptedToken string
		expectedError          string
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
			setupMocks:             func(mockSecrets *secrets.MockRepositorySecrets) {},
			expectedToken:          "",
			expectedEncryptedToken: "",
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
			setupMocks:             func(mockSecrets *secrets.MockRepositorySecrets) {},
			expectedToken:          "",
			expectedEncryptedToken: "",
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
			setupMocks:             func(mockSecrets *secrets.MockRepositorySecrets) {},
			expectedToken:          "",
			expectedEncryptedToken: "",
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
			setupMocks:             func(mockSecrets *secrets.MockRepositorySecrets) {},
			expectedToken:          "",
			expectedEncryptedToken: "",
		},
		{
			name: "successful token encryption",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Token: "secret-token",
					},
				},
			},
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Encrypt(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
						Spec: provisioning.RepositorySpec{
							GitHub: &provisioning.GitHubRepositoryConfig{
								Token: "secret-token",
							},
						},
					},
					"test-repo"+githubTokenSecretSuffix,
					"secret-token",
				).Return([]byte("encrypted-token"), nil)
			},
			expectedToken:          "",
			expectedEncryptedToken: "encrypted-token",
		},
		{
			name: "encryption error",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Token: "secret-token",
					},
				},
			},
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Encrypt(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
						Spec: provisioning.RepositorySpec{
							GitHub: &provisioning.GitHubRepositoryConfig{
								Token: "secret-token",
							},
						},
					},
					"test-repo"+githubTokenSecretSuffix,
					"secret-token",
				).Return(nil, errors.New("encryption failed"))
			},
			expectedError: "encryption failed",
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
			setupMocks: func(_ *secrets.MockRepositorySecrets) {
				// No expectations
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
					GitHub: &provisioning.GitHubRepositoryConfig{
						Token: "",
					},
				},
			},
			setupMocks: func(_ *secrets.MockRepositorySecrets) {
				// No expectations
			},
		},
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
			setupMocks: func(_ *secrets.MockRepositorySecrets) {
				// No expectations
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecrets := secrets.NewMockRepositorySecrets(t)
			tt.setupMocks(mockSecrets)

			mutator := Mutator(mockSecrets)
			err := mutator(context.Background(), tt.obj)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)

				// Check that token was cleared and encrypted token was set
				if repo, ok := tt.obj.(*provisioning.Repository); ok && repo.Spec.GitHub != nil {
					if tt.expectedEncryptedToken != "" {
						// Token should be cleared after encryption
						assert.Empty(t, repo.Spec.GitHub.Token, "Token should be cleared after encryption")
						// EncryptedToken should be set to the expected value
						assert.Equal(t, tt.expectedEncryptedToken, string(repo.Spec.GitHub.EncryptedToken), "EncryptedToken should match expected value")
					}
				}
			}
		})
	}
}
