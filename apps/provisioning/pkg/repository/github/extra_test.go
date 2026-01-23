package github_test

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type mockSecureValues struct {
	token         common.RawSecureValue
	tokenErr      error
	webhookSecret common.RawSecureValue
	webhookErr    error
}

func (m *mockSecureValues) Token(_ context.Context) (common.RawSecureValue, error) {
	return m.token, m.tokenErr
}

func (m *mockSecureValues) WebhookSecret(_ context.Context) (common.RawSecureValue, error) {
	return m.webhookSecret, m.webhookErr
}

func TestExtra_Type(t *testing.T) {
	e := github.Extra(nil, nil, nil)
	assert.Equal(t, provisioning.GitHubRepositoryType, e.Type())
}

func TestExtra_Build(t *testing.T) {
	tests := []struct {
		name           string
		repo           *provisioning.Repository
		setupDecrypter func() repository.Decrypter
		setupWebhook   func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder
		expectedError  string
		validateResult func(t *testing.T, repo repository.Repository)
	}{
		{
			name: "missing github config",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.GitHubRepositoryType,
					GitHub: nil,
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{}
				}
			},
			setupWebhook:  func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder { return nil },
			expectedError: "github configuration is required",
		},
		{
			name: "nil repository",
			repo: nil,
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{}
				}
			},
			setupWebhook:  func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder { return nil },
			expectedError: "github configuration is required",
		},
		{
			name: "error decrypting token",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						tokenErr: errors.New("decryption failed"),
					}
				}
			},
			setupWebhook:  func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder { return nil },
			expectedError: "unable to decrypt token",
		},
		{
			name: "success without webhooks",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token: common.RawSecureValue("test-token"),
					}
				}
			},
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				return nil
			},
			validateResult: func(t *testing.T, repo repository.Repository) {
				assert.NotNil(t, repo)
			},
		},
		{
			name: "success with webhooks",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token:         common.RawSecureValue("test-token"),
						webhookSecret: common.RawSecureValue("webhook-secret"),
					}
				}
			},
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				mockWebhook := github.NewMockWebhookURLBuilder(t)
				mockWebhook.EXPECT().WebhookURL(mock.Anything, repo).Return("https://example.com/webhook")
				return mockWebhook
			},
			validateResult: func(t *testing.T, repo repository.Repository) {
				assert.NotNil(t, repo)
			},
		},
		{
			name: "skip webhook setup when URL is empty",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token: common.RawSecureValue("test-token"),
					}
				}
			},
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				mockWebhook := github.NewMockWebhookURLBuilder(t)
				mockWebhook.EXPECT().WebhookURL(mock.Anything, repo).Return("")
				return mockWebhook
			},
			validateResult: func(t *testing.T, repo repository.Repository) {
				assert.NotNil(t, repo)
			},
		},
		{
			name: "error decrypting webhook secret",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token:      common.RawSecureValue("test-token"),
						webhookErr: errors.New("webhook decryption failed"),
					}
				}
			},
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				mockWebhook := github.NewMockWebhookURLBuilder(t)
				mockWebhook.EXPECT().WebhookURL(mock.Anything, repo).Return("https://example.com/webhook")
				return mockWebhook
			},
			expectedError: "decrypt webhookSecret",
		},
		{
			name: "success with custom path",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
						Path:   "custom/path",
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token: common.RawSecureValue("test-token"),
					}
				}
			},
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				return nil
			},
			validateResult: func(t *testing.T, repo repository.Repository) {
				assert.NotNil(t, repo)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			decrypter := tt.setupDecrypter()
			webhookBuilder := tt.setupWebhook(t, tt.repo)
			factory := github.ProvideFactory()

			e := github.Extra(decrypter, factory, webhookBuilder)

			result, err := e.Build(ctx, tt.repo)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				if tt.validateResult != nil {
					tt.validateResult(t, result)
				}
			}
		})
	}
}

func TestExtra_Mutate(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		expectedError bool
		validateObj   func(t *testing.T, obj runtime.Object)
	}{
		{
			name: "mutates repository with github config",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test/repo.git/",
					},
				},
			},
			expectedError: false,
			validateObj: func(t *testing.T, obj runtime.Object) {
				repo := obj.(*provisioning.Repository)
				assert.Equal(t, "https://github.com/test/repo", repo.Spec.GitHub.URL)
			},
		},
		{
			name: "handles repository without github config",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.GitHubRepositoryType,
					GitHub: nil,
				},
			},
			expectedError: false,
		},
		{
			name:          "handles non-repository object",
			obj:           &runtime.Unknown{},
			expectedError: false,
		},
		{
			name: "trims only trailing slash",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test/repo/",
					},
				},
			},
			expectedError: false,
			validateObj: func(t *testing.T, obj runtime.Object) {
				repo := obj.(*provisioning.Repository)
				assert.Equal(t, "https://github.com/test/repo", repo.Spec.GitHub.URL)
			},
		},
		{
			name: "trims only .git suffix",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test/repo.git",
					},
				},
			},
			expectedError: false,
			validateObj: func(t *testing.T, obj runtime.Object) {
				repo := obj.(*provisioning.Repository)
				assert.Equal(t, "https://github.com/test/repo", repo.Spec.GitHub.URL)
			},
		},
		{
			name: "no changes when URL is clean",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/test/repo",
					},
				},
			},
			expectedError: false,
			validateObj: func(t *testing.T, obj runtime.Object) {
				repo := obj.(*provisioning.Repository)
				assert.Equal(t, "https://github.com/test/repo", repo.Spec.GitHub.URL)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			e := github.Extra(nil, nil, nil)

			err := e.Mutate(ctx, tt.obj)

			if tt.expectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				if tt.validateObj != nil {
					tt.validateObj(t, tt.obj)
				}
			}
		})
	}
}
