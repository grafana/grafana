package tempuserimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
)

func TestIntegrationTempUserCommandsAndQueries(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var store store
	cmd := models.CreateTempUserCommand{
		OrgId:  2256,
		Name:   "hello",
		Code:   "asd",
		Email:  "e@as.co",
		Status: models.TmpUserInvitePending,
	}
	setup := func(t *testing.T) {
		db := db.InitTestDB(t)
		store = &xormStore{db: db}
		err := store.CreateTempUser(context.Background(), &cmd)
		require.Nil(t, err)
	}

	t.Run("Should be able to get temp users by org id", func(t *testing.T) {
		setup(t)
		query := models.GetTempUsersQuery{OrgId: 2256, Status: models.TmpUserInvitePending}
		err := store.GetTempUsersQuery(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, 1, len(query.Result))
	})

	t.Run("Should be able to get temp users by email", func(t *testing.T) {
		setup(t)
		query := models.GetTempUsersQuery{Email: "e@as.co", Status: models.TmpUserInvitePending}
		err := store.GetTempUsersQuery(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, 1, len(query.Result))
	})

	t.Run("Should be able to get temp users by code", func(t *testing.T) {
		setup(t)
		query := models.GetTempUserByCodeQuery{Code: "asd"}
		err := store.GetTempUserByCode(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, "hello", query.Result.Name)
	})

	t.Run("Should be able update status", func(t *testing.T) {
		setup(t)
		cmd2 := models.UpdateTempUserStatusCommand{Code: "asd", Status: models.TmpUserRevoked}
		err := store.UpdateTempUserStatus(context.Background(), &cmd2)
		require.Nil(t, err)
	})

	t.Run("Should be able update email sent and email sent on", func(t *testing.T) {
		setup(t)
		cmd2 := models.UpdateTempUserWithEmailSentCommand{Code: cmd.Result.Code}
		err := store.UpdateTempUserWithEmailSent(context.Background(), &cmd2)
		require.Nil(t, err)

		query := models.GetTempUsersQuery{OrgId: 2256, Status: models.TmpUserInvitePending}
		err = store.GetTempUsersQuery(context.Background(), &query)

		require.Nil(t, err)
		require.True(t, query.Result[0].EmailSent)
		require.False(t, query.Result[0].EmailSentOn.UTC().Before(query.Result[0].Created.UTC()))
	})

	t.Run("Should be able expire temp user", func(t *testing.T) {
		setup(t)
		createdAt := time.Unix(cmd.Result.Created, 0)
		cmd2 := models.ExpireTempUsersCommand{OlderThan: createdAt.Add(1 * time.Second)}
		err := store.ExpireOldUserInvites(context.Background(), &cmd2)
		require.Nil(t, err)
		require.Equal(t, int64(1), cmd2.NumExpired)

		t.Run("Should do nothing when no temp users to expire", func(t *testing.T) {
			createdAt := time.Unix(cmd.Result.Created, 0)
			cmd2 := models.ExpireTempUsersCommand{OlderThan: createdAt.Add(1 * time.Second)}
			err := store.ExpireOldUserInvites(context.Background(), &cmd2)
			require.Nil(t, err)
			require.Equal(t, int64(0), cmd2.NumExpired)
		})
	})
}
