//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func mockTime(mock time.Time) time.Time {
	getTimeNow = func() time.Time { return mock }
	return mock
}

func TestIntegrationLoginAttempts(t *testing.T) {
	var beginningOfTime, timePlusOneMinute, timePlusTwoMinutes time.Time
	var sqlStore *SQLStore
	user := "user"

	setup := func(t *testing.T) {
		sqlStore = InitTestDB(t)
		beginningOfTime = mockTime(time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local))
		err := sqlStore.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		timePlusOneMinute = mockTime(beginningOfTime.Add(time.Minute * 1))
		err = sqlStore.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		timePlusTwoMinutes = mockTime(beginningOfTime.Add(time.Minute * 2))
		err = sqlStore.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
	}

	t.Run("Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s", func(t *testing.T) {
		setup(t)
		query := models.GetUserLoginAttemptCountQuery{
			Username: user,
			Since:    timePlusTwoMinutes.Add(time.Second * 1),
		}
		err := sqlStore.GetUserLoginAttemptCount(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, int64(0), query.Result)
	})

	t.Run("Should return the total count of login attempts since beginning of time", func(t *testing.T) {
		setup(t)
		query := models.GetUserLoginAttemptCountQuery{
			Username: user,
			Since:    beginningOfTime,
		}
		err := sqlStore.GetUserLoginAttemptCount(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, int64(3), query.Result)
	})

	t.Run("Should return the total count of login attempts since beginning of time + 1min", func(t *testing.T) {
		setup(t)
		query := models.GetUserLoginAttemptCountQuery{
			Username: user,
			Since:    timePlusOneMinute,
		}
		err := sqlStore.GetUserLoginAttemptCount(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, int64(2), query.Result)
	})

	t.Run("Should return the total count of login attempts since beginning of time + 2min", func(t *testing.T) {
		setup(t)
		query := models.GetUserLoginAttemptCountQuery{
			Username: user,
			Since:    timePlusTwoMinutes,
		}
		err := sqlStore.GetUserLoginAttemptCount(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, int64(1), query.Result)
	})

	t.Run("Should return deleted rows older than beginning of time", func(t *testing.T) {
		setup(t)
		cmd := models.DeleteOldLoginAttemptsCommand{
			OlderThan: beginningOfTime,
		}
		err := sqlStore.DeleteOldLoginAttempts(context.Background(), &cmd)

		require.Nil(t, err)
		require.Equal(t, int64(0), cmd.DeletedRows)
	})

	t.Run("Should return deleted rows older than beginning of time + 1min", func(t *testing.T) {
		setup(t)
		cmd := models.DeleteOldLoginAttemptsCommand{
			OlderThan: timePlusOneMinute,
		}
		err := sqlStore.DeleteOldLoginAttempts(context.Background(), &cmd)

		require.Nil(t, err)
		require.Equal(t, int64(1), cmd.DeletedRows)
	})

	t.Run("Should return deleted rows older than beginning of time + 2min", func(t *testing.T) {
		setup(t)
		cmd := models.DeleteOldLoginAttemptsCommand{
			OlderThan: timePlusTwoMinutes,
		}
		err := sqlStore.DeleteOldLoginAttempts(context.Background(), &cmd)

		require.Nil(t, err)
		require.Equal(t, int64(2), cmd.DeletedRows)
	})

	t.Run("Should return deleted rows older than beginning of time + 2min and 1s", func(t *testing.T) {
		setup(t)
		cmd := models.DeleteOldLoginAttemptsCommand{
			OlderThan: timePlusTwoMinutes.Add(time.Second * 1),
		}
		err := sqlStore.DeleteOldLoginAttempts(context.Background(), &cmd)

		require.Nil(t, err)
		require.Equal(t, int64(3), cmd.DeletedRows)
	})
}
