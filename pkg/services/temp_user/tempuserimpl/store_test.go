package tempuserimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

func TestIntegrationTempUserCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var store store
	var tempUser *tempuser.TempUser
	var err error
	cmd := tempuser.CreateTempUserCommand{
		OrgID:  2256,
		Name:   "hello",
		Code:   "asd",
		Email:  "e@as.co",
		Status: tempuser.TmpUserInvitePending,
	}
	setup := func(t *testing.T) {
		db := db.InitTestDB(t)
		store = &xormStore{db: db}
		tempUser, err = store.CreateTempUser(context.Background(), &cmd)
		require.Nil(t, err)
	}

	t.Run("Can create multiple temp users", func(t *testing.T) {
		setup(t)
		created, err := store.CreateTempUser(context.Background(), &cmd)
		require.Nil(t, err)
		require.Equal(t, int64(2), created.ID)
	})

	t.Run("Should be able to get temp users by org id", func(t *testing.T) {
		setup(t)
		query := tempuser.GetTempUsersQuery{OrgID: 2256, Status: tempuser.TmpUserInvitePending}
		queryResult, err := store.GetTempUsersQuery(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, 1, len(queryResult))
	})

	t.Run("Should be able to get temp users by email", func(t *testing.T) {
		setup(t)
		query := tempuser.GetTempUsersQuery{Email: "e@as.co", Status: tempuser.TmpUserInvitePending}
		queryResult, err := store.GetTempUsersQuery(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, 1, len(queryResult))
	})

	t.Run("Should be able to get temp users by code", func(t *testing.T) {
		setup(t)
		query := tempuser.GetTempUserByCodeQuery{Code: "asd"}
		queryResult, err := store.GetTempUserByCode(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, "hello", queryResult.Name)
	})

	t.Run("Should be able update status", func(t *testing.T) {
		setup(t)
		cmd2 := tempuser.UpdateTempUserStatusCommand{Code: "asd", Status: tempuser.TmpUserRevoked}
		err := store.UpdateTempUserStatus(context.Background(), &cmd2)
		require.Nil(t, err)
	})

	t.Run("Should be able update email sent and email sent on", func(t *testing.T) {
		setup(t)
		cmd2 := tempuser.UpdateTempUserWithEmailSentCommand{Code: tempUser.Code}
		err := store.UpdateTempUserWithEmailSent(context.Background(), &cmd2)
		require.Nil(t, err)

		query := tempuser.GetTempUsersQuery{OrgID: 2256, Status: tempuser.TmpUserInvitePending}
		queryResult, err := store.GetTempUsersQuery(context.Background(), &query)

		require.Nil(t, err)
		require.True(t, queryResult[0].EmailSent)
		require.False(t, queryResult[0].EmailSentOn.UTC().Before(queryResult[0].Created.UTC()))
	})

	t.Run("Should be able expire temp user", func(t *testing.T) {
		setup(t)
		createdAt := time.Unix(tempUser.Created, 0)
		cmd2 := tempuser.ExpireTempUsersCommand{OlderThan: createdAt.Add(1 * time.Second)}
		err := store.ExpireOldUserInvites(context.Background(), &cmd2)
		require.Nil(t, err)
		require.Equal(t, int64(1), cmd2.NumExpired)

		t.Run("Should do nothing when no temp users to expire", func(t *testing.T) {
			createdAt := time.Unix(tempUser.Created, 0)
			cmd2 := tempuser.ExpireTempUsersCommand{OlderThan: createdAt.Add(1 * time.Second)}
			err := store.ExpireOldUserInvites(context.Background(), &cmd2)
			require.Nil(t, err)
			require.Equal(t, int64(0), cmd2.NumExpired)
		})
	})
}
