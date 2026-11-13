package resourcepermissions

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestInternalServiceWithoutRoutesOrPermissionCache(t *testing.T) {
	// A nil SQLStore also proves construction does not subscribe to its bus.
	users := &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{UserID: 7}}
	s, err := NewInternal(setting.NewCfg(), Options{
		Resource: "receivers", Assignments: Assignments{Users: true},
		PermissionsToActions: map[string][]string{"Read": {"receivers:read"}},
	},
		featuremgmt.WithFeatures(), nil, nil, nil,
		users,
		NewActionSetService())
	require.NoError(t, err)
	require.Nil(t, s.api)
	require.Nil(t, s.permissionCache)
	s.store = cachePermissionStore{}
	_, err = s.SetUserPermission(t.Context(), 1, accesscontrol.User{ID: 7}, "receiver", "")
	require.NoError(t, err)
	_, err = s.SetPermissions(t.Context(), 1, "receiver", accesscontrol.SetResourcePermissionCommand{UserID: 7})
	require.NoError(t, err)
	_, err = s.SetUserPermission(t.Context(), 1, accesscontrol.User{ID: 7}, "receiver", "Read")
	require.NoError(t, err)
	_, err = s.SetUserPermission(t.Context(), 1, accesscontrol.User{ID: 7}, "receiver", "invalid")
	require.ErrorIs(t, err, ErrInvalidPermission)
	_, err = s.SetUserPermission(t.Context(), 1, accesscontrol.User{ID: 7}, "*", "Read")
	require.ErrorIs(t, err, ErrInvalidResourceID)
	users.ExpectedError = user.ErrUserNotFound
	_, err = s.SetUserPermission(t.Context(), 1, accesscontrol.User{ID: 7}, "receiver", "Read")
	require.ErrorIs(t, err, accesscontrol.ErrAssignmentEntityNotFound)
}

func TestIntegrationPermissionCacheInvalidationAfterCommit(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, bulk := range []bool{false, true} {
		for _, outcome := range []string{"commit", "rollback", "write failure", "standalone"} {
			name := "single/"
			if bulk {
				name = "bulk/"
			}
			t.Run(name+outcome, func(t *testing.T) {
				sql := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())
				failure := errors.New("failed")
				var writeErr error
				if outcome == "write failure" {
					writeErr = failure
				}
				var cleared []identity.Requester
				service, err := New(setting.NewCfg(), Options{Resource: "receivers", Assignments: Assignments{Users: true}},
					featuremgmt.WithFeatures(), routing.NewRouteRegister(), nil, actest.FakeAccessControl{},
					cacheInvalidationService{clear: func(actor identity.Requester) {
						cleared = append(cleared, actor)
					}},
					sql, nil, &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{UserID: 7}},
					nil, NewActionSetService(), iam.Features{})
				require.NoError(t, err)
				service.store = cachePermissionStore{err: writeErr}
				// A second provider on the same bus must ignore this owner's events.
				other := &Service{permissionCache: service.permissionCache}
				sql.Bus().AddEventListener(other.onPermissionCachesInvalidated)
				set := func(ctx context.Context) {
					if bulk {
						commands := []accesscontrol.SetResourcePermissionCommand{{UserID: 7}, {UserID: 7}}
						_, err := service.SetPermissions(ctx, 1, "new", commands...)
						require.ErrorIs(t, err, writeErr)
						// The queued invalidation must not retain the caller's mutable slice.
						commands[0].UserID = 9
						commands[1].UserID = 10
					} else {
						_, err := service.SetUserPermission(ctx, 1, accesscontrol.User{ID: 7}, "new", "")
						require.ErrorIs(t, err, writeErr)
					}
				}
				if outcome == "standalone" {
					set(t.Context())
				} else {
					err := sql.InTransaction(t.Context(), func(ctx context.Context) error {
						set(ctx)
						require.Empty(t, cleared)
						if outcome == "rollback" {
							return failure
						}
						return nil
					})
					if outcome == "rollback" {
						require.ErrorIs(t, err, failure)
					} else {
						require.NoError(t, err)
					}
				}
				if outcome == "commit" || outcome == "standalone" {
					require.Len(t, cleared, 2)
					for _, actor := range cleared {
						id, err := actor.GetInternalID()
						require.NoError(t, err)
						require.Equal(t, int64(7), id)
						require.Equal(t, int64(1), actor.GetOrgID())
					}
					require.False(t, cleared[0].(*user.SignedInUser).IsServiceAccount)
					require.True(t, cleared[1].(*user.SignedInUser).IsServiceAccount)
				} else {
					require.Empty(t, cleared)
				}
			})
		}
	}
}

type cacheInvalidationService struct {
	actest.FakeService
	clear func(identity.Requester)
}

func (s cacheInvalidationService) ClearUserPermissionCache(actor identity.Requester) { s.clear(actor) }

type cachePermissionStore struct {
	Store
	err error
}

func (s cachePermissionStore) SetResourcePermissions(context.Context, int64, []SetResourcePermissionsCommand, ResourceHooks) ([]accesscontrol.ResourcePermission, error) {
	return nil, s.err
}

func (s cachePermissionStore) SetUserResourcePermission(context.Context, int64, accesscontrol.User, SetResourcePermissionCommand, UserResourceHookFunc) (*accesscontrol.ResourcePermission, error) {
	return nil, s.err
}
