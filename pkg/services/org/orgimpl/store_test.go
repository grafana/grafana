package orgimpl

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/playlist/playlistimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationOrgDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	orgStore := sqlStore{
		db:      ss,
		dialect: ss.GetDialect(),
		log:     log.NewNopLogger(),
	}

	t.Run("org not found", func(t *testing.T) {
		_, err := orgStore.Get(context.Background(), 1)
		require.Error(t, err, org.ErrOrgNotFound)
	})

	t.Run("org inserted", func(t *testing.T) {
		_, err := orgStore.Insert(context.Background(), &org.Org{
			Version: 1,
			Name:    "test1",
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)
	})

	t.Run("insert with org name taken", func(t *testing.T) {
		_, err := orgStore.Insert(context.Background(), &org.Org{
			Version: 1,
			Name:    "test1",
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.Error(t, err, org.ErrOrgNameTaken)
	})

	t.Run("org inserted with next available org ID", func(t *testing.T) {
		orgID, err := orgStore.Insert(context.Background(), &org.Org{
			ID:      55,
			Version: 1,
			Name:    "test2",
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)
		_, err = orgStore.Get(context.Background(), orgID)
		require.NoError(t, err)
	})

	t.Run("update with org name taken", func(t *testing.T) {
		err := orgStore.Update(context.Background(), &org.UpdateOrgCommand{
			OrgId: 55,
			Name:  "test1",
		})
		require.Error(t, err, org.ErrOrgNameTaken)
	})

	t.Run("delete by user", func(t *testing.T) {
		err := orgStore.DeleteUserFromAll(context.Background(), 1)
		require.NoError(t, err)
	})

	t.Run("Update org address", func(t *testing.T) {
		// make sure ac2 has no org
		ac2 := &org.Org{ID: 21, Name: "name", Version: 1, Created: time.Now(), Updated: time.Now()}
		_, err := orgStore.Insert(context.Background(), ac2)
		require.NoError(t, err)
		err = orgStore.UpdateAddress(context.Background(), &org.UpdateOrgAddressCommand{
			OrgID: ac2.ID,
			Address: org.Address{
				Address1: "address1",
				Address2: "address2",
				City:     "city",
				ZipCode:  "zip",
				State:    "state",
				Country:  "country",
			},
		})
		require.NoError(t, err)
		orga, err := orgStore.Get(context.Background(), ac2.ID)
		require.NoError(t, err)
		require.Equal(t, "address1", orga.Address1)
	})

	t.Run("Removing org", func(t *testing.T) {
		// make sure ac2 has no org
		ac2 := &org.Org{ID: 22, Name: "ac2", Version: 1, Created: time.Now(), Updated: time.Now()}
		orgId, err := orgStore.Insert(context.Background(), ac2)
		require.NoError(t, err)

		// Create some org-scoped items like playlists, so we can assert that they
		// are cleaned up on delete.
		plItems := []playlist.PlaylistItem{
			{
				Type: "foo",
			},
		}
		plStore := playlistimpl.ProvideService(ss, tracing.InitializeTracerForTest())
		plCreateCommand := playlist.CreatePlaylistCommand{
			OrgId: orgId,
			Name:  "test",
			Items: plItems,
		}
		pl, err := plStore.Create(context.Background(), &plCreateCommand)
		require.NoError(t, err)

		err = orgStore.Delete(context.Background(), &org.DeleteOrgCommand{ID: ac2.ID})
		require.NoError(t, err)

		plDTO, err := plStore.Get(context.Background(), &playlist.GetPlaylistByUidQuery{OrgId: pl.OrgId, UID: pl.UID})
		require.Error(t, err)
		require.Nil(t, plDTO)

		// TODO: this part of the test will be added when we move RemoveOrgUser to org store
		// "Removing user from org should delete user completely if in no other org"
		// // remove ac2 user from ac1 org
		// remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgID, UserId: ac2.ID, ShouldDeleteOrphanedUser: true}
		// err = orgStore.RemoveOrgUser(context.Background(), &remCmd)
		// require.NoError(t, err)
		// require.True(t, remCmd.UserWasDeleted)

		// err = orgStore.GetSignedInUser(context.Background(), &models.GetSignedInUserQuery{UserId: ac2.ID})
		// require.Equal(t, err, user.ErrUserNotFound)
	})

	t.Run("Given we have organizations, we can query them by IDs", func(t *testing.T) {
		var err error
		var cmd *org.CreateOrgCommand
		ids := []int64{}

		for i := 1; i < 4; i++ {
			cmd = &org.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
			result, err := orgStore.CreateWithMember(context.Background(), cmd)
			require.NoError(t, err)

			ids = append(ids, result.ID)
		}

		query := &org.SearchOrgsQuery{IDs: ids}
		result, err := orgStore.Search(context.Background(), query)
		require.NoError(t, err)
		assert.Equal(t, 3, len(result))
	})

	t.Run("Given we have organizations, we can limit and paginate search", func(t *testing.T) {
		ss = db.InitTestDB(t)
		for i := 1; i < 4; i++ {
			cmd := &org.CreateOrgCommand{Name: fmt.Sprint("Orga #", i)}
			_, err := orgStore.CreateWithMember(context.Background(), cmd)
			require.NoError(t, err)
		}

		t.Run("Should be able to search with defaults", func(t *testing.T) {
			query := &org.SearchOrgsQuery{}
			result, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			assert.Equal(t, 3, len(result))
		})

		t.Run("Should be able to limit search", func(t *testing.T) {
			query := &org.SearchOrgsQuery{Limit: 1}
			result, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			assert.Equal(t, 1, len(result))
		})

		t.Run("Should be able to limit and paginate search", func(t *testing.T) {
			query := &org.SearchOrgsQuery{Limit: 2, Page: 1}
			result, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			assert.Equal(t, 1, len(result))
		})

		t.Run("Get org by ID", func(t *testing.T) {
			query := &org.GetOrgByIDQuery{ID: 1}
			result, err := orgStore.GetByID(context.Background(), query)

			require.NoError(t, err)
			assert.Equal(t, "Orga #1", result.Name)
		})

		t.Run("Get org by handler name", func(t *testing.T) {
			query := &org.GetOrgByNameQuery{Name: "Orga #1"}
			result, err := orgStore.GetByName(context.Background(), query)

			require.NoError(t, err)
			assert.Equal(t, int64(1), result.ID)
		})
	})

	t.Run("Testing Account DB Access", func(t *testing.T) {
		ss := db.InitTestDB(t)
		orgStore = sqlStore{
			db:      ss,
			dialect: ss.GetDialect(),
		}
		ids := []int64{}

		for i := 1; i < 4; i++ {
			cmd := &org.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
			res, err := orgStore.CreateWithMember(context.Background(), cmd)
			require.NoError(t, err)
			ids = append(ids, res.ID)
		}

		t.Run("Given we have organizations, we can query them by IDs", func(t *testing.T) {
			query := &org.SearchOrgsQuery{IDs: ids}
			queryResult, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(queryResult), 3)
		})

		t.Run("Should be able to search with defaults", func(t *testing.T) {
			query := &org.SearchOrgsQuery{}
			queryResult, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(queryResult), 3)
		})

		t.Run("Should be able to limit search", func(t *testing.T) {
			query := &org.SearchOrgsQuery{Limit: 1}
			queryResult, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(queryResult), 1)
		})

		t.Run("Should be able to limit and paginate search", func(t *testing.T) {
			query := &org.SearchOrgsQuery{Limit: 2, Page: 1}
			queryResult, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(queryResult), 1)
		})
	})
}

func TestIntegrationOrgUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	orgUserStore := sqlStore{
		db:      ss,
		dialect: ss.GetDialect(),
		log:     log.NewNopLogger(),
	}

	t.Run("org user inserted", func(t *testing.T) {
		_, err := orgUserStore.InsertOrgUser(context.Background(), &org.OrgUser{
			ID:      1,
			OrgID:   1,
			UserID:  1,
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)
	})

	t.Run("delete by user", func(t *testing.T) {
		err := orgUserStore.DeleteUserFromAll(context.Background(), 1)
		require.NoError(t, err)
	})

	// TODO: these test will be added when store will be CRUD
	// t.Run("Given single org mode", func(t *testing.T) {
	// 	sqlStore.Cfg.AutoAssignOrg = true
	// 	sqlStore.Cfg.AutoAssignOrgId = 1
	// 	sqlStore.Cfg.AutoAssignOrgRole = "Viewer"

	// 	t.Run("Users should be added to default organization", func(t *testing.T) {
	// 		ac1cmd := user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
	// 		ac2cmd := user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

	// 		ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
	// 		require.NoError(t, err)
	// 		ac2, err := sqlStore.CreateUser(context.Background(), ac2cmd)
	// 		require.NoError(t, err)

	// 		q1 := models.GetUserOrgListQuery{UserId: ac1.ID}
	// 		q2 := models.GetUserOrgListQuery{UserId: ac2.ID}
	// 		err = sqlStore.GetUserOrgList(context.Background(), &q1)
	// 		require.NoError(t, err)
	// 		err = sqlStore.GetUserOrgList(context.Background(), &q2)
	// 		require.NoError(t, err)

	// 		require.Equal(t, q1.Result[0].OrgId, q2.Result[0].OrgId)
	// 		require.Equal(t, string(q1.Result[0].Role), "Viewer")
	// 	})
	// })

	// t.Run("Can get user organizations", func(t *testing.T) {
	// 	query := models.GetUserOrgListQuery{UserId: ac2.ID}
	// 	err := sqlStore.GetUserOrgList(context.Background(), &query)

	// 	require.NoError(t, err)
	// 	require.Equal(t, len(query.Result), 2)
	// })

	t.Run("Update org users", func(t *testing.T) {
		_, err := orgUserStore.InsertOrgUser(context.Background(), &org.OrgUser{
			ID:      1,
			OrgID:   1,
			UserID:  1,
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)

		cmd := &org.UpdateOrgUserCommand{
			Role:   org.RoleAdmin,
			UserID: 1,
			OrgID:  1,
		}
		err = orgUserStore.UpdateOrgUser(context.Background(), cmd)
		require.NoError(t, err)
	})
	t.Run("GetOrgUsers and UpdateOrgUsers", func(t *testing.T) {
		ss, cfg := db.InitTestDBWithCfg(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, cfg)
		ac1cmd := &user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
		ac2cmd := &user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}
		ac1, err := usrSvc.Create(context.Background(), ac1cmd)
		require.NoError(t, err)
		ac2, err := usrSvc.Create(context.Background(), ac2cmd)
		require.NoError(t, err)
		cmd := org.AddOrgUserCommand{
			OrgID:  ac1.OrgID,
			UserID: ac2.ID,
			Role:   org.RoleViewer,
		}

		err = orgUserStore.AddOrgUser(context.Background(), &cmd)
		require.NoError(t, err)

		t.Run("Can update org user role", func(t *testing.T) {
			updateCmd := org.UpdateOrgUserCommand{OrgID: ac1.OrgID, UserID: ac2.ID, Role: org.RoleAdmin}
			err = orgUserStore.UpdateOrgUser(context.Background(), &updateCmd)
			require.NoError(t, err)

			orgUsersQuery := org.SearchOrgUsersQuery{
				OrgID: ac1.OrgID,
				User: &user.SignedInUser{
					OrgID:       ac1.OrgID,
					Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &orgUsersQuery)
			require.NoError(t, err)

			require.EqualValues(t, result.OrgUsers[1].Role, org.RoleAdmin)
		})
		t.Run("Can get organization users", func(t *testing.T) {
			query := org.SearchOrgUsersQuery{
				OrgID: ac1.OrgID,
				User: &user.SignedInUser{
					OrgID:       ac1.OrgID,
					Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, len(result.OrgUsers), 2)
			require.Equal(t, result.OrgUsers[0].Role, "Admin")
		})

		t.Run("Can get organization users with query", func(t *testing.T) {
			query := org.SearchOrgUsersQuery{
				OrgID: ac1.OrgID,
				Query: "AC1", // Use different-case to test case-insensitive search
				User: &user.SignedInUser{
					OrgID:       ac1.OrgID,
					Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, len(result.OrgUsers), 1)
			require.Equal(t, result.OrgUsers[0].Email, ac1.Email)
		})
		t.Run("Can get organization users with query and limit", func(t *testing.T) {
			query := org.SearchOrgUsersQuery{
				OrgID: ac1.OrgID,
				Query: "aC", // Use mixed-case to test case-insensitive search
				Limit: 1,
				User: &user.SignedInUser{
					OrgID:       ac1.OrgID,
					Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, len(result.OrgUsers), 1)
			require.Equal(t, result.OrgUsers[0].Email, ac1.Email)
		})
		t.Run("Can get organization users with custom ordering login-asc", func(t *testing.T) {
			sortOpts, err := sortopts.ParseSortQueryParam("login-asc,email-asc")
			require.NoError(t, err)
			query := org.SearchOrgUsersQuery{
				OrgID:    ac1.OrgID,
				SortOpts: sortOpts,
				User: &user.SignedInUser{
					OrgID:       ac1.OrgID,
					Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, len(result.OrgUsers), 2)
			require.Equal(t, result.OrgUsers[0].Email, ac1.Email)
			require.Equal(t, result.OrgUsers[1].Email, ac2.Email)
		})
		t.Run("Can get organization users with custom ordering login-desc", func(t *testing.T) {
			sortOpts, err := sortopts.ParseSortQueryParam("login-desc,email-asc")
			require.NoError(t, err)
			query := org.SearchOrgUsersQuery{
				OrgID:    ac1.OrgID,
				SortOpts: sortOpts,
				User: &user.SignedInUser{
					OrgID:       ac1.OrgID,
					Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, len(result.OrgUsers), 2)
			require.Equal(t, result.OrgUsers[0].Email, ac2.Email)
			require.Equal(t, result.OrgUsers[1].Email, ac1.Email)
		})
		t.Run("Cannot update role so no one is admin user", func(t *testing.T) {
			remCmd := org.RemoveOrgUserCommand{OrgID: ac1.OrgID, UserID: ac2.ID, ShouldDeleteOrphanedUser: true}
			err := orgUserStore.RemoveOrgUser(context.Background(), &remCmd)
			require.NoError(t, err)
			cmd := org.UpdateOrgUserCommand{OrgID: ac1.OrgID, UserID: ac1.ID, Role: org.RoleViewer}
			err = orgUserStore.UpdateOrgUser(context.Background(), &cmd)
			require.Equal(t, org.ErrLastOrgAdmin, err)
		})

		t.Run("Removing user from org should delete user completely if in no other org", func(t *testing.T) {
			// make sure ac2 has no org
			err := orgUserStore.Delete(context.Background(), &org.DeleteOrgCommand{ID: ac2.OrgID})
			require.NoError(t, err)

			// make sure ac2 is in ac1 org
			cmd := org.AddOrgUserCommand{
				OrgID:  ac1.OrgID,
				UserID: ac2.ID,
				Role:   org.RoleViewer,
			}
			err = orgUserStore.AddOrgUser(context.Background(), &cmd)
			require.NoError(t, err)

			// remove ac2 user from ac1 org
			remCmd := org.RemoveOrgUserCommand{OrgID: ac1.OrgID, UserID: ac2.ID, ShouldDeleteOrphanedUser: true}
			err = orgUserStore.RemoveOrgUser(context.Background(), &remCmd)
			require.NoError(t, err)
			require.True(t, remCmd.UserWasDeleted)
		})

		t.Run("Cannot delete last admin org user", func(t *testing.T) {
			cmd := org.RemoveOrgUserCommand{OrgID: ac1.OrgID, UserID: ac1.ID}
			err := orgUserStore.RemoveOrgUser(context.Background(), &cmd)
			require.Equal(t, err, org.ErrLastOrgAdmin)
		})
	})

	t.Run("Given single org and 2 users inserted", func(t *testing.T) {
		ss, cfg := db.InitTestDBWithCfg(t)
		cfg.AutoAssignOrg = true
		cfg.AutoAssignOrgId = 1
		cfg.AutoAssignOrgRole = "Viewer"

		orgSvc, usrSvc := createOrgAndUserSvc(t, ss, cfg)

		testUser := &user.SignedInUser{
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionOrgUsersRead: []string{accesscontrol.ScopeUsersAll}},
			},
		}

		o, err := orgSvc.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
		require.NoError(t, err)

		ac1cmd := &user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name", OrgID: o.ID}
		ac2cmd := &user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", OrgID: o.ID}

		ac1, err := usrSvc.Create(context.Background(), ac1cmd)
		require.NoError(t, err)
		testUser.OrgID = ac1.OrgID
		require.Equal(t, int64(1), ac1.OrgID)
		require.NoError(t, err)

		ac2, err := usrSvc.Create(context.Background(), ac2cmd)
		require.Equal(t, int64(1), ac2.OrgID)
		require.NoError(t, err)

		t.Run("Can get organization users paginated with query", func(t *testing.T) {
			query := org.SearchOrgUsersQuery{
				OrgID: ac1.OrgID,
				Page:  1,
				User:  testUser,
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)
			require.NoError(t, err)
			require.Equal(t, 2, len(result.OrgUsers))
		})

		t.Run("Can get organization users paginated and limited", func(t *testing.T) {
			query := org.SearchOrgUsersQuery{
				OrgID: ac1.OrgID,
				Limit: 1,
				Page:  1,
				User:  testUser,
			}
			result, err := orgUserStore.SearchOrgUsers(context.Background(), &query)
			require.NoError(t, err)
			require.Equal(t, 1, len(result.OrgUsers))
		})
	})
}

// This test will be refactore after the CRUD store  refactor
func TestIntegrationSQLStore_AddOrgUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store, cfg := db.InitTestDBWithCfg(t)
	defer func() {
		cfg.AutoAssignOrg, cfg.AutoAssignOrgId, cfg.AutoAssignOrgRole = false, 0, ""
	}()
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1
	cfg.AutoAssignOrgRole = "Viewer"
	orgUserStore := sqlStore{
		db:      store,
		dialect: store.GetDialect(),
		log:     log.NewNopLogger(),
	}
	orgSvc, usrSvc := createOrgAndUserSvc(t, store, cfg)

	o, err := orgSvc.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
	require.NoError(t, err)

	// create org and admin
	u, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login: "admin",
		OrgID: o.ID,
	})
	require.NoError(t, err)

	// create a service account with no org
	sa, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:            "sa-no-org",
		IsServiceAccount: true,
		SkipOrgSetup:     true,
	})
	require.NoError(t, err)
	require.Equal(t, int64(-1), sa.OrgID)

	// assign the sa to the org but without the override. should fail
	err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
		Role:   "Viewer",
		OrgID:  u.OrgID,
		UserID: sa.ID,
	})
	require.Error(t, err)

	// assign the sa to the org with the override. should succeed
	err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
		Role:                      "Viewer",
		OrgID:                     u.OrgID,
		UserID:                    sa.ID,
		AllowAddingServiceAccount: true,
	})

	require.NoError(t, err)

	// assert the org has been correctly set
	saFound := new(user.User)
	err = store.WithDbSession(context.Background(), func(sess *db.Session) error {
		has, err := sess.ID(sa.ID).Get(saFound)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})

	require.NoError(t, err)
	require.Equal(t, saFound.OrgID, u.OrgID)
}

