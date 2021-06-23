// +build integration

package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func mockTime(mock time.Time) time.Time {
	getTimeNow = func() time.Time { return mock }
	return mock
}

func TestLoginAttempts(t *testing.T) {
	t.Run("Testing Login Attempts DB Access", func(t *testing.T) {
		InitTestDB(t)

		user := "user"
		beginningOfTime := mockTime(time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local))

		err := CreateLoginAttempt(&models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.NoError(t, err)

		timePlusOneMinute := mockTime(beginningOfTime.Add(time.Minute * 1))

		err = CreateLoginAttempt(&models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.NoError(t, err)

		timePlusTwoMinutes := mockTime(beginningOfTime.Add(time.Minute * 2))

		err = CreateLoginAttempt(&models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.NoError(t, err)

		t.Run("Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s", func(t *testing.T) {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    timePlusTwoMinutes.Add(time.Second * 1),
			}
			err := GetUserLoginAttemptCount(&query)
			require.NoError(t, err)
			require.Equal(t, 0, query.Result)
		})

		t.Run("Should return the total count of login attempts since beginning of time", func(t *testing.T) {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    beginningOfTime,
			}
			err := GetUserLoginAttemptCount(&query)
			require.NoError(t, err)
			require.Equal(t, 3, query.Result)
		})

		t.Run("Should return the total count of login attempts since beginning of time + 1min", func(t *testing.T) {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    timePlusOneMinute,
			}
			err := GetUserLoginAttemptCount(&query)
			require.NoError(t, err)
			require.Equal(t, 2, query.Result)
		})

		t.Run("Should return the total count of login attempts since beginning of time + 2min", func(t *testing.T) {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    timePlusTwoMinutes,
			}
			err := GetUserLoginAttemptCount(&query)
			require.NoError(t, err)
			require.Equal(t, 1, query.Result)
		})

		t.Run("Should return deleted rows older than beginning of time", func(t *testing.T) {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: beginningOfTime,
			}
			err := DeleteOldLoginAttempts(&cmd)

			require.NoError(t, err)
			require.Equal(t, 0, cmd.DeletedRows)
		})

		t.Run("Should return deleted rows older than beginning of time + 1min", func(t *testing.T) {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: timePlusOneMinute,
			}
			err := DeleteOldLoginAttempts(&cmd)

			require.NoError(t, err)
			require.Equal(t, 1, cmd.DeletedRows)
		})

		t.Run("Should return deleted rows older than beginning of time + 2min", func(t *testing.T) {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: timePlusTwoMinutes,
			}
			err := DeleteOldLoginAttempts(&cmd)

			require.NoError(t, err)
			require.Equal(t, 2, cmd.DeletedRows)
		})

		t.Run("Should return deleted rows older than beginning of time + 2min and 1s", func(t *testing.T) {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: timePlusTwoMinutes.Add(time.Second * 1),
			}
			err := DeleteOldLoginAttempts(&cmd)

			require.NoError(t, err)
			require.Equal(t, 3, cmd.DeletedRows)
		})
	})
}
