package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// noopTracer is a no-op tracer for the many factory tests that don't assert on spans.
var noopTracer = noop.NewTracerProvider().Tracer("test")

func TestNewFactory(t *testing.T) {
	t.Run("creates factory with empty extras", func(t *testing.T) {
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		factory, err := ProvideFactory(enabled, []Extra{}, noopTracer)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()
		assert.Empty(t, types)
	})

	t.Run("creates factory with multiple extras", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.RepositorySpecTypeGithub)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal:  {},
			provisioning.RepositorySpecTypeGit:    {},
			provisioning.RepositorySpecTypeGithub: {},
		}
		extras := []Extra{localExtra, gitExtra, githubExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()
		assert.Len(t, types, 3)

		// Verify stable ordering - types should be sorted alphabetically
		expectedTypes := []provisioning.RepositorySpecType{
			provisioning.RepositorySpecTypeGit,
			provisioning.RepositorySpecTypeGithub,
			provisioning.RepositorySpecTypeLocal,
		}
		assert.Equal(t, expectedTypes, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})

	t.Run("returns error for duplicate repository types", func(t *testing.T) {
		firstExtra := &MockExtra{}
		firstExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		secondExtra := &MockExtra{}
		secondExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		extras := []Extra{firstExtra, secondExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		assert.Error(t, err)
		assert.Nil(t, factory)
		assert.Contains(t, err.Error(), "repository type \"local\" is already registered")

		firstExtra.AssertExpectations(t)
		secondExtra.AssertExpectations(t)
	})

	t.Run("returns error for duplicate among multiple different types", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		duplicateGitExtra := &MockExtra{}
		duplicateGitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		extras := []Extra{localExtra, gitExtra, duplicateGitExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		assert.Error(t, err)
		assert.Nil(t, factory)
		assert.Contains(t, err.Error(), "repository type \"git\" is already registered")

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		duplicateGitExtra.AssertExpectations(t)
	})

	t.Run("handles nil extras slice", func(t *testing.T) {
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		factory, err := ProvideFactory(enabled, nil, noopTracer)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()
		assert.Empty(t, types)
	})
}

func TestFactory_Types(t *testing.T) {
	t.Run("returns empty slice for factory with no extras", func(t *testing.T) {
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		factory, err := ProvideFactory(enabled, []Extra{}, noopTracer)

		require.NoError(t, err)
		types := factory.Types()
		assert.Empty(t, types)
	})

	t.Run("returns all registered repository types in stable order", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.RepositorySpecTypeGithub)

		bitbucketExtra := &MockExtra{}
		bitbucketExtra.On("Type").Return(provisioning.RepositorySpecTypeBitbucket)

		gitlabExtra := &MockExtra{}
		gitlabExtra.On("Type").Return(provisioning.RepositorySpecTypeGitlab)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal:     {},
			provisioning.RepositorySpecTypeGit:       {},
			provisioning.RepositorySpecTypeGithub:    {},
			provisioning.RepositorySpecTypeBitbucket: {},
			provisioning.RepositorySpecTypeGitlab:    {},
		}
		extras := []Extra{localExtra, gitExtra, githubExtra, bitbucketExtra, gitlabExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		types := factory.Types()

		assert.Len(t, types, 5)

		// Verify stable ordering - types should be sorted alphabetically
		expectedTypes := []provisioning.RepositorySpecType{
			provisioning.RepositorySpecTypeBitbucket,
			provisioning.RepositorySpecTypeGit,
			provisioning.RepositorySpecTypeGithub,
			provisioning.RepositorySpecTypeGitlab,
			provisioning.RepositorySpecTypeLocal,
		}
		assert.Equal(t, expectedTypes, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
		bitbucketExtra.AssertExpectations(t)
		gitlabExtra.AssertExpectations(t)
	})

	t.Run("returns consistent order across multiple calls", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.RepositorySpecTypeGithub)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal:  {},
			provisioning.RepositorySpecTypeGit:    {},
			provisioning.RepositorySpecTypeGithub: {},
		}
		extras := []Extra{githubExtra, localExtra, gitExtra} // Intentionally unordered
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		types1 := factory.Types()
		types2 := factory.Types()
		types3 := factory.Types()

		// All calls should return the same order
		assert.Equal(t, types1, types2)
		assert.Equal(t, types2, types3)

		// Verify the order is alphabetical
		expectedTypes := []provisioning.RepositorySpecType{
			provisioning.RepositorySpecTypeGit,
			provisioning.RepositorySpecTypeGithub,
			provisioning.RepositorySpecTypeLocal,
		}
		assert.Equal(t, expectedTypes, types1)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})
}

