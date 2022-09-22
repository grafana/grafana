package orgimpl

import (
	"context"
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
}

func TestIntegrationOrgUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	orgUserStore := sqlStore{
		db: ss,
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
}
