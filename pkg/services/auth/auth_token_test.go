package auth

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUserAuthToken(t *testing.T) {
	Convey("Test user auth token", t, func() {
		ctx := createTestContext(t)
		userAuthTokenService := ctx.tokenService
		userID := int64(10)

		t := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
		now = func() time.Time {
			return t
		}

		Convey("When creating token", func() {
			token, err := userAuthTokenService.CreateToken(userID, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)
			So(token.AuthTokenSeen, ShouldBeFalse)

			Convey("When lookup unhashed token should return user auth token", func() {
				LookupToken, err := userAuthTokenService.LookupToken(token.UnhashedToken)
				So(err, ShouldBeNil)
				So(LookupToken, ShouldNotBeNil)
				So(LookupToken.UserId, ShouldEqual, userID)
				So(LookupToken.AuthTokenSeen, ShouldBeTrue)

				storedAuthToken, err := ctx.getAuthTokenByID(LookupToken.Id)
				So(err, ShouldBeNil)
				So(storedAuthToken, ShouldNotBeNil)
				So(storedAuthToken.AuthTokenSeen, ShouldBeTrue)
			})

			Convey("When lookup hashed token should return user auth token not found error", func() {
				LookupToken, err := userAuthTokenService.LookupToken(token.AuthToken)
				So(err, ShouldEqual, ErrAuthTokenNotFound)
				So(LookupToken, ShouldBeNil)
			})
		})

		Convey("expires correctly", func() {
			token, err := userAuthTokenService.CreateToken(userID, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)

			_, err = userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)

			token, err = ctx.getAuthTokenByID(token.Id)
			So(err, ShouldBeNil)

			// set now (now - 23 hours)
			_, err = userAuthTokenService.RefreshToken(token, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)

			_, err = userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)

			stillGood, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(stillGood, ShouldNotBeNil)

			// set now (new - 2 hours)
			notGood, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldEqual, ErrAuthTokenNotFound)
			So(notGood, ShouldBeNil)
		})

		Convey("can properly rotate tokens", func() {
			token, err := userAuthTokenService.CreateToken(userID, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)

			prevToken := token.AuthToken
			unhashedPrev := token.UnhashedToken

			refreshed, err := userAuthTokenService.RefreshToken(token, "192.168.10.12:1234", "a new user agent")
			So(err, ShouldBeNil)
			So(refreshed, ShouldBeFalse)

			ctx.markAuthTokenAsSeen(token.Id)
			token, err = ctx.getAuthTokenByID(token.Id)
			So(err, ShouldBeNil)

			// ability to auth using an old token
			now = func() time.Time {
				return t
			}

			refreshed, err = userAuthTokenService.RefreshToken(token, "192.168.10.12:1234", "a new user agent")
			So(err, ShouldBeNil)
			So(refreshed, ShouldBeTrue)

			unhashedToken := token.UnhashedToken

			token, err = ctx.getAuthTokenByID(token.Id)
			So(err, ShouldBeNil)
			token.UnhashedToken = unhashedToken

			So(token.RotatedAt, ShouldEqual, t.Unix())
			So(token.ClientIp, ShouldEqual, "192.168.10.12")
			So(token.UserAgent, ShouldEqual, "a new user agent")
			So(token.AuthTokenSeen, ShouldBeFalse)
			So(token.SeenAt, ShouldEqual, 0)
			So(token.PrevAuthToken, ShouldEqual, prevToken)

			lookedUp, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.AuthTokenSeen, ShouldBeTrue)
			So(lookedUp.SeenAt, ShouldEqual, t.Unix())

			lookedUp, err = userAuthTokenService.LookupToken(unhashedPrev)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.Id, ShouldEqual, token.Id)

			now = func() time.Time {
				return t.Add(2 * time.Minute)
			}

			lookedUp, err = userAuthTokenService.LookupToken(unhashedPrev)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)

			lookedUp, err = ctx.getAuthTokenByID(lookedUp.Id)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.AuthTokenSeen, ShouldBeFalse)

			refreshed, err = userAuthTokenService.RefreshToken(token, "192.168.10.12:1234", "a new user agent")
			So(err, ShouldBeNil)
			So(refreshed, ShouldBeTrue)

			token, err = ctx.getAuthTokenByID(token.Id)
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)
			So(token.SeenAt, ShouldEqual, 0)
		})

		Convey("keeps prev token valid for 1 minute after it is confirmed", func() {

		})

		Convey("will not mark token unseen when prev and current are the same", func() {

		})

		Reset(func() {
			now = time.Now
		})
	})
}

func createTestContext(t *testing.T) *testContext {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)
	tokenService := &UserAuthTokenService{
		SQLStore: sqlstore,
		log:      log.New("test-logger"),
	}

	RotateTime = 10 * time.Minute
	UrgentRotateTime = time.Minute

	return &testContext{
		sqlstore:     sqlstore,
		tokenService: tokenService,
	}
}

type testContext struct {
	sqlstore     *sqlstore.SqlStore
	tokenService *UserAuthTokenService
}

func (c *testContext) getAuthTokenByID(id int64) (*models.UserAuthToken, error) {
	sess := c.sqlstore.NewSession()
	var t models.UserAuthToken
	found, err := sess.ID(id).Get(&t)
	if err != nil || !found {
		return nil, err
	}

	return &t, nil
}

func (c *testContext) markAuthTokenAsSeen(id int64) (bool, error) {
	sess := c.sqlstore.NewSession()
	res, err := sess.Exec("UPDATE user_auth_token SET auth_token_seen = ? WHERE id = ?", c.sqlstore.Dialect.BooleanStr(true), id)
	if err != nil {
		return false, err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected == 1, nil
}