// TestFactory_Build_EmitsSpan verifies Build runs under a provisioning.repository.build
// span so the secret decryption it triggers has a descriptive parent regardless of the
// caller.
func TestFactory_Build_EmitsSpan(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

	localExtra := &MockExtra{}
	localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
	localExtra.On("Build", mock.Anything, mock.Anything).Return(&MockConfigRepository{}, nil)

	factory, err := ProvideFactory(
		map[provisioning.RepositorySpecType]struct{}{provisioning.RepositorySpecTypeLocal: {}},
		[]Extra{localExtra},
		tp.Tracer("test"),
	)
	require.NoError(t, err)

	repoConfig := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "my-ns"},
		Spec:       provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeLocal},
	}

	_, err = factory.Build(context.Background(), repoConfig)
	require.NoError(t, err)

	var buildSpan sdktrace.ReadOnlySpan
	for _, s := range recorder.Ended() {
		if s.Name() == "provisioning.repository.build" {
			buildSpan = s
			break
		}
	}
	require.NotNil(t, buildSpan, "expected a provisioning.repository.build span")

	attrs := buildSpan.Attributes()
	assert.Contains(t, attrs, attribute.String("repository.name", "my-repo"))
	assert.Contains(t, attrs, attribute.String("repository.namespace", "my-ns"))
	assert.Contains(t, attrs, attribute.String("repository.type", string(provisioning.RepositorySpecTypeLocal)))
}

func TestFactory_Build(t *testing.T) {
	t.Run("successfully builds repository with matching type", func(t *testing.T) {
		expectedRepo := &MockConfigRepository{}
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Build", mock.Anything, mock.Anything).Return(expectedRepo, nil)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		assert.Equal(t, expectedRepo, result)
		localExtra.AssertExpectations(t)
	})

	t.Run("returns error for unsupported repository type", func(t *testing.T) {
		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeGit: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{gitExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal, // Different from registered type
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "repository type \"local\" is not supported")
		gitExtra.AssertNotCalled(t, "Build")
		gitExtra.AssertExpectations(t)
	})

	t.Run("propagates error from extra.Build", func(t *testing.T) {
		expectedError := errors.New("build failed")
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Build", mock.Anything, mock.Anything).Return(nil, expectedError)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		assert.Error(t, err)
		assert.Equal(t, expectedError, err)
		assert.Nil(t, result)
		localExtra.AssertExpectations(t)
	})

	t.Run("finds correct extra among multiple", func(t *testing.T) {
		gitRepo := &MockConfigRepository{}

		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)
		gitExtra.On("Build", mock.Anything, mock.Anything).Return(gitRepo, nil)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra, gitExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeGit,
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		assert.Equal(t, gitRepo, result)
		localExtra.AssertNotCalled(t, "Build") // Should not be called
		gitExtra.AssertExpectations(t)         // Should be called
		localExtra.AssertExpectations(t)
	})

	t.Run("handles empty repository type", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: "", // Empty type
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "repository type \"\" is not supported")
		localExtra.AssertNotCalled(t, "Build")
		localExtra.AssertExpectations(t)
	})

	t.Run("passes context correctly to extra.Build", func(t *testing.T) {
		localRepo := &MockConfigRepository{}
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		// Create context with value to verify it's passed through
		type testKey string
		ctx := context.WithValue(context.Background(), testKey("test"), "value")

		// Use a custom matcher to verify the context is passed correctly
		localExtra.On("Build", mock.MatchedBy(func(c context.Context) bool {
			return c.Value(testKey("test")) == "value"
		}), mock.Anything).Return(localRepo, nil)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		_, err = factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		localExtra.AssertExpectations(t)
	})
}

