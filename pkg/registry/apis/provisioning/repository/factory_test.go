package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestNewFactory(t *testing.T) {
	t.Run("creates factory with empty extras", func(t *testing.T) {
		factory, err := ProvideFactory([]Extra{})

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()
		assert.Empty(t, types)
	})

	t.Run("creates factory with multiple extras", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.GitRepositoryType)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.GitHubRepositoryType)

		extras := []Extra{localExtra, gitExtra, githubExtra}
		factory, err := ProvideFactory(extras)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()
		assert.Len(t, types, 3)

		// Verify stable ordering - types should be sorted alphabetically
		expectedTypes := []provisioning.RepositoryType{
			provisioning.GitRepositoryType,
			provisioning.GitHubRepositoryType,
			provisioning.LocalRepositoryType,
		}
		assert.Equal(t, expectedTypes, types)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})

	t.Run("returns error for duplicate repository types", func(t *testing.T) {
		firstExtra := &MockExtra{}
		firstExtra.On("Type").Return(provisioning.LocalRepositoryType)

		secondExtra := &MockExtra{}
		secondExtra.On("Type").Return(provisioning.LocalRepositoryType)

		extras := []Extra{firstExtra, secondExtra}
		factory, err := ProvideFactory(extras)

		assert.Error(t, err)
		assert.Nil(t, factory)
		assert.Contains(t, err.Error(), "repository type \"local\" is already registered")

		firstExtra.AssertExpectations(t)
		secondExtra.AssertExpectations(t)
	})

	t.Run("returns error for duplicate among multiple different types", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.GitRepositoryType)

		duplicateGitExtra := &MockExtra{}
		duplicateGitExtra.On("Type").Return(provisioning.GitRepositoryType)

		extras := []Extra{localExtra, gitExtra, duplicateGitExtra}
		factory, err := ProvideFactory(extras)

		assert.Error(t, err)
		assert.Nil(t, factory)
		assert.Contains(t, err.Error(), "repository type \"git\" is already registered")

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		duplicateGitExtra.AssertExpectations(t)
	})

	t.Run("handles nil extras slice", func(t *testing.T) {
		factory, err := ProvideFactory(nil)

		require.NoError(t, err)
		require.NotNil(t, factory)
		types := factory.Types()
		assert.Empty(t, types)
	})
}

func TestFactory_Types(t *testing.T) {
	t.Run("returns empty slice for factory with no extras", func(t *testing.T) {
		factory, err := ProvideFactory([]Extra{})

		require.NoError(t, err)
		types := factory.Types()
		assert.Empty(t, types)
	})

	t.Run("returns all registered repository types in stable order", func(t *testing.T) {
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.GitRepositoryType)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.GitHubRepositoryType)

		bitbucketExtra := &MockExtra{}
		bitbucketExtra.On("Type").Return(provisioning.BitbucketRepositoryType)

		gitlabExtra := &MockExtra{}
		gitlabExtra.On("Type").Return(provisioning.GitLabRepositoryType)

		extras := []Extra{localExtra, gitExtra, githubExtra, bitbucketExtra, gitlabExtra}
		factory, err := ProvideFactory(extras)

		require.NoError(t, err)
		types := factory.Types()

		assert.Len(t, types, 5)

		// Verify stable ordering - types should be sorted alphabetically
		expectedTypes := []provisioning.RepositoryType{
			provisioning.BitbucketRepositoryType,
			provisioning.GitRepositoryType,
			provisioning.GitHubRepositoryType,
			provisioning.GitLabRepositoryType,
			provisioning.LocalRepositoryType,
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
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.GitRepositoryType)

		githubExtra := &MockExtra{}
		githubExtra.On("Type").Return(provisioning.GitHubRepositoryType)

		extras := []Extra{githubExtra, localExtra, gitExtra} // Intentionally unordered
		factory, err := ProvideFactory(extras)

		require.NoError(t, err)
		types1 := factory.Types()
		types2 := factory.Types()
		types3 := factory.Types()

		// All calls should return the same order
		assert.Equal(t, types1, types2)
		assert.Equal(t, types2, types3)

		// Verify the order is alphabetical
		expectedTypes := []provisioning.RepositoryType{
			provisioning.GitRepositoryType,
			provisioning.GitHubRepositoryType,
			provisioning.LocalRepositoryType,
		}
		assert.Equal(t, expectedTypes, types1)

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})
}

func TestFactory_Build(t *testing.T) {
	t.Run("successfully builds repository with matching type", func(t *testing.T) {
		expectedRepo := &MockConfigRepository{}
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)
		localExtra.On("Build", mock.Anything, mock.Anything).Return(expectedRepo, nil)

		factory, err := ProvideFactory([]Extra{localExtra})
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
			},
		}

		result, err := factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		assert.Equal(t, expectedRepo, result)
		localExtra.AssertExpectations(t)
	})

	t.Run("returns error for unsupported repository type", func(t *testing.T) {
		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.GitRepositoryType)

		factory, err := ProvideFactory([]Extra{gitExtra})
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType, // Different from registered type
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
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)
		localExtra.On("Build", mock.Anything, mock.Anything).Return(nil, expectedError)

		factory, err := ProvideFactory([]Extra{localExtra})
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
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
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		gitExtra := &MockExtra{}
		gitExtra.On("Type").Return(provisioning.GitRepositoryType)
		gitExtra.On("Build", mock.Anything, mock.Anything).Return(gitRepo, nil)

		factory, err := ProvideFactory([]Extra{localExtra, gitExtra})
		require.NoError(t, err)

		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
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
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		factory, err := ProvideFactory([]Extra{localExtra})
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
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)

		// Create context with value to verify it's passed through
		type testKey string
		ctx := context.WithValue(context.Background(), testKey("test"), "value")

		// Use a custom matcher to verify the context is passed correctly
		localExtra.On("Build", mock.MatchedBy(func(c context.Context) bool {
			return c.Value(testKey("test")) == "value"
		}), mock.Anything).Return(localRepo, nil)

		factory, err := ProvideFactory([]Extra{localExtra})
		require.NoError(t, err)

		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
			},
		}

		_, err = factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		localExtra.AssertExpectations(t)
	})
}
