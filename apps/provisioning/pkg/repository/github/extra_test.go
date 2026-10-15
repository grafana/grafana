package github_test

import (
	"context"
	"errors"
	"net/url"
	"testing"
	"testing/synctest"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
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
	signingKey    common.RawSecureValue
	signingErr    error
}

func (m *mockSecureValues) Token(_ context.Context) (common.RawSecureValue, error) {
	return m.token, m.tokenErr
}

func (m *mockSecureValues) WebhookSecret(_ context.Context) (common.RawSecureValue, error) {
	return m.webhookSecret, m.webhookErr
}

func (m *mockSecureValues) CommitSigningKey(_ context.Context) (common.RawSecureValue, error) {
	return m.signingKey, m.signingErr
}

func TestExtra_Type(t *testing.T) {
	e := github.Extra(nil, nil, nil, false, nil, nil)
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
			name: "skip webhook setup when webhookDisabled is true",
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
					Webhook: &provisioning.WebhookConfig{Disabled: true},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token: common.RawSecureValue("test-token"),
					}
				}
			},
			// The builder must not be called when webhookDisabled is set, so no expectations.
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				return github.NewMockWebhookURLBuilder(t)
			},
			validateResult: func(t *testing.T, repo repository.Repository) {
				assert.NotNil(t, repo)
			},
		},
		{
			name: "wrap with webhook repo for cleanup when webhookDisabled is true and stale webhook exists",
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
					Webhook: &provisioning.WebhookConfig{Disabled: true},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  456,
						URL: "https://grafana.example.com/webhook",
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
			// No webhook URL needed for deletion — builder must not be called.
			setupWebhook: func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder {
				return github.NewMockWebhookURLBuilder(t)
			},
			validateResult: func(t *testing.T, repo repository.Repository) {
				_, ok := repo.(github.GithubWebhookRepository)
				assert.True(t, ok, "expected a GithubWebhookRepository so OnUpdate can clean up the stale webhook")
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
			name: "error decrypting signing key",
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
					Commit: &provisioning.CommitOptions{
						SigningMethod: provisioning.SSHSigningMethod,
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token:      common.RawSecureValue("test-token"),
						signingErr: errors.New("signing key decryption failed"),
					}
				}
			},
			setupWebhook:  func(t *testing.T, repo *provisioning.Repository) github.WebhookURLBuilder { return nil },
			expectedError: "unable to decrypt signing key",
		},
		{
			name: "success with commit signing",
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
					Commit: &provisioning.CommitOptions{
						SigningMethod: provisioning.SSHSigningMethod,
					},
				},
			},
			setupDecrypter: func() repository.Decrypter {
				return func(r *provisioning.Repository) repository.SecureValues {
					return &mockSecureValues{
						token:      common.RawSecureValue("test-token"),
						signingKey: common.RawSecureValue("ssh-key"),
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

			e := github.Extra(decrypter, factory, webhookBuilder, false, nil, nil)

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

			e := github.Extra(nil, nil, nil, false, nil, nil)

			err := e.Mutate(ctx, tt.obj, nil)

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

type buildDecryptFunc func(context.Context, ...string) (map[string]decrypt.DecryptResult, error)

func (f buildDecryptFunc) Decrypt(ctx context.Context, _, _ string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return f(ctx, names...)
}

func TestExtra_BuildErrors(t *testing.T) {
	for _, tt := range []struct {
		name    string
		opts    []repository.BuildOption
		missing bool
		wantErr error
	}{
		{name: "decrypt failure", wantErr: repository.ErrSecretDecryptFailed},
		{name: "decrypt failure with timeout", opts: []repository.BuildOption{repository.WithTimeout(time.Second)}, wantErr: repository.ErrSecretDecryptFailed},
		{name: "missing token", opts: []repository.BuildOption{repository.WithTimeout(time.Second)}, missing: true, wantErr: repository.ErrTokenNotFound},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				start := time.Now()
				calls := 0
				decryptErr := errors.New("decrypt service unavailable")
				svc := buildDecryptFunc(func(context.Context, ...string) (map[string]decrypt.DecryptResult, error) {
					calls++
					if tt.missing {
						return map[string]decrypt.DecryptResult{}, nil
					}
					return nil, decryptErr
				})
				extra, config := newBuildTestExtra(svc)
				result, err := extra.Build(context.Background(), config, tt.opts...)
				require.Nil(t, result)
				require.ErrorIs(t, err, tt.wantErr)
				require.Equal(t, 1, calls)
				require.Zero(t, time.Since(start))
				if !tt.missing {
					require.ErrorIs(t, err, decryptErr)
				}
			})
		})
	}
}

func newBuildTestExtra(svc decrypt.DecryptService) (repository.Extra, *provisioning.Repository) {
	decrypter := repository.ProvideDecrypter(svc, nil)
	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type:   provisioning.GitHubRepositoryType,
			GitHub: &provisioning.GitHubRepositoryConfig{URL: "https://github.com/test/repo", Branch: "main"},
		},
		Secure: provisioning.SecureValues{Token: common.InlineSecureValue{Name: "token"}},
	}
	return github.Extra(decrypter, github.ProvideFactory(), nil, false, nil, nil), config
}

