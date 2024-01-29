package dashboards

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewFolderNameScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewFolderNameScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())
		require.Equal(t, "folders:name:", prefix)
	})

	t.Run("resolver should convert to uid scope", func(t *testing.T) {
		orgId := rand.Int63()
		title := "Very complex :title with: and /" + util.GenerateShortUID()
		db := &folder.Folder{Title: title, UID: util.GenerateShortUID()}
		folderStore := foldertest.NewFakeFolderStore(t)
		folderStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:name:" + title

		_, resolver := NewFolderNameScopeResolver(folderStore, foldertest.NewFakeService())
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)
		require.Len(t, resolvedScopes, 1)
		require.Equal(t, fmt.Sprintf("folders:uid:%v", db.UID), resolvedScopes[0])
		folderStore.AssertCalled(t, "GetFolderByTitle", mock.Anything, orgId, title, mock.Anything)
	})
	t.Run("resolver should include inherited scopes if any", func(t *testing.T) {
		orgId := rand.Int63()
		title := "Very complex :title with: and /" + util.GenerateShortUID()

		db := &folder.Folder{Title: title, UID: util.GenerateShortUID()}

		folderStore := foldertest.NewFakeFolderStore(t)
		folderStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:name:" + title

		folderSvc := foldertest.NewFakeService()
		folderSvc.ExpectedFolders = []*folder.Folder{
			{
				UID: "parent",
			},
			{
				UID: "grandparent",
			},
		}
		_, resolver := NewFolderNameScopeResolver(folderStore, folderSvc)

		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)
		require.Len(t, resolvedScopes, 3)

		if diff := cmp.Diff([]string{
			fmt.Sprintf("folders:uid:%v", db.UID),
			"folders:uid:parent",
			"folders:uid:grandparent",
		}, resolvedScopes); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		folderStore.AssertCalled(t, "GetFolderByTitle", mock.Anything, orgId, title, mock.Anything)
	})
	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewFolderNameScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		_, resolver := NewFolderNameScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:name:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		folderStore := foldertest.NewFakeFolderStore(t)
		_, resolver := NewFolderNameScopeResolver(folderStore, foldertest.NewFakeService())

		orgId := rand.Int63()
		folderStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrDashboardNotFound).Once()

		scope := "folders:name:" + util.GenerateShortUID()

		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewFolderIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())
		require.Equal(t, "folders:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert id 0 to general uid scope", func(t *testing.T) {
		var (
			orgId       = rand.Int63()
			scope       = "folders:id:0"
			_, resolver = NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())
		)

		resolved, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Len(t, resolved, 1)
		require.Equal(t, "folders:uid:general", resolved[0])
	})

	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		_, resolver := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		folderStore := foldertest.NewFakeFolderStore(t)
		folderStore.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrDashboardNotFound).Once()
		_, resolver := NewFolderIDScopeResolver(folderStore, foldertest.NewFakeService())

		orgId := rand.Int63()
		scope := "folders:id:10"
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewDashboardIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, foldertest.NewFakeService())
		require.Equal(t, "dashboards:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, foldertest.NewFakeService())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}

func TestNewDashboardUIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardUIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, foldertest.NewFakeService())
		require.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardUIDScopeResolver(foldertest.NewFakeFolderStore(t), &FakeDashboardService{}, foldertest.NewFakeService())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}
