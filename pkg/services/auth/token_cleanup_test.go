package auth

import (
	"fmt"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUserAuthTokenCleanup(t *testing.T) {

	Convey("Test user auth token cleanup", t, func() {
		ctx := createTestContext(t)
		ctx.tokenService.Cfg.LoginMaxInactiveLifetimeDays = 7
		ctx.tokenService.Cfg.LoginMaxLifetimeDays = 30

		insertToken := func(token string, prev string, createdAt, rotatedAt int64) {
			ut := userAuthToken{AuthToken: token, PrevAuthToken: prev, CreatedAt: createdAt, RotatedAt: rotatedAt, UserAgent: "", ClientIp: ""}
			_, err := ctx.sqlstore.NewSession().Insert(&ut)
			So(err, ShouldBeNil)
		}

		t := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
		getTime = func() time.Time {
			return t
		}

		Convey("should delete tokens where token rotation age is older than or equal 7 days", func() {
			from := t.Add(-7 * 24 * time.Hour)

			// insert three old tokens that should be deleted
			for i := 0; i < 3; i++ {
				insertToken(fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), from.Unix(), from.Unix())
			}

			// insert three active tokens that should not be deleted
			for i := 0; i < 3; i++ {
				from = from.Add(time.Second)
				insertToken(fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), from.Unix(), from.Unix())
			}

			affected, err := ctx.tokenService.deleteExpiredTokens(7*24*time.Hour, 30*24*time.Hour)
			So(err, ShouldBeNil)
			So(affected, ShouldEqual, 3)
		})

		Convey("should delete tokens where token age is older than or equal 30 days", func() {
			from := t.Add(-30 * 24 * time.Hour)
			fromRotate := t.Add(-time.Second)

			// insert three old tokens that should be deleted
			for i := 0; i < 3; i++ {
				insertToken(fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), from.Unix(), fromRotate.Unix())
			}

			// insert three active tokens that should not be deleted
			for i := 0; i < 3; i++ {
				from = from.Add(time.Second)
				insertToken(fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), from.Unix(), fromRotate.Unix())
			}

			affected, err := ctx.tokenService.deleteExpiredTokens(7*24*time.Hour, 30*24*time.Hour)
			So(err, ShouldBeNil)
			So(affected, ShouldEqual, 3)
		})
	})
}