func TestFactory_Build_Timeout(t *testing.T) {
	for _, tt := range []struct {
		name           string
		waitForContext bool
		parentTimeout  time.Duration
		wantTimeout    time.Duration
	}{
		{name: "success", wantTimeout: 30 * time.Second},
		{name: "build timeout", waitForContext: true, wantTimeout: 30 * time.Second},
		{name: "shorter parent deadline", parentTimeout: time.Second, waitForContext: true, wantTimeout: time.Second},
		{name: "longer parent deadline", parentTimeout: time.Minute, waitForContext: true, wantTimeout: 30 * time.Second},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := t.Context()
				if tt.parentTimeout > 0 {
					var cancel context.CancelFunc
					ctx, cancel = context.WithTimeout(ctx, tt.parentTimeout)
					defer cancel()
				}
				cfg := &provisioning.Repository{
					Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeLocal},
				}
				built := NewMockRepository(t)
				extra := NewMockExtra(t)
				extra.EXPECT().Type().Return(cfg.Spec.Type)
				start := time.Now()
				var receivedContext context.Context
				extra.EXPECT().Build(mock.Anything, cfg).RunAndReturn(func(ctx context.Context, _ *provisioning.Repository) (Repository, error) {
					receivedContext = ctx
					deadline, ok := ctx.Deadline()
					require.True(t, ok)
					assert.Equal(t, start.Add(tt.wantTimeout), deadline)
					if tt.waitForContext {
						<-ctx.Done()
						assert.Equal(t, tt.wantTimeout, time.Since(start))
					}
					return built, ctx.Err()
				}).Once()
				factory, err := ProvideFactory(
					map[provisioning.RepositorySpecType]struct{}{cfg.Spec.Type: {}},
					[]Extra{extra}, noopTracer,
				)
				require.NoError(t, err)

				got, err := factory.Build(ctx, cfg)
				if !tt.waitForContext {
					require.NoError(t, err)
					assert.Same(t, built, got)
				} else {
					require.ErrorIs(t, err, context.DeadlineExceeded)
					assert.ErrorIs(t, err, ErrServerUnavailable)
					assert.Nil(t, got)
				}
				assert.Error(t, receivedContext.Err(), "the build context must be released when Build returns")
				if tt.parentTimeout == 0 || tt.parentTimeout > tt.wantTimeout {
					assert.NoError(t, ctx.Err(), "the caller's context must remain usable for status updates")
				}
			})
		})
	}
}

func TestFactory_Build_DeadlineFailures(t *testing.T) {
	classifiedErr := fmt.Errorf("%w: %w", ErrServerUnavailable, context.DeadlineExceeded)
	for _, tt := range []struct {
		name            string
		buildErr        error
		waitForDeadline bool
		cancelContext   bool
		wantUnavailable bool
	}{
		{name: "provider deadline", buildErr: context.DeadlineExceeded, wantUnavailable: true},
		{name: "wrapped provider deadline", buildErr: fmt.Errorf("get project: %w", context.DeadlineExceeded), wantUnavailable: true},
		{name: "already classified deadline", buildErr: classifiedErr, wantUnavailable: true},
		{name: "context deadline", waitForDeadline: true, buildErr: context.DeadlineExceeded, wantUnavailable: true},
		{name: "cancellation after deadline", waitForDeadline: true, buildErr: context.Canceled, wantUnavailable: true},
		{name: "success after deadline", waitForDeadline: true, wantUnavailable: true},
		{name: "provider error after deadline", waitForDeadline: true, buildErr: ErrSecretDecryptFailed, wantUnavailable: true},
		{name: "caller cancellation", cancelContext: true},
		{name: "provider cancellation", buildErr: context.Canceled},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				if tt.waitForDeadline {
					var cancelDeadline context.CancelFunc
					ctx, cancelDeadline = context.WithTimeout(ctx, time.Second)
					defer cancelDeadline()
				}
				if tt.cancelContext {
					cancel()
				}

				cfg := &provisioning.Repository{
					Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeLocal},
				}
				extra := NewMockExtra(t)
				extra.EXPECT().Type().Return(cfg.Spec.Type)
				extra.EXPECT().Build(mock.Anything, cfg).RunAndReturn(func(buildCtx context.Context, _ *provisioning.Repository) (Repository, error) {
					if tt.waitForDeadline {
						<-buildCtx.Done()
					}
					return &MockConfigRepository{}, tt.buildErr
				}).Once()
				factory, err := ProvideFactory(
					map[provisioning.RepositorySpecType]struct{}{cfg.Spec.Type: {}},
					[]Extra{extra}, noopTracer,
				)
				require.NoError(t, err)

				got, err := factory.Build(ctx, cfg)
				require.Error(t, err)
				assert.Nil(t, got)
				if tt.buildErr != nil {
					assert.ErrorIs(t, err, tt.buildErr)
				}
				if ctx.Err() != nil {
					assert.ErrorIs(t, err, ctx.Err())
				}
				assert.Equal(t, tt.wantUnavailable, errors.Is(err, ErrServerUnavailable))
				if errors.Is(tt.buildErr, classifiedErr) {
					assert.Same(t, classifiedErr, err, "an already classified deadline must not be wrapped again")
				}
			})
		})
	}
}

