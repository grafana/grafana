package git

import (
	"context"
	"errors"
	"net/url"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

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
			Type: provisioning.GitRepositoryType,
			Git:  &provisioning.GitRepositoryConfig{URL: "https://github.com/test/repo", Branch: "main"},
		},
		Secure: provisioning.SecureValues{Token: common.InlineSecureValue{Name: "token"}},
	}
	return Extra(decrypter, false, nil, nil), config
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
	config.Spec.Git.URL = "://invalid-url"
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	result, err := extra.Build(ctx, config)
	require.Nil(t, result)
	require.ErrorContains(t, err, "create nanogit client")
	require.NotErrorIs(t, err, context.Canceled)
	var urlErr *url.Error
	require.ErrorAs(t, err, &urlErr)
}