func TestIntegration_SQLStore_GetOrgUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store, cfg := db.InitTestDBWithCfg(t)
	orgUserStore := sqlStore{
		db:      store,
		dialect: store.GetDialect(),
		log:     log.NewNopLogger(),
	}
	cfg.IsEnterprise = true
	defer func() {
		cfg.IsEnterprise = false
	}()

	orgSvc, userSvc := createOrgAndUserSvc(t, store, cfg)

	o, err := orgSvc.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
	require.NoError(t, err)

	seedOrgUsers(t, &orgUserStore, 10, userSvc, o.ID)

	tests := []struct {
		desc             string
		query            *org.SearchOrgUsersQuery
		expectedNumUsers int
	}{
		{
			desc: "should return all users",
			query: &org.SearchOrgUsersQuery{
				OrgID: o.ID,
				User: &user.SignedInUser{
					OrgID:       o.ID,
					Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no users",
			query: &org.SearchOrgUsersQuery{
				OrgID: o.ID,
				User: &user.SignedInUser{
					OrgID:       o.ID,
					Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some users",
			query: &org.SearchOrgUsersQuery{
				OrgID: o.ID,
				User: &user.SignedInUser{
					OrgID: o.ID,
					Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {
						"users:id:1",
						"users:id:5",
						"users:id:9",
					}}},
				},
			},
			expectedNumUsers: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			result, err := orgUserStore.SearchOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			require.Len(t, result.OrgUsers, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.User, accesscontrol.ActionOrgUsersRead) {
				for _, u := range result.OrgUsers {
					assert.Contains(t, tt.query.User.GetPermissions()[accesscontrol.ActionOrgUsersRead], fmt.Sprintf("users:id:%d", u.UserID))
				}
			}
		})
	}
}

