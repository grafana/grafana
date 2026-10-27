package resourcepermissions

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/util/testutil"
)

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
				service := &Service{
					options:     Options{Resource: "receivers", Assignments: Assignments{Users: true}},
					features:    featuremgmt.WithFeatures(),
					userService: &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{UserID: 7}},
					store:       cachePermissionStore{err: writeErr},
					service: cacheInvalidationService{clear: func(actor identity.Requester) {
						cleared = append(cleared, actor)
					}},
				}
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
	accesscontrol.Service
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
