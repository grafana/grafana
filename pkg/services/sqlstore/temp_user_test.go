// +build integration

package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func TestTempUserCommandsAndQueries(t *testing.T) {
	t.Run("Testing Temp User commands & queries", func(t *testing.T) {
		InitTestDB(t)

		t.Run("Given saved api key", func(t *testing.T) {
			cmd := models.CreateTempUserCommand{
				OrgId:  2256,
				Name:   "hello",
				Code:   "asd",
				Email:  "e@as.co",
				Status: models.TmpUserInvitePending,
			}
			err := CreateTempUser(&cmd)
			require.NoError(t, err)

			t.Run("Should be able to get temp users by org id", func(t *testing.T) {
				query := models.GetTempUsersQuery{OrgId: 2256, Status: models.TmpUserInvitePending}
				err = GetTempUsersQuery(&query)

				require.NoError(t, err)
				require.Equal(t, 1, len(query.Result))
			})

			t.Run("Should be able to get temp users by email", func(t *testing.T) {
				query := models.GetTempUsersQuery{Email: "e@as.co", Status: models.TmpUserInvitePending}
				err = GetTempUsersQuery(&query)

				require.NoError(t, err)
				require.Equal(t, 1, len(query.Result))
			})

			t.Run("Should be able to get temp users by code", func(t *testing.T) {
				query := models.GetTempUserByCodeQuery{Code: "asd"}
				err = GetTempUserByCode(&query)

				require.NoError(t, err)
				require.Equal(t, "hello", query.Result.Name)
			})

			t.Run("Should be able update status", func(t *testing.T) {
				cmd2 := models.UpdateTempUserStatusCommand{Code: "asd", Status: models.TmpUserRevoked}
				err := UpdateTempUserStatus(&cmd2)
				require.NoError(t, err)
			})

			t.Run("Should be able update email sent and email sent on", func(t *testing.T) {
				cmd2 := models.UpdateTempUserWithEmailSentCommand{Code: cmd.Result.Code}
				err := UpdateTempUserWithEmailSent(&cmd2)
				require.NoError(t, err)

				query := models.GetTempUsersQuery{OrgId: 2256, Status: models.TmpUserInvitePending}
				err = GetTempUsersQuery(&query)

				require.NoError(t, err)
				require.True(t, query.Result[0].EmailSent)
				So(query.Result[0].EmailSentOn.UTC(), ShouldHappenOnOrAfter, query.Result[0].Created.UTC())
			})

			t.Run("Should be able expire temp user", func(t *testing.T) {
				createdAt := time.Unix(cmd.Result.Created, 0)
				cmd2 := models.ExpireTempUsersCommand{OlderThan: createdAt.Add(1 * time.Second)}
				err := ExpireOldUserInvites(&cmd2)
				require.NoError(t, err)
				require.Equal(t, int64(1), cmd2.NumExpired)

				t.Run("Should do nothing when no temp users to expire", func(t *testing.T) {
					createdAt := time.Unix(cmd.Result.Created, 0)
					cmd2 := models.ExpireTempUsersCommand{OlderThan: createdAt.Add(1 * time.Second)}
					err := ExpireOldUserInvites(&cmd2)
					require.NoError(t, err)
					require.Equal(t, int64(0), cmd2.NumExpired)
				})
			})
		})
	})
}
