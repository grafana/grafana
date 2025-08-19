package git

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
		expectedURL            string
	}{
		{
			name: "successful token encryption",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
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
							Type: provisioning.GitRepositoryType,
							Git: &provisioning.GitRepositoryConfig{
								Token: "secret-token",
							},
						},
					},
					"test-repo"+gitTokenSecretSuffix,
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
					Type: provisioning.GitRepositoryType,
					Git: &provisioning.GitRepositoryConfig{
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
							Type: provisioning.GitRepositoryType,
							Git: &provisioning.GitRepositoryConfig{
								Token: "secret-token",
							},
						},
					},
					"test-repo"+gitTokenSecretSuffix,
					"secret-token",
				).Return(nil, errors.New("encryption failed"))
			},
			expectedError: "encryption failed",
		},
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
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
					Git: &provisioning.GitRepositoryConfig{
						Token: "",
					},
				},
			},
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
			},
		},
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
			},
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
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
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				// No expectations
			},
			expectedURL: "",
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
				if repo, ok := tt.obj.(*provisioning.Repository); ok && repo.Spec.Git != nil {
					if tt.expectedEncryptedToken != "" {
						// Token should be cleared after encryption
						assert.Empty(t, repo.Spec.Git.Token, "Token should be cleared after encryption")
						// EncryptedToken should be set to the expected value
						assert.Equal(t, tt.expectedEncryptedToken, string(repo.Spec.Git.EncryptedToken), "EncryptedToken should match expected value")
					}

					// Check URL normalization
					if tt.expectedURL != "" {
						assert.Equal(t, tt.expectedURL, repo.Spec.Git.URL, "URL should be normalized correctly")
					}
				}
			}
		})
	}
}
