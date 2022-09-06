package loginattemptimpl

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationLoginAttemptsQuery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var loginAttemptService loginattempt.Service
	user := "user"

	beginningOfTime := time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local)
	timePlusOneMinute := beginningOfTime.Add(time.Minute * 1)
	timePlusTwoMinutes := beginningOfTime.Add(time.Minute * 2)

	for _, test := range []struct {
		Name   string
		Query  models.GetUserLoginAttemptCountQuery
		Err    error
		Result int64
	}{
		{
			"Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s",
			models.GetUserLoginAttemptCountQuery{Username: user, Since: timePlusTwoMinutes.Add(time.Second * 1)}, nil, 0,
		},
		{
			"Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s",
			models.GetUserLoginAttemptCountQuery{Username: user, Since: timePlusTwoMinutes.Add(time.Second * 1)}, nil, 0,
		},
		{
			"Should return the total count of login attempts since beginning of time",
			models.GetUserLoginAttemptCountQuery{Username: user, Since: beginningOfTime}, nil, 3,
		},
		{
			"Should return the total count of login attempts since beginning of time + 1min",
			models.GetUserLoginAttemptCountQuery{Username: user, Since: timePlusOneMinute}, nil, 2,
		},
		{
			"Should return the total count of login attempts since beginning of time + 2min",
			models.GetUserLoginAttemptCountQuery{Username: user, Since: timePlusTwoMinutes}, nil, 1,
		},
	} {
		mockTime := beginningOfTime
		loginAttemptService = &Service{
			store: &xormStore{
				db:  sqlstore.InitTestDB(t),
				now: func() time.Time { return mockTime },
			},
		}
		err := loginAttemptService.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		mockTime = timePlusOneMinute
		err = loginAttemptService.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		mockTime = timePlusTwoMinutes
		err = loginAttemptService.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		err = loginAttemptService.GetUserLoginAttemptCount(context.Background(), &test.Query)
		require.Equal(t, test.Err, err, test.Name)
		require.Equal(t, test.Result, test.Query.Result, test.Name)
	}
}

func TestIntegrationLoginAttemptsDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var loginAttemptService loginattempt.Service
	user := "user"

	beginningOfTime := time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local)
	timePlusOneMinute := beginningOfTime.Add(time.Minute * 1)
	timePlusTwoMinutes := beginningOfTime.Add(time.Minute * 2)

	for _, test := range []struct {
		Name        string
		Cmd         models.DeleteOldLoginAttemptsCommand
		Err         error
		DeletedRows int64
	}{
		{
			"Should return deleted rows older than beginning of time",
			models.DeleteOldLoginAttemptsCommand{OlderThan: beginningOfTime}, nil, 0,
		},
		{
			"Should return deleted rows older than beginning of time + 1min",
			models.DeleteOldLoginAttemptsCommand{OlderThan: timePlusOneMinute}, nil, 1,
		},
		{
			"Should return deleted rows older than beginning of time + 2min",
			models.DeleteOldLoginAttemptsCommand{OlderThan: timePlusTwoMinutes}, nil, 2,
		},
		{
			"Should return deleted rows older than beginning of time + 2min and 1s",
			models.DeleteOldLoginAttemptsCommand{OlderThan: timePlusTwoMinutes.Add(time.Second * 1)}, nil, 3,
		},
	} {
		mockTime := beginningOfTime
		loginAttemptService = &Service{
			store: &xormStore{
				db:  sqlstore.InitTestDB(t),
				now: func() time.Time { return mockTime },
			},
		}
		err := loginAttemptService.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		mockTime = timePlusOneMinute
		err = loginAttemptService.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		mockTime = timePlusTwoMinutes
		err = loginAttemptService.CreateLoginAttempt(context.Background(), &models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		require.Nil(t, err)
		err = loginAttemptService.DeleteOldLoginAttempts(context.Background(), &test.Cmd)
		require.Equal(t, test.Err, err, test.Name)
		require.Equal(t, test.DeletedRows, test.Cmd.DeletedRows, test.Name)
	}
}