func TestFactory_Types_EnabledFiltering(t *testing.T) {
	t.Run("returns only enabled types", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.RepositorySpecTypeGithub)

		// Only enable local and github, not git
		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal:  {},
			provisioning.RepositorySpecTypeGithub: {},
		}
		extras := []Extra{localExtra, gitExtra, githubExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		types := factory.Types()

		assert.Len(t, types, 2)
		expectedTypes := []provisioning.RepositorySpecType{
			provisioning.RepositorySpecTypeGithub,
			provisioning.RepositorySpecTypeLocal,
		}
		assert.Equal(t, expectedTypes, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})

	t.Run("returns empty when no types enabled", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		// Nothing enabled
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		extras := []Extra{localExtra, gitExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		types := factory.Types()

		assert.Empty(t, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
	})

	t.Run("ignores enabled types without corresponding extras", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		// Enable local and git, but only have local extra
		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		extras := []Extra{localExtra}
		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		types := factory.Types()

		// Should only return local since git extra doesn't exist
		assert.Len(t, types, 1)
		assert.Equal(t, []provisioning.RepositorySpecType{provisioning.RepositorySpecTypeLocal}, types)

		localExtra.AssertExpectations(t)
	})
}

func TestProvideFactory_EnabledParameter(t *testing.T) {
	t.Run("creates factory with specific enabled types", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.RepositorySpecTypeGithub)

		// Only enable local and git, not github
		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		extras := []Extra{localExtra, gitExtra, githubExtra}

		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()

		// Should only return enabled types
		assert.Len(t, types, 2)
		expectedTypes := []provisioning.RepositorySpecType{
			provisioning.RepositorySpecTypeGit,
			provisioning.RepositorySpecTypeLocal,
		}
		assert.Equal(t, expectedTypes, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})

	t.Run("creates factory with no enabled types", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)

		// Enable nothing
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		extras := []Extra{localExtra, gitExtra}

		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()

		assert.Empty(t, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
	})

	t.Run("enabled types without extras are ignored", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		// Enable both local and git, but only provide local extra
		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		extras := []Extra{localExtra}

		factory, err := ProvideFactory(enabled, extras, noopTracer)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()

		// Should only return local since git extra doesn't exist
		assert.Len(t, types, 1)
		assert.Equal(t, []provisioning.RepositorySpecType{provisioning.RepositorySpecTypeLocal}, types)

		localExtra.AssertExpectations(t)
	})

	t.Run("still errors for duplicate repository types", func(t *testing.T) {
		// Create duplicate extras to trigger error
		firstExtra := &MockExtra{}
		firstExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		secondExtra := &MockExtra{}
		secondExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		extras := []Extra{firstExtra, secondExtra}

		factory, err := ProvideFactory(enabled, extras, noopTracer)

		assert.Error(t, err)
		assert.Nil(t, factory)
		assert.Contains(t, err.Error(), "repository type \"local\" is already registered")

		firstExtra.AssertExpectations(t)
		secondExtra.AssertExpectations(t)
	})

	t.Run("build fails for disabled repository type", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		// Create factory with local extra but don't enable it
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "repository type \"local\" is not enabled")
		localExtra.AssertNotCalled(t, "Build")
		localExtra.AssertExpectations(t)
	})

	t.Run("build succeeds for enabled repository type", func(t *testing.T) {
		expectedRepo := &MockConfigRepository{}
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Build", mock.Anything, mock.Anything).Return(expectedRepo, nil)

		// Create factory with local extra and enable it
		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		assert.Equal(t, expectedRepo, result)
		localExtra.AssertExpectations(t)
	})
}

