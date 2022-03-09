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

		db := &models.Dashboard{Id: rand.Int63()}
		dashboardStore.On("GetFolderByTitle", mock.Anything, mock.Anything).Return(db, nil).Once()

		scope := "folders:name:" + title

		resolvedScope, err := resolver(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Equal(t, fmt.Sprintf("folders:id:%v", db.Id), resolvedScope)
	})

	t.Run("resolver should convert wildcard", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewNameScopeResolver(dashboardStore)

		resolvedScope, err := resolver(context.Background(), rand.Int63(), "folders:name:*")
		require.NoError(t, err)
		require.Equal(t, "folders:id:*", resolvedScope)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		dashboardStore := &FakeDashboardStore{}
		_, resolver := NewNameScopeResolver(dashboardStore)

		_, err := resolver(context.Background(), rand.Int63(), "folders:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}