func TestExtra_BuildDeadlineAndCancellation(t *testing.T) {
	for _, tt := range []struct {
		name          string
		timeout       time.Duration
		callerTimeout time.Duration
		cancelAfter   time.Duration
		canceled      bool
		elapsed       time.Duration
		calls         int
		wantErr       error
		token         *common.InlineSecureValue
	}{
		{name: "timeout during construction", timeout: 50 * time.Millisecond, elapsed: 50 * time.Millisecond, calls: 1, wantErr: context.DeadlineExceeded},
		{name: "earlier caller deadline", timeout: time.Second, callerTimeout: 30 * time.Millisecond, elapsed: 30 * time.Millisecond, calls: 1, wantErr: context.DeadlineExceeded},
		{name: "caller deadline without option", callerTimeout: 30 * time.Millisecond, elapsed: 30 * time.Millisecond, calls: 1, wantErr: context.DeadlineExceeded},
		{name: "canceled context reaches decrypt", timeout: time.Second, canceled: true, calls: 1, wantErr: context.Canceled},
		{name: "canceled during construction", timeout: time.Second, cancelAfter: 25 * time.Millisecond, elapsed: 25 * time.Millisecond, calls: 1, wantErr: context.Canceled},
		{name: "canceled with absent secrets", canceled: true, token: &common.InlineSecureValue{}, wantErr: context.Canceled},
		{name: "canceled with inline token", canceled: true, token: &common.InlineSecureValue{Create: "token"}, wantErr: context.Canceled},
		{name: "expired deadline with absent secrets", callerTimeout: -time.Second, token: &common.InlineSecureValue{}, wantErr: context.DeadlineExceeded},
		{name: "expired deadline with inline token", callerTimeout: -time.Second, token: &common.InlineSecureValue{Create: "token"}, wantErr: context.DeadlineExceeded},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				if tt.canceled {
					cancel()
				} else if tt.cancelAfter > 0 {
					time.AfterFunc(tt.cancelAfter, cancel)
				}
				if tt.callerTimeout != 0 {
					var cancelDeadline context.CancelFunc
					ctx, cancelDeadline = context.WithTimeout(ctx, tt.callerTimeout)
					defer cancelDeadline()
				}
				start := time.Now()
				calls := 0
				svc := buildDecryptFunc(func(ctx context.Context, _ ...string) (map[string]decrypt.DecryptResult, error) {
					calls++
					limit := tt.timeout
					if tt.callerTimeout > 0 && (limit == 0 || tt.callerTimeout < limit) {
						limit = tt.callerTimeout
					}
					deadline, ok := ctx.Deadline()
					require.True(t, ok)
					require.Equal(t, start.Add(limit), deadline)
					<-ctx.Done()
					return nil, ctx.Err()
				})
				extra, config := newBuildTestExtra(svc)
				if tt.token != nil {
					config.Secure.Token = *tt.token
				}
				result, err := extra.Build(ctx, config, repository.WithTimeout(tt.timeout))
				require.Nil(t, result)
				require.ErrorIs(t, err, tt.wantErr)
				require.Equal(t, tt.calls, calls)
				require.Equal(t, tt.elapsed, time.Since(start))
				if calls > 0 {
					require.ErrorIs(t, err, repository.ErrSecretDecryptFailed)
				}
			})
		})
	}
}

func TestExtra_BuildDecryptDeadline(t *testing.T) {
	for _, tt := range []struct {
		name     string
		opts     []repository.BuildOption
		deadline time.Duration
	}{
		{name: "default", deadline: 30 * time.Second},
		{name: "zero disables timeout", opts: []repository.BuildOption{repository.WithTimeout(0)}, deadline: 30 * time.Second},
		{name: "negative disables timeout", opts: []repository.BuildOption{repository.WithTimeout(-time.Second)}, deadline: 30 * time.Second},
		{name: "last option disables timeout", opts: []repository.BuildOption{repository.WithTimeout(time.Second), repository.WithTimeout(0)}, deadline: 30 * time.Second},
		{name: "last timeout wins", opts: []repository.BuildOption{repository.WithTimeout(time.Second), repository.WithTimeout(5 * time.Second)}, deadline: 5 * time.Second},
		{name: "existing decrypt limit", opts: []repository.BuildOption{repository.WithTimeout(time.Minute)}, deadline: 30 * time.Second},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				start := time.Now()
				svc := buildDecryptFunc(func(ctx context.Context, names ...string) (map[string]decrypt.DecryptResult, error) {
					deadline, ok := ctx.Deadline()
					require.True(t, ok)
					require.Equal(t, start.Add(tt.deadline), deadline)
					value := secretv1beta1.NewExposedSecureValue("token")
					return map[string]decrypt.DecryptResult{names[0]: decrypt.NewDecryptResultValue(&value)}, nil
				})
				extra, config := newBuildTestExtra(svc)
				ctx := context.Background()
				result, err := extra.Build(ctx, config, tt.opts...)
				require.NoError(t, err)
				require.Same(t, config, result.Config())
				require.NoError(t, ctx.Err())
			})
		})
	}
}

func TestExtra_BuildPreservesConstructionErrorWhenCanceled(t *testing.T) {
	extra, config := newBuildTestExtra(nil)
	config.Secure = provisioning.SecureValues{}
	config.Spec.GitHub.URL = "://invalid-url"
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	result, err := extra.Build(ctx, config)
	require.Nil(t, result)
	require.ErrorContains(t, err, "create nanogit client")
	require.NotErrorIs(t, err, context.Canceled)
	var urlErr *url.Error
	require.ErrorAs(t, err, &urlErr)
}