func seedOrgUsers(t *testing.T, orgUserStore store, numUsers int, usrSvc user.Service, orgID int64) {
	t.Helper()

	// Seed users
	for i := 1; i <= numUsers; i++ {
		user, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Login: fmt.Sprintf("user-%d", i),
		})
		require.NoError(t, err)

		role := org.RoleViewer
		if i == 1 {
			role = org.RoleAdmin
		}

		err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
			Role:   role,
			OrgID:  orgID,
			UserID: user.ID,
		})
		require.NoError(t, err)
	}
}

func hasWildcardScope(user identity.Requester, action string) bool {
	for _, scope := range user.GetPermissions()[action] {
		if strings.HasSuffix(scope, ":*") {
			return true
		}
	}
	return false
}

func TestIntegration_SQLStore_GetOrgUsers_PopulatesCorrectly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	// The millisecond part is not stored in the DB
	constNow := time.Date(2022, 8, 17, 20, 34, 58, 0, time.UTC)
	userimpl.MockTimeNow(constNow)
	defer userimpl.ResetTimeNow()

	store, cfg := db.InitTestDBWithCfg(t, sqlstore.InitTestDBOpt{})
	orgUserStore := sqlStore{
		db:      store,
		dialect: store.GetDialect(),
		log:     log.NewNopLogger(),
	}
	_, usrSvc := createOrgAndUserSvc(t, store, cfg)

	id, err := orgUserStore.Insert(context.Background(),
		&org.Org{
			ID:      1,
			Created: constNow,
			Updated: constNow,
		})
	require.NoError(t, err)

	newUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:      "Viewer",
		Email:      "viewer@localhost",
		OrgID:      id,
		IsDisabled: true,
		Name:       "Viewer Localhost",
	})
	require.NoError(t, err)

	err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
		Role:   "Viewer",
		OrgID:  1,
		UserID: newUser.ID,
	})
	require.NoError(t, err)

	query := &org.SearchOrgUsersQuery{
		OrgID:  1,
		UserID: newUser.ID,
		User: &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
		},
	}
	result, err := orgUserStore.SearchOrgUsers(context.Background(), query)
	require.NoError(t, err)
	require.Len(t, result.OrgUsers, 1)

	actual := result.OrgUsers[0]
	assert.Equal(t, int64(1), actual.OrgID)
	assert.Equal(t, int64(1), actual.UserID)
	assert.Equal(t, "viewer@localhost", actual.Email)
	assert.Equal(t, "Viewer Localhost", actual.Name)
	assert.Equal(t, "viewer", actual.Login)
	assert.Equal(t, "Viewer", actual.Role)
	assert.Equal(t, constNow.AddDate(-10, 0, 0), actual.LastSeenAt)
	assert.Equal(t, constNow, actual.Created)
	assert.Equal(t, constNow, actual.Updated)
	assert.Equal(t, true, actual.IsDisabled)
}

