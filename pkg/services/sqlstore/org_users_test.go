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
	err = store.addOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:   "Viewer",
		OrgId:  orgID,
		UserId: sa.ID,
	})
	require.Error(t, err)

	// assign the sa to the org with the override. should succeed
	err = store.addOrgUser(context.Background(), &models.AddOrgUserCommand{
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
