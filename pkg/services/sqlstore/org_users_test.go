package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSQLStore_AddOrgUser(t *testing.T) {
	var orgID int64 = 1
	store := InitTestDB(t)

	// create org and admin
	_, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login: "admin",
		OrgID: orgID,
	})
	require.NoError(t, err)

	// create a service account with no org
	sa, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login:            "sa-no-org",
		IsServiceAccount: true,
		SkipOrgSetup:     true,
	})

	require.NoError(t, err)
	require.Equal(t, int64(-1), sa.OrgID)

	// assign the sa to the org but without the override. should fail
	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:   "Viewer",
		OrgId:  orgID,
		UserId: sa.ID,
	})
	require.Error(t, err)

	// assign the sa to the org with the override. should succeed
	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:                      "Viewer",
		OrgId:                     orgID,
		UserId:                    sa.ID,
		AllowAddingServiceAccount: true,
	})

	require.NoError(t, err)

	// assert the org has been correctly set
	saFound := new(user.User)
	err = store.WithDbSession(context.Background(), func(sess *DBSession) error {
		has, err := sess.ID(sa.ID).Get(saFound)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})

	require.NoError(t, err)
	require.Equal(t, saFound.OrgID, orgID)
}

func TestSQLStore_RemoveOrgUser(t *testing.T) {
	store := InitTestDB(t)

	// create org and admin
	_, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login: "admin",
		OrgID: 1,
	})
	require.NoError(t, err)

	// create a user with no org
	_, err = store.CreateUser(context.Background(), user.CreateUserCommand{
		Login:        "user",
		OrgID:        1,
		SkipOrgSetup: true,
	})
	require.NoError(t, err)

	// assign the user to the org
	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:   "Viewer",
		OrgId:  1,
		UserId: 2,
	})
	require.NoError(t, err)

	// assert the org has been assigned
	user := &models.GetUserByIdQuery{Id: 2}
	err = store.GetUserById(context.Background(), user)
	require.NoError(t, err)
	require.Equal(t, user.Result.OrgID, int64(1))

	// remove the user org
	err = store.RemoveOrgUser(context.Background(), &models.RemoveOrgUserCommand{
		UserId:                   2,
		OrgId:                    1,
		ShouldDeleteOrphanedUser: false,
	})
	require.NoError(t, err)

	// assert the org has been removed
	user = &models.GetUserByIdQuery{Id: 2}
	err = store.GetUserById(context.Background(), user)
	require.NoError(t, err)
	require.Equal(t, user.Result.OrgID, int64(0))
}
