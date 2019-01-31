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

		insertToken := func(token string, prev string, rotatedAt int64) {
			ut := userAuthToken{AuthToken: token, PrevAuthToken: prev, RotatedAt: rotatedAt, UserAgent: "", ClientIp: ""}
			_, err := ctx.sqlstore.NewSession().Insert(&ut)
			So(err, ShouldBeNil)
		}

		// insert three old tokens that should be deleted
		for i := 0; i < 3; i++ {
			insertToken(fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), int64(i))
		}

		// insert three active tokens that should not be deleted
		for i := 0; i < 3; i++ {
			insertToken(fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), getTime().Unix())
		}

		affected, err := ctx.tokenService.deleteOldSession(time.Hour)
		So(err, ShouldBeNil)
		So(affected, ShouldEqual, 3)
	})
}
