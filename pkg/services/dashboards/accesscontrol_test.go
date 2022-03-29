package dashboards

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewNameScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewNameScopeResolver(&FakeDashboardStore{})
		require.Equal(t, "folders:name:", prefix)
	})

	t.Run("resolver should convert to id scope", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewNameScopeResolver(dashboardStore)

		orgId := rand.Int63()
		title := "Very complex :title with: and /" + util.GenerateShortUID()

		db := models.NewFolder(title)
		db.Id = rand.Int63()
		dashboardStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:name:" + title

		resolvedScope, err := resolver(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Equal(t, fmt.Sprintf("folders:id:%v", db.Id), resolvedScope)

		dashboardStore.AssertCalled(t, "GetFolderByTitle", mock.Anything, orgId, title)
	})
	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewNameScopeResolver(dashboardStore)

		_, err := resolver(context.Background(), rand.Int63(), "folders:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewNameScopeResolver(dashboardStore)

		_, err := resolver(context.Background(), rand.Int63(), "folders:name:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewNameScopeResolver(dashboardStore)

		orgId := rand.Int63()
		dashboardStore.On("GetFolderByTitle", mock.Anything, mock.Anything, mock.Anything).Return(nil, models.ErrDashboardNotFound).Once()

		scope := "folders:name:" + util.GenerateShortUID()

		resolvedScope, err := resolver(context.Background(), orgId, scope)
		require.ErrorIs(t, err, models.ErrDashboardNotFound)
		require.Empty(t, resolvedScope)
	})
}

func TestNewUidScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewUidScopeResolver(&FakeDashboardStore{})
		require.Equal(t, "folders:uid:", prefix)
	})

	t.Run("resolver should convert to id scope", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewUidScopeResolver(dashboardStore)

		orgId := rand.Int63()
		uid := util.GenerateShortUID()

		db := &models.Folder{Id: rand.Int63()}
		dashboardStore.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:uid:" + uid

		resolvedScope, err := resolver(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Equal(t, fmt.Sprintf("folders:id:%v", db.Id), resolvedScope)

		dashboardStore.AssertCalled(t, "GetFolderByUID", mock.Anything, orgId, uid)
	})
	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewUidScopeResolver(dashboardStore)

		_, err := resolver(context.Background(), rand.Int63(), "folders:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewUidScopeResolver(dashboardStore)

		_, err := resolver(context.Background(), rand.Int63(), "folders:uid:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}

		_, resolver := NewUidScopeResolver(dashboardStore)

		orgId := rand.Int63()
		dashboardStore.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything).Return(nil, models.ErrDashboardNotFound).Once()

		scope := "folders:uid:" + util.GenerateShortUID()

		resolvedScope, err := resolver(context.Background(), orgId, scope)
		require.ErrorIs(t, err, models.ErrDashboardNotFound)
		require.Empty(t, resolvedScope)
	})
}
