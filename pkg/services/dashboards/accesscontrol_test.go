package dashboards_test

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
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewFolderNameScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := dashboards.NewFolderNameScopeResolver(&dashboards.FakeDashboardStore{})
		require.Equal(t, "folders:name:", prefix)
	})

	t.Run("resolver should convert to uid scope", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}

		_, resolver := dashboards.NewFolderNameScopeResolver(dashboardStore)

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
		dashboardStore := &dashboards.FakeDashboardStore{}
		_, resolver := dashboards.NewFolderNameScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}
		_, resolver := dashboards.NewFolderNameScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:name:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}

		_, resolver := dashboards.NewFolderNameScopeResolver(dashboardStore)

		orgId := rand.Int63()
		dashboardStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything).Return(nil, models.ErrDashboardNotFound).Once()
		scope := "folders:name:" + util.GenerateShortUID()
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, models.ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewFolderIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := dashboards.NewFolderIDScopeResolver(&dashboards.FakeDashboardStore{})
		require.Equal(t, "folders:id:", prefix)
	})

	t.Run("resolver should convert to uid scope", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}

		_, resolver := dashboards.NewFolderIDScopeResolver(dashboardStore)

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
		dashboardStore := &dashboards.FakeDashboardStore{}
		_, resolver := dashboards.NewFolderIDScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert id 0 to general uid scope", func(t *testing.T) {
		var (
			dashboardStore = &dashboards.FakeDashboardStore{}
			orgId          = rand.Int63()
			scope          = "folders:id:0"
			_, resolver    = dashboards.NewFolderIDScopeResolver(dashboardStore)
		)

		resolved, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)
		require.Len(t, resolved, 1)
		require.Equal(t, "folders:uid:general", resolved[0])
	})

	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}
		_, resolver := dashboards.NewFolderIDScopeResolver(dashboardStore)

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		dashboardStore := &dashboards.FakeDashboardStore{}

		_, resolver := dashboards.NewFolderIDScopeResolver(dashboardStore)

		orgId := rand.Int63()
		dashboardStore.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(nil, models.ErrDashboardNotFound).Once()
		scope := "folders:id:10"
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, models.ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewDashboardIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := dashboards.NewDashboardIDScopeResolver(&dashboards.FakeDashboardStore{})
		require.Equal(t, "dashboards:id:", prefix)
	})

	t.Run("resolver should convert to uid dashboard and general folder scopes", func(t *testing.T) {
		store := &dashboards.FakeDashboardStore{}
		store.On("GetDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{Uid: "dash"}, nil)

		_, resolver := dashboards.NewDashboardIDScopeResolver(store)

		scopes, err := resolver.Resolve(context.Background(), 1, "dashboards:id:1")
		require.NoError(t, err)
		require.Len(t, scopes, 2)
		require.Equal(t, "dashboards:uid:dash", scopes[0])
		require.Equal(t, "folders:uid:general", scopes[1])
	})

	t.Run("resolver should convert to uid dashboard and folder scopes", func(t *testing.T) {
		store := &dashboards.FakeDashboardStore{}
		store.On("GetDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{Uid: "dash", FolderId: 1}, nil)
		store.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(&models.Folder{Uid: "folder"}, nil)

		_, resolver := dashboards.NewDashboardUIDScopeResolver(store)

		scopes, err := resolver.Resolve(context.Background(), 1, "dashboards:uid:dash")
		require.NoError(t, err)
		require.Len(t, scopes, 2)
		require.Equal(t, "dashboards:uid:dash", scopes[0])
		require.Equal(t, "folders:uid:folder", scopes[1])
	})
}

func TestNewDashboardUIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := dashboards.NewDashboardUIDScopeResolver(&dashboards.FakeDashboardStore{})
		require.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resolver should convert to uid dashboard and general folder scopes", func(t *testing.T) {
		store := &dashboards.FakeDashboardStore{}
		store.On("GetDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{Uid: "dash"}, nil)

		_, resolver := dashboards.NewDashboardUIDScopeResolver(store)

		scopes, err := resolver.Resolve(context.Background(), 1, "dashboards:uid:dash")
		require.NoError(t, err)
		require.Len(t, scopes, 2)
		require.Equal(t, "dashboards:uid:dash", scopes[0])
		require.Equal(t, "folders:uid:general", scopes[1])
	})

	t.Run("resolver should convert to uid dashboard and folder scopes", func(t *testing.T) {
		store := &dashboards.FakeDashboardStore{}
		store.On("GetDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{Uid: "dash", FolderId: 1}, nil)
		store.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(&models.Folder{Uid: "folder"}, nil)

		_, resolver := dashboards.NewDashboardUIDScopeResolver(store)

		scopes, err := resolver.Resolve(context.Background(), 1, "dashboards:uid:dash")
		require.NoError(t, err)
		require.Len(t, scopes, 2)
		require.Equal(t, "dashboards:uid:dash", scopes[0])
		require.Equal(t, "folders:uid:folder", scopes[1])
	})
}
