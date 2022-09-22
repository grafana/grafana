package dashboards

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewFolderNameScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewFolderNameScopeResolver(&FakeDashboardStore{})
		require.Equal(t, "folders:name:", prefix)
	})

	t.Run("resolver should convert to uid scope", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewFolderNameScopeResolver(dashboardStore)

		orgId := rand.Int63()
		title := "Very complex :title with: and /" + util.GenerateShortUID()

		db := models.NewFolder(title)
		db.Id = rand.Int63()
		db.Uid = util.GenerateShortUID()
		dashboardStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:name:" + title

		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)
		require.Len(t, resolvedScopes, 1)

		require.Equal(t, fmt.Sprintf("folders:uid:%v", db.Uid), resolvedScopes[0])

		dashboardStore.AssertCalled(t, "GetFolderByTitle", mock.Anything, orgId, title)
	})
	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewFolderNameScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewFolderNameScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:name:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewFolderNameScopeResolver(dashboardStore)

		orgId := rand.Int63()
		dashboardStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrDashboardNotFound).Once()

		scope := "folders:name:" + util.GenerateShortUID()

		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewFolderIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewFolderIDScopeResolver(&FakeDashboardStore{})
		require.Equal(t, "folders:id:", prefix)
	})

	t.Run("resolver should convert to uid scope", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewFolderIDScopeResolver(dashboardStore)

		orgId := rand.Int63()
		uid := util.GenerateShortUID()

		db := &models.Folder{Id: rand.Int63(), Uid: uid}
		dashboardStore.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:id:" + strconv.FormatInt(db.Id, 10)

		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)
		require.Len(t, resolvedScopes, 1)
		require.Equal(t, fmt.Sprintf("folders:uid:%v", db.Uid), resolvedScopes[0])

		dashboardStore.AssertCalled(t, "GetFolderByID", mock.Anything, orgId, db.Id)
	})
	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewFolderIDScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert id 0 to general uid scope", func(t *testing.T) {
		var (
			dashboardStore = &FakeDashboardStore{}
			orgId          = rand.Int63()
			scope          = "folders:id:0"
			_, resolver    = NewFolderIDScopeResolver(dashboardStore)
		)

		resolved, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Len(t, resolved, 1)
		require.Equal(t, "folders:uid:general", resolved[0])
	})

	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewFolderIDScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewFolderIDScopeResolver(dashboardStore)

		orgId := rand.Int63()
		dashboardStore.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrDashboardNotFound).Once()

		scope := "folders:id:10"
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewDashboardIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardIDScopeResolver(&FakeDashboardStore{})
		require.Equal(t, "dashboards:id:", prefix)
	})

	t.Run("resolver should convert to uid dashboard and folder scope", func(t *testing.T) {
		store := &FakeDashboardStore{}

		_, resolver := NewDashboardIDScopeResolver(store)

		orgID := rand.Int63()
		folder := &models.Folder{Id: 2, Uid: "2"}
		dashboard := &models.Dashboard{Id: 1, FolderId: folder.Id, Uid: "1"}

		store.On("GetDashboard", mock.Anything, mock.Anything).Return(dashboard, nil).Once()
		store.On("GetFolderByID", mock.Anything, orgID, folder.Id).Return(folder, nil).Once()

		scope := ac.Scope("dashboards", "id", strconv.FormatInt(dashboard.Id, 10))
		resolvedScopes, err := resolver.Resolve(context.Background(), orgID, scope)
		require.NoError(t, err)
		require.Len(t, resolvedScopes, 2)
		require.Equal(t, fmt.Sprintf("dashboards:uid:%s", dashboard.Uid), resolvedScopes[0])
		require.Equal(t, fmt.Sprintf("folders:uid:%s", folder.Uid), resolvedScopes[1])
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardIDScopeResolver(&FakeDashboardStore{})
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert folderID 0 to general uid scope for the folder scope", func(t *testing.T) {
		store := &FakeDashboardStore{}
		_, resolver := NewDashboardIDScopeResolver(store)

		dashboard := &models.Dashboard{Id: 1, FolderId: 0, Uid: "1"}
		store.On("GetDashboard", mock.Anything, mock.Anything).Return(dashboard, nil)
		resolved, err := resolver.Resolve(context.Background(), 1, ac.Scope("dashboards", "id", "1"))
		require.NoError(t, err)

		require.Len(t, resolved, 2)
		require.Equal(t, "dashboards:uid:1", resolved[0])
		require.Equal(t, "folders:uid:general", resolved[1])
	})
}

func TestNewDashboardUIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardUIDScopeResolver(&FakeDashboardStore{})
		require.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resolver should convert to uid dashboard and folder scope", func(t *testing.T) {
		store := &FakeDashboardStore{}
		_, resolver := NewDashboardUIDScopeResolver(store)

		orgID := rand.Int63()
		folder := &models.Folder{Id: 2, Uid: "2"}
		dashboard := &models.Dashboard{Id: 1, FolderId: folder.Id, Uid: "1"}

		store.On("GetDashboard", mock.Anything, mock.Anything).Return(dashboard, nil).Once()
		store.On("GetFolderByID", mock.Anything, orgID, folder.Id).Return(folder, nil).Once()

		scope := ac.Scope("dashboards", "uid", dashboard.Uid)
		resolvedScopes, err := resolver.Resolve(context.Background(), orgID, scope)
		require.NoError(t, err)
		require.Len(t, resolvedScopes, 2)
		require.Equal(t, fmt.Sprintf("dashboards:uid:%s", dashboard.Uid), resolvedScopes[0])
		require.Equal(t, fmt.Sprintf("folders:uid:%s", folder.Uid), resolvedScopes[1])
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardUIDScopeResolver(&FakeDashboardStore{})
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert folderID 0 to general uid scope for the folder scope", func(t *testing.T) {
		store := &FakeDashboardStore{}
		_, resolver := NewDashboardUIDScopeResolver(store)

		dashboard := &models.Dashboard{Id: 1, FolderId: 0, Uid: "1"}
		store.On("GetDashboard", mock.Anything, mock.Anything).Return(dashboard, nil)
		resolved, err := resolver.Resolve(context.Background(), 1, ac.Scope("dashboards", "uid", "1"))
		require.NoError(t, err)

		require.Len(t, resolved, 2)
		require.Equal(t, "dashboards:uid:1", resolved[0])
		require.Equal(t, "folders:uid:general", resolved[1])
	})
}