func TestFactory_Mutate(t *testing.T) {
	t.Run("calls mutate only for matching type", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Mutate", mock.Anything, mock.Anything, mock.Anything).Return(nil)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)
		// Note: gitExtra.Mutate should NOT be called

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra, gitExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		err = factory.Mutate(context.Background(), repo, nil)
		require.NoError(t, err)

		localExtra.AssertExpectations(t)
		gitExtra.AssertNotCalled(t, "Mutate")
	})

	t.Run("returns nil for non-repository object", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		// Pass a non-repository object
		err = factory.Mutate(context.Background(), &provisioning.Connection{}, nil)
		require.NoError(t, err)

		localExtra.AssertNotCalled(t, "Mutate")
	})

	t.Run("returns nil for unsupported type (caught by Validate)", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeGit, // Unsupported
			},
		}

		err = factory.Mutate(context.Background(), repo, nil)
		require.NoError(t, err) // Mutate returns nil for unsupported types

		localExtra.AssertNotCalled(t, "Mutate")
	})

	t.Run("forwards the exact old object to the matching extra", func(t *testing.T) {
		oldRepo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
				Sync: provisioning.RepositorySyncOptions{IntervalSeconds: 30},
			},
		}

		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Mutate", mock.Anything, mock.Anything, oldRepo).Return(nil)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		err = factory.Mutate(context.Background(), repo, oldRepo)
		require.NoError(t, err)

		localExtra.AssertExpectations(t)
	})

	t.Run("propagates error from extra.Mutate", func(t *testing.T) {
		expectedError := errors.New("mutate failed")
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Mutate", mock.Anything, mock.Anything, mock.Anything).Return(expectedError)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		err = factory.Mutate(context.Background(), repo, nil)
		assert.Error(t, err)
		assert.Equal(t, expectedError, err)

		localExtra.AssertExpectations(t)
	})
}

func TestFactory_Validate(t *testing.T) {
	t.Run("validates only for matching type", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)
		localExtra.On("Validate", mock.Anything, mock.Anything).Return(nil)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.RepositorySpecTypeGit)
		// Note: gitExtra.Validate should NOT be called

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
			provisioning.RepositorySpecTypeGit:   {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra, gitExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		errors := factory.Validate(context.Background(), repo)
		assert.Empty(t, errors)

		localExtra.AssertExpectations(t)
		gitExtra.AssertNotCalled(t, "Validate")
	})

	t.Run("returns error for unsupported type", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeGit, // Unsupported
			},
		}

		errors := factory.Validate(context.Background(), repo)
		require.Len(t, errors, 1)
		assert.Contains(t, errors[0].Detail, "repository type \"git\" is not supported")

		localExtra.AssertNotCalled(t, "Validate")
	})

	t.Run("returns error for disabled type", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		// Type is registered but not enabled
		enabled := map[provisioning.RepositorySpecType]struct{}{}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		repo := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.RepositorySpecTypeLocal,
			},
		}

		errors := factory.Validate(context.Background(), repo)
		require.Len(t, errors, 1)
		assert.Contains(t, errors[0].Detail, "repository type \"local\" is not enabled")

		localExtra.AssertNotCalled(t, "Validate")
	})

	t.Run("returns empty for non-repository object", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.RepositorySpecTypeLocal)

		enabled := map[provisioning.RepositorySpecType]struct{}{
			provisioning.RepositorySpecTypeLocal: {},
		}
		factory, err := ProvideFactory(enabled, []Extra{localExtra}, noopTracer)
		require.NoError(t, err)

		// Pass a non-repository object
		errors := factory.Validate(context.Background(), &provisioning.Connection{})
		assert.Empty(t, errors)

		localExtra.AssertNotCalled(t, "Validate")
	})
}
