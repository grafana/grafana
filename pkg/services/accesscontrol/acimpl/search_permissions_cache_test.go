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
	const (
		testUserID              int64 = 1
		testOrgID               int64 = 2
		basicRolesFailure             = "basic roles"
		permissionSearchFailure       = "permission search"
	)

	for _, failure := range []string{basicRolesFailure, permissionSearchFailure} {
		t.Run(failure, func(t *testing.T) {
			store := actest.NewMockStore(t)
			roles := map[int64][]string{testUserID: {"None"}}
			options := accesscontrol.SearchOptions{UserID: testUserID, Action: "test:read"}
			permissions := []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}
			service := &Service{
				store: store, cache: localcache.ProvideService(), log: log.New("test"),
				roles: map[string]*accesscontrol.RoleDTO{}, actionResolver: resourcepermissions.NewActionSetService(),
			}

			switch failure {
			case basicRolesFailure:
				store.On("GetUsersBasicRoles", mock.Anything, []int64{testUserID}, testOrgID).Return(nil, assert.AnError).Once()
			case permissionSearchFailure:
				store.On("GetUsersBasicRoles", mock.Anything, []int64{testUserID}, testOrgID).Return(roles, nil).Once()
				store.On("SearchUsersPermissions", mock.Anything, testOrgID, mock.Anything).Return(nil, assert.AnError).Once()
			default:
				t.Fatalf("unsupported failure case: %s", failure)
			}

			got, err := service.SearchUserPermissions(context.Background(), testOrgID, options)
			require.ErrorIs(t, err, assert.AnError)
			require.Nil(t, got)
			require.Empty(t, service.cache.Items())

			store.On("GetUsersBasicRoles", mock.Anything, []int64{testUserID}, testOrgID).Return(roles, nil).Once()
			store.On("SearchUsersPermissions", mock.Anything, testOrgID, mock.Anything).Return(map[int64][]accesscontrol.Permission{testUserID: permissions}, nil).Once()
			for _, phase := range []string{"retry after failure", "cached retry"} {
				t.Run(phase, func(t *testing.T) {
					got, err := service.SearchUserPermissions(context.Background(), testOrgID, options)
					require.NoError(t, err)
					require.Equal(t, permissions, got)
				})
			}

			store.AssertExpectations(t)
		})
	}
}
