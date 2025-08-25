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
		factory := NewFactory([]Extra{})

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
		factory := NewFactory(extras)

		require.NotNil(t, factory)
		types := factory.Types()
		assert.Len(t, types, 3)

		// Convert to set for easier comparison since order is not guaranteed
		typeSet := make(map[provisioning.RepositoryType]bool)
		for _, t := range types {
			typeSet[t] = true
		}

		assert.True(t, typeSet[provisioning.LocalRepositoryType])
		assert.True(t, typeSet[provisioning.GitRepositoryType])
		assert.True(t, typeSet[provisioning.GitHubRepositoryType])

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
	})

	t.Run("overwrites duplicate repository types", func(t *testing.T) {
		mockRepo := &MockConfigRepository{}

		firstExtra := &MockExtra{}
		firstExtra.On("Type").Return(provisioning.LocalRepositoryType)

		secondExtra := &MockExtra{}
		secondExtra.On("Type").Return(provisioning.LocalRepositoryType)
		secondExtra.On("Build", mock.Anything, mock.Anything).Return(mockRepo, nil)

		extras := []Extra{firstExtra, secondExtra}
		factory := NewFactory(extras)

		require.NotNil(t, factory)
		types := factory.Types()
		assert.Len(t, types, 1)
		assert.Equal(t, provisioning.LocalRepositoryType, types[0])

		// Test that the factory uses the last added extra by building a repository
		ctx := context.Background()
		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
			},
		}

		result, err := factory.Build(ctx, repoConfig)
		require.NoError(t, err)
		assert.Equal(t, mockRepo, result)

		// The secondExtra should have been called (since it overwrites firstExtra)
		secondExtra.AssertExpectations(t)
		firstExtra.AssertNotCalled(t, "Build")

		firstExtra.AssertExpectations(t)
	})

	t.Run("handles nil extras slice", func(t *testing.T) {
		factory := NewFactory(nil)

		require.NotNil(t, factory)
		types := factory.Types()
		assert.Empty(t, types)
	})
}

func TestFactory_Types(t *testing.T) {
	t.Run("returns empty slice for factory with no extras", func(t *testing.T) {
		factory := NewFactory([]Extra{})

		types := factory.Types()
		assert.Empty(t, types)
	})

	t.Run("returns all registered repository types", func(t *testing.T) {
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
		factory := NewFactory(extras)

		types := factory.Types()

		assert.Len(t, types, 5)

		// Convert to set for easier comparison since order is not guaranteed
		typeSet := make(map[provisioning.RepositoryType]bool)
		for _, t := range types {
			typeSet[t] = true
		}

		assert.True(t, typeSet[provisioning.LocalRepositoryType])
		assert.True(t, typeSet[provisioning.GitRepositoryType])
		assert.True(t, typeSet[provisioning.GitHubRepositoryType])
		assert.True(t, typeSet[provisioning.BitbucketRepositoryType])
		assert.True(t, typeSet[provisioning.GitLabRepositoryType])

		localExtra.AssertExpectations(t)
		gitExtra.AssertExpectations(t)
		githubExtra.AssertExpectations(t)
		bitbucketExtra.AssertExpectations(t)
		gitlabExtra.AssertExpectations(t)
	})

	t.Run("returns unique types even with duplicate extras", func(t *testing.T) {
		firstExtra := &MockExtra{}
		firstExtra.On("Type").Return(provisioning.LocalRepositoryType)

		secondExtra := &MockExtra{}
		secondExtra.On("Type").Return(provisioning.LocalRepositoryType)

		extras := []Extra{firstExtra, secondExtra}
		factory := NewFactory(extras)

		types := factory.Types()

		assert.Len(t, types, 1)
		assert.Equal(t, provisioning.LocalRepositoryType, types[0])

		firstExtra.AssertExpectations(t)
		secondExtra.AssertExpectations(t)
	})
}

func TestFactory_Build(t *testing.T) {
	t.Run("successfully builds repository with matching type", func(t *testing.T) {
		expectedRepo := &MockConfigRepository{}
		localExtra := &MockExtra{}
		localExtra.On("Type").Return(provisioning.LocalRepositoryType)
		localExtra.On("Build", mock.Anything, mock.Anything).Return(expectedRepo, nil)

		factory := NewFactory([]Extra{localExtra})

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

		factory := NewFactory([]Extra{gitExtra})

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

		factory := NewFactory([]Extra{localExtra})

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

		factory := NewFactory([]Extra{localExtra, gitExtra})

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

		factory := NewFactory([]Extra{localExtra})

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

		factory := NewFactory([]Extra{localExtra})

		repoConfig := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
			},
		}

		_, err := factory.Build(ctx, repoConfig)

		require.NoError(t, err)
		localExtra.AssertExpectations(t)
	})
}

func TestFactory_Implementation(t *testing.T) {
	t.Run("factory implements Factory interface", func(t *testing.T) {
		var _ Factory = NewFactory([]Extra{})
	})

	t.Run("mockExtra implements Extra interface", func(t *testing.T) {
		var _ Extra = &MockExtra{}
	})
}
