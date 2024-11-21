package dashboards

import (
	"context"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

func TestNewFolderIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), folder.NewFakeStore())
		require.Equal(t, "folders:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), folder.NewFakeStore())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert id 0 to general uid scope", func(t *testing.T) {
		var (
			orgId       = rand.Int63()
			scope       = "folders:id:0"
			_, resolver = NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), folder.NewFakeStore())
		)

		resolved, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Len(t, resolved, 1)
		require.Equal(t, "folders:uid:general", resolved[0])
	})

	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		_, resolver := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), folder.NewFakeStore())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		folderStore := foldertest.NewFakeFolderStore(t)
		folderStore.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrDashboardNotFound).Once()
		_, resolver := NewFolderIDScopeResolver(folderStore, folder.NewFakeStore())

		orgId := rand.Int63()
		scope := "folders:id:10"
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewDashboardIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, folder.NewFakeStore())
		require.Equal(t, "dashboards:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, folder.NewFakeStore())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}

func TestNewDashboardUIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardUIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, folder.NewFakeStore())
		require.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardUIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, folder.NewFakeStore())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}
