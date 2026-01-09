package connection

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestProvideFactory(t *testing.T) {
	t.Run("should create factory with valid extras", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		extra2 := NewMockExtra(t)
		extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
			provisioning.GitlabConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1, extra2})
		require.NoError(t, err)
		require.NotNil(t, factory)
	})

	t.Run("should create factory with empty extras", func(t *testing.T) {
		enabled := map[provisioning.ConnectionType]struct{}{}

		factory, err := ProvideFactory(enabled, []Extra{})
		require.NoError(t, err)
		require.NotNil(t, factory)
	})

	t.Run("should create factory with nil enabled map", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		factory, err := ProvideFactory(nil, []Extra{extra1})
		require.NoError(t, err)
		require.NotNil(t, factory)
	})

	t.Run("should return error when duplicate repository types", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		extra2 := NewMockExtra(t)
		extra2.EXPECT().Type().Return(provisioning.GithubConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1, extra2})
		require.Error(t, err)
		assert.Nil(t, factory)
		assert.Contains(t, err.Error(), "repository type")
		assert.Contains(t, err.Error(), "is already registered")
	})
}

func TestFactory_Types(t *testing.T) {
	t.Run("should return only enabled types that have extras", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		extra2 := NewMockExtra(t)
		extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
			provisioning.GitlabConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1, extra2})
		require.NoError(t, err)

		types := factory.Types()
		assert.Len(t, types, 2)
		assert.Contains(t, types, provisioning.GithubConnectionType)
		assert.Contains(t, types, provisioning.GitlabConnectionType)
	})

	t.Run("should return sorted list of types", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GitlabConnectionType)

		extra2 := NewMockExtra(t)
		extra2.EXPECT().Type().Return(provisioning.GithubConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
			provisioning.GitlabConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1, extra2})
		require.NoError(t, err)

		types := factory.Types()
		assert.Len(t, types, 2)
		// github should come before gitlab alphabetically
		assert.Equal(t, provisioning.GithubConnectionType, types[0])
		assert.Equal(t, provisioning.GitlabConnectionType, types[1])
	})

	t.Run("should return empty list when no types are enabled", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{}

		factory, err := ProvideFactory(enabled, []Extra{extra1})
		require.NoError(t, err)

		types := factory.Types()
		assert.Empty(t, types)
	})

	t.Run("should not return types that are enabled but have no extras", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
			provisioning.GitlabConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1})
		require.NoError(t, err)

		types := factory.Types()
		assert.Len(t, types, 1)
		assert.Contains(t, types, provisioning.GithubConnectionType)
		assert.NotContains(t, types, provisioning.GitlabConnectionType)
	})

	t.Run("should not return types that have extras but are not enabled", func(t *testing.T) {
		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		extra2 := NewMockExtra(t)
		extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1, extra2})
		require.NoError(t, err)

		types := factory.Types()
		assert.Len(t, types, 1)
		assert.Contains(t, types, provisioning.GithubConnectionType)
		assert.NotContains(t, types, provisioning.GitlabConnectionType)
	})

	t.Run("should return empty list when no extras are provided", func(t *testing.T) {
		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{})
		require.NoError(t, err)

		types := factory.Types()
		assert.Empty(t, types)
	})
}

func TestFactory_Build(t *testing.T) {
	t.Run("should successfully build connection when type is enabled and has extra", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
			},
		}

		mockConnection := NewMockConnection(t)
		extra := NewMockExtra(t)
		extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
		extra.EXPECT().Build(ctx, conn).Return(mockConnection, nil)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra})
		require.NoError(t, err)

		result, err := factory.Build(ctx, conn)
		require.NoError(t, err)
		assert.Equal(t, mockConnection, result)
	})

	t.Run("should return error when type is not enabled", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GitlabConnectionType,
			},
		}

		extra := NewMockExtra(t)
		extra.EXPECT().Type().Return(provisioning.GitlabConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra})
		require.NoError(t, err)

		result, err := factory.Build(ctx, conn)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "repository type")
		assert.Contains(t, err.Error(), "is not enabled")
	})

	t.Run("should return error when type is not supported", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GitlabConnectionType,
			},
		}

		extra := NewMockExtra(t)
		extra.EXPECT().Type().Return(provisioning.GithubConnectionType)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra})
		require.NoError(t, err)

		result, err := factory.Build(ctx, conn)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "repository type")
		assert.Contains(t, err.Error(), "is not supported")
	})

	t.Run("should pass through errors from extra.Build()", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
			},
		}

		expectedErr := errors.New("build error")
		extra := NewMockExtra(t)
		extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
		extra.EXPECT().Build(ctx, conn).Return(nil, expectedErr)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra})
		require.NoError(t, err)

		result, err := factory.Build(ctx, conn)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, expectedErr, err)
	})

	t.Run("should build with multiple extras registered", func(t *testing.T) {
		ctx := context.Background()
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GitlabConnectionType,
			},
		}

		mockConnection := NewMockConnection(t)

		extra1 := NewMockExtra(t)
		extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

		extra2 := NewMockExtra(t)
		extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)
		extra2.EXPECT().Build(ctx, conn).Return(mockConnection, nil)

		enabled := map[provisioning.ConnectionType]struct{}{
			provisioning.GithubConnectionType: {},
			provisioning.GitlabConnectionType: {},
		}

		factory, err := ProvideFactory(enabled, []Extra{extra1, extra2})
		require.NoError(t, err)

		result, err := factory.Build(ctx, conn)
		require.NoError(t, err)
		assert.Equal(t, mockConnection, result)
	})
}