func TestIntegration_SQLStore_SearchOrgUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store, cfg := db.InitTestDBWithCfg(t, sqlstore.InitTestDBOpt{})
	orgUserStore := sqlStore{
		db:      store,
		dialect: store.GetDialect(),
		log:     log.NewNopLogger(),
	}
	// orgUserStore.cfg.Skip
	orgSvc, userSvc := createOrgAndUserSvc(t, store, cfg)

	o, err := orgSvc.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
	require.NoError(t, err)

	seedOrgUsers(t, &orgUserStore, 10, userSvc, o.ID)

	tests := []struct {
		desc             string
		query            *org.SearchOrgUsersQuery
		expectedNumUsers int
	}{
		{
			desc: "should return all users",
			query: &org.SearchOrgUsersQuery{
				OrgID: o.ID,
				User: &user.SignedInUser{
					OrgID:       o.ID,
					Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no users",
			query: &org.SearchOrgUsersQuery{
				OrgID: o.ID,
				User: &user.SignedInUser{
					OrgID:       o.ID,
					Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some users",
			query: &org.SearchOrgUsersQuery{
				OrgID: o.ID,
				User: &user.SignedInUser{
					OrgID: o.ID,
					Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {
						"users:id:1",
						"users:id:5",
						"users:id:9",
					}}},
				},
			},
			expectedNumUsers: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			result, err := orgUserStore.SearchOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, result.OrgUsers, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.User, accesscontrol.ActionOrgUsersRead) {
				for _, u := range result.OrgUsers {
					assert.Contains(t, tt.query.User.GetPermissions()[accesscontrol.ActionOrgUsersRead], fmt.Sprintf("users:id:%d", u.UserID))
				}
			}
		})
	}
}

