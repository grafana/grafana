package acimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
)

func TestSearchUserPermissions_FailureDoesNotPopulateCache(t *testing.T) {
	for _, failure := range []string{"basic roles", "permission search"} {
		t.Run(failure, func(t *testing.T) {
			store := actest.NewMockStore(t)
			roles := map[int64][]string{1: {"None"}}
			options := accesscontrol.SearchOptions{UserID: 1, Action: "test:read"}
			permissions := []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}
			service := &Service{
				store: store, cache: localcache.ProvideService(), log: log.New("test"),
				roles: map[string]*accesscontrol.RoleDTO{}, actionResolver: resourcepermissions.NewActionSetService(),
			}
			if failure == "basic roles" {
				store.On("GetUsersBasicRoles", mock.Anything, []int64{1}, int64(2)).Return(nil, assert.AnError).Once()
			} else {
				store.On("GetUsersBasicRoles", mock.Anything, []int64{1}, int64(2)).Return(roles, nil).Once()
				store.On("SearchUsersPermissions", mock.Anything, int64(2), mock.Anything).Return(nil, assert.AnError).Once()
			}
			got, err := service.SearchUserPermissions(context.Background(), 2, options)
			require.ErrorIs(t, err, assert.AnError)
			require.Nil(t, got)
			require.Empty(t, service.cache.Items())

			store.On("GetUsersBasicRoles", mock.Anything, []int64{1}, int64(2)).Return(roles, nil).Once()
			store.On("SearchUsersPermissions", mock.Anything, int64(2), mock.Anything).Return(map[int64][]accesscontrol.Permission{1: permissions}, nil).Once()
			for range 2 {
				got, err = service.SearchUserPermissions(context.Background(), 2, options)
				require.NoError(t, err)
				require.Equal(t, permissions, got)
			}
			store.AssertExpectations(t)
		})
	}
}
