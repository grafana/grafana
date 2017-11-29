package sqlstore

import (
	"testing"
	"time"

	m "github.com/grafana/grafana/pkg/models"
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

		err := CreateLoginAttempt(&m.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		So(err, ShouldBeNil)

		timePlusOneMinute := mockTime(beginningOfTime.Add(time.Minute * 1))

		err = CreateLoginAttempt(&m.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		So(err, ShouldBeNil)

		timePlusTwoMinutes := mockTime(beginningOfTime.Add(time.Minute * 2))

		err = CreateLoginAttempt(&m.CreateLoginAttemptCommand{
			Username:  user,
			IpAddress: "192.168.0.1",
		})
		So(err, ShouldBeNil)

	})
}
