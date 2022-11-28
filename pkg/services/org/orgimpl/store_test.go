package orgimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationOrgDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	orgStore := sqlStore{
		db:      ss,
		dialect: ss.GetDialect(),
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
				Country:  "country"},
		})
		require.NoError(t, err)
		orga, err := orgStore.Get(context.Background(), ac2.ID)
		require.NoError(t, err)
		require.Equal(t, "address1", orga.Address1)
	})

	t.Run("Removing org", func(t *testing.T) {
		// make sure ac2 has no org
		ac2 := &org.Org{ID: 22, Name: "ac2", Version: 1, Created: time.Now(), Updated: time.Now()}
		_, err := orgStore.Insert(context.Background(), ac2)
		require.NoError(t, err)
		err = orgStore.Delete(context.Background(), &org.DeleteOrgCommand{ID: ac2.ID})
		require.NoError(t, err)

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
		require.Equal(t, len(result), 3)
	})

	t.Run("Given we have organizations, we can limit and paginate search", func(t *testing.T) {
		ss = sqlstore.InitTestDB(t)
		for i := 1; i < 4; i++ {
			cmd := &org.CreateOrgCommand{Name: fmt.Sprint("Orga #", i)}
			_, err := orgStore.CreateWithMember(context.Background(), cmd)
			require.NoError(t, err)
		}

		t.Run("Should be able to search with defaults", func(t *testing.T) {
			query := &org.SearchOrgsQuery{}
			result, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(result), 3)
		})

		t.Run("Should be able to limit search", func(t *testing.T) {
			query := &org.SearchOrgsQuery{Limit: 1}
			result, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(result), 1)
		})

		t.Run("Should be able to limit and paginate search", func(t *testing.T) {
			query := &org.SearchOrgsQuery{Limit: 2, Page: 1}
			result, err := orgStore.Search(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(result), 1)
		})
	})
}

func TestIntegrationOrgUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	orgUserStore := sqlStore{
		db:      ss,
		dialect: ss.GetDialect(),
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
}
