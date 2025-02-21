package loginattemptimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationLoginAttemptsQuery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	user := "user"

	beginningOfTime := time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local)
	timePlusOneMinute := beginningOfTime.Add(time.Minute * 1)
	timePlusTwoMinutes := beginningOfTime.Add(time.Minute * 2)

	for _, test := range []struct {
		Name   string
		Query  GetUserLoginAttemptCountQuery
		Err    error
		Result int64
	}{
		{
			"Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s",
			GetUserLoginAttemptCountQuery{Username: user, Since: timePlusTwoMinutes.Add(time.Second * 1)}, nil, 0,
		},
		{
			"Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s",
			GetUserLoginAttemptCountQuery{Username: user, Since: timePlusTwoMinutes.Add(time.Second * 1)}, nil, 0,
		},
		{
			"Should return the total count of login attempts since beginning of time",
			GetUserLoginAttemptCountQuery{Username: user, Since: beginningOfTime}, nil, 3,
		},
		{
			"Should return the total count of login attempts since beginning of time + 1min",
			GetUserLoginAttemptCountQuery{Username: user, Since: timePlusOneMinute}, nil, 2,
		},
		{
			"Should return the total count of login attempts since beginning of time + 2min",
			GetUserLoginAttemptCountQuery{Username: user, Since: timePlusTwoMinutes}, nil, 1,
		},
	} {
		mockTime := beginningOfTime
		s := &xormStore{
			db:  db.InitTestDB(t),
			now: func() time.Time { return mockTime },
		}

		_, err := s.CreateLoginAttempt(context.Background(), CreateLoginAttemptCommand{
			Username:  user,
			IPAddress: "192.168.0.1",
		})
		require.Nil(t, err)

		mockTime = timePlusOneMinute
		_, err = s.CreateLoginAttempt(context.Background(), CreateLoginAttemptCommand{
			Username:  user,
			IPAddress: "192.168.0.1",
		})
		require.Nil(t, err)

		mockTime = timePlusTwoMinutes
		_, err = s.CreateLoginAttempt(context.Background(), CreateLoginAttemptCommand{
			Username:  user,
			IPAddress: "192.168.0.1",
		})
		require.Nil(t, err)

		count, err := s.GetUserLoginAttemptCount(context.Background(), test.Query)
		require.Equal(t, test.Err, err, test.Name)
		require.Equal(t, test.Result, count, test.Name)
	}
}

func TestIntegrationLoginAttemptsDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	user := "user"

	beginningOfTime := time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local)
	timePlusOneMinute := beginningOfTime.Add(time.Minute * 1)
	timePlusTwoMinutes := beginningOfTime.Add(time.Minute * 2)

	for _, test := range []struct {
		Name        string
		Cmd         DeleteOldLoginAttemptsCommand
		Err         error
		DeletedRows int64
	}{
		{
			"Should return deleted rows older than beginning of time",
			DeleteOldLoginAttemptsCommand{OlderThan: beginningOfTime}, nil, 0,
		},
		{
			"Should return deleted rows older than beginning of time + 1min",
			DeleteOldLoginAttemptsCommand{OlderThan: timePlusOneMinute}, nil, 1,
		},
		{
			"Should return deleted rows older than beginning of time + 2min",
			DeleteOldLoginAttemptsCommand{OlderThan: timePlusTwoMinutes}, nil, 2,
		},
		{
			"Should return deleted rows older than beginning of time + 2min and 1s",
			DeleteOldLoginAttemptsCommand{OlderThan: timePlusTwoMinutes.Add(time.Second * 1)}, nil, 3,
		},
	} {
		mockTime := beginningOfTime
		s := &xormStore{
			db:  db.InitTestDB(t),
			now: func() time.Time { return mockTime },
		}

		_, err := s.CreateLoginAttempt(context.Background(), CreateLoginAttemptCommand{
			Username:  user,
			IPAddress: "192.168.0.1",
		})
		require.Nil(t, err)

		mockTime = timePlusOneMinute
		_, err = s.CreateLoginAttempt(context.Background(), CreateLoginAttemptCommand{
			Username:  user,
			IPAddress: "192.168.0.1",
		})
		require.Nil(t, err)

		mockTime = timePlusTwoMinutes
		_, err = s.CreateLoginAttempt(context.Background(), CreateLoginAttemptCommand{
			Username:  user,
			IPAddress: "192.168.0.1",
		})
		require.Nil(t, err)

		deletedRows, err := s.DeleteOldLoginAttempts(context.Background(), test.Cmd)
		require.Equal(t, test.Err, err, test.Name)
		require.Equal(t, test.DeletedRows, deletedRows, test.Name)
	}
}
