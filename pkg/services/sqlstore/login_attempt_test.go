// +build integration

package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func mockTime(mock time.Time) time.Time {
	getTimeNow = func() time.Time { return mock }
	return mock
}

func TestLoginAttempts(t *testing.T) {
	Convey("Testing Login Attempts DB Access", t, func() {
		InitTestDB(t)

		user := "user"
		beginningOfTime := mockTime(time.Date(2017, 10, 22, 8, 0, 0, 0, time.Local))

		err := CreateLoginAttempt(&models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		So(err, ShouldBeNil)

		timePlusOneMinute := mockTime(beginningOfTime.Add(time.Minute * 1))

		err = CreateLoginAttempt(&models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		So(err, ShouldBeNil)

		timePlusTwoMinutes := mockTime(beginningOfTime.Add(time.Minute * 2))

		err = CreateLoginAttempt(&models.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		So(err, ShouldBeNil)

		Convey("Should return a total count of zero login attempts when comparing since beginning of time + 2min and 1s", func() {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    timePlusTwoMinutes.Add(time.Second * 1),
			}
			err := GetUserLoginAttemptCount(&query)
			So(err, ShouldBeNil)
			So(query.Result, ShouldEqual, 0)
		})

		Convey("Should return the total count of login attempts since beginning of time", func() {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    beginningOfTime,
			}
			err := GetUserLoginAttemptCount(&query)
			So(err, ShouldBeNil)
			So(query.Result, ShouldEqual, 3)
		})

		Convey("Should return the total count of login attempts since beginning of time + 1min", func() {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    timePlusOneMinute,
			}
			err := GetUserLoginAttemptCount(&query)
			So(err, ShouldBeNil)
			So(query.Result, ShouldEqual, 2)
		})

		Convey("Should return the total count of login attempts since beginning of time + 2min", func() {
			query := models.GetUserLoginAttemptCountQuery{
				Username: user,
				Since:    timePlusTwoMinutes,
			}
			err := GetUserLoginAttemptCount(&query)
			So(err, ShouldBeNil)
			So(query.Result, ShouldEqual, 1)
		})

		Convey("Should return deleted rows older than beginning of time", func() {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: beginningOfTime,
			}
			err := DeleteOldLoginAttempts(&cmd)

			So(err, ShouldBeNil)
			So(cmd.DeletedRows, ShouldEqual, 0)
		})

		Convey("Should return deleted rows older than beginning of time + 1min", func() {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: timePlusOneMinute,
			}
			err := DeleteOldLoginAttempts(&cmd)

			So(err, ShouldBeNil)
			So(cmd.DeletedRows, ShouldEqual, 1)
		})

		Convey("Should return deleted rows older than beginning of time + 2min", func() {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: timePlusTwoMinutes,
			}
			err := DeleteOldLoginAttempts(&cmd)

			So(err, ShouldBeNil)
			So(cmd.DeletedRows, ShouldEqual, 2)
		})

		Convey("Should return deleted rows older than beginning of time + 2min and 1s", func() {
			cmd := models.DeleteOldLoginAttemptsCommand{
				OlderThan: timePlusTwoMinutes.Add(time.Second * 1),
			}
			err := DeleteOldLoginAttempts(&cmd)

			So(err, ShouldBeNil)
			So(cmd.DeletedRows, ShouldEqual, 3)
		})
	})
}