func TestIntegration_SQLStore_RemoveOrgUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	store, cfg := db.InitTestDBWithCfg(t)
	orgUserStore := sqlStore{
		db:      store,
		dialect: store.GetDialect(),
		log:     log.NewNopLogger(),
	}

	orgSvc, usrSvc := createOrgAndUserSvc(t, store, cfg)

	o, err := orgSvc.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: MainOrgName})
	require.NoError(t, err)

	// create 2nd org
	o2, err := orgSvc.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org 2"})
	require.NoError(t, err)

	// create org and admin
	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login: "admin",
		OrgID: o.ID,
	})
	require.NoError(t, err)

	// create a user with no org
	viewer, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:        "viewer",
		SkipOrgSetup: true,
	})
	require.NoError(t, err)

	// create a user with no org
	viewer2, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:        "viewer2",
		SkipOrgSetup: true,
	})
	require.NoError(t, err)

	// create a user with no org
	viewer3, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:        "viewer3",
		SkipOrgSetup: true,
	})
	require.NoError(t, err)

	// create an admin user with no org
	admin, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:        "serverAdmin",
		SkipOrgSetup: true,
		IsAdmin:      true,
	})
	require.NoError(t, err)

	// assign the user to the org
	err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
		Role:   "Viewer",
		OrgID:  o.ID,
		UserID: viewer.ID,
	})
	require.NoError(t, err)

	// assign the admin user to the org
	err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
		Role:   "Admin",
		OrgID:  o.ID,
		UserID: admin.ID,
	})
	require.NoError(t, err)

	// assign the viewer3 user to the 2nd org
	err = orgUserStore.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
		Role:   "Viewer",
		OrgID:  o2.ID,
		UserID: viewer3.ID,
	})
	require.NoError(t, err)

	// remove the user org
	err = orgUserStore.RemoveOrgUser(context.Background(), &org.RemoveOrgUserCommand{
		UserID:                   viewer.ID,
		OrgID:                    o.ID,
		ShouldDeleteOrphanedUser: true,
	})
	require.NoError(t, err)

	// remove the admin user
	err = orgUserStore.RemoveOrgUser(context.Background(), &org.RemoveOrgUserCommand{
		UserID:                   admin.ID,
		OrgID:                    o.ID,
		ShouldDeleteOrphanedUser: true,
	})
	require.NoError(t, err)

	// remove the viewer3 user from first org they don't belong to
	err = orgUserStore.RemoveOrgUser(context.Background(), &org.RemoveOrgUserCommand{
		UserID:                   viewer3.ID,
		OrgID:                    o.ID,
		ShouldDeleteOrphanedUser: true,
	})
	require.NoError(t, err)

	// remove the viewer2 user from first org they don't belong to
	err = orgUserStore.RemoveOrgUser(context.Background(), &org.RemoveOrgUserCommand{
		UserID:                   viewer2.ID,
		OrgID:                    o.ID,
		ShouldDeleteOrphanedUser: true,
	})
	require.NoError(t, err)

	// verify the user is deleted
	_, err = usrSvc.GetByID(context.Background(), &user.GetUserByIDQuery{
		ID: viewer.ID,
	})
	require.ErrorIs(t, err, user.ErrUserNotFound)

	// verify the admin user is not deleted
	usr, err := usrSvc.GetByID(context.Background(), &user.GetUserByIDQuery{
		ID: admin.ID,
	})
	require.NoError(t, err)
	assert.NotNil(t, usr)

	// verify the viewer2 user is not deleted
	_, err = usrSvc.GetByID(context.Background(), &user.GetUserByIDQuery{
		ID: viewer2.ID,
	})
	require.NoError(t, err)
	assert.NotNil(t, usr)

	// verify the viewer3 user is not deleted
	_, err = usrSvc.GetByID(context.Background(), &user.GetUserByIDQuery{
		ID: viewer3.ID,
	})
	require.NoError(t, err)
	assert.NotNil(t, usr)
}

func createOrgAndUserSvc(t *testing.T, store db.DB, cfg *setting.Cfg) (org.Service, user.Service) {
	t.Helper()

	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(store, cfgProvider)
	orgService, err := ProvideService(store, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		store, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	return orgService, usrSvc
}
