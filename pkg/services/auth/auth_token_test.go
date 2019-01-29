package auth

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUserAuthToken(t *testing.T) {
	Convey("Test user auth token", t, func() {
		ctx := createTestContext(t)
		userAuthTokenService := ctx.tokenService
		userID := int64(10)

		t := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
		getTime = func() time.Time {
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

			getTime = func() time.Time {
				return t.Add(time.Hour)
			}

			refreshed, err := userAuthTokenService.RefreshToken(token, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(refreshed, ShouldBeTrue)

			_, err = userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)

			stillGood, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(stillGood, ShouldNotBeNil)

			getTime = func() time.Time {
				return t.Add(24 * 7 * time.Hour)
			}
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

			updated, err := ctx.markAuthTokenAsSeen(token.Id)
			So(err, ShouldBeNil)
			So(updated, ShouldBeTrue)

			token, err = ctx.getAuthTokenByID(token.Id)
			So(err, ShouldBeNil)

			getTime = func() time.Time {
				return t.Add(time.Hour)
			}

			refreshed, err = userAuthTokenService.RefreshToken(token, "192.168.10.12:1234", "a new user agent")
			So(err, ShouldBeNil)
			So(refreshed, ShouldBeTrue)

			unhashedToken := token.UnhashedToken

			token, err = ctx.getAuthTokenByID(token.Id)
			So(err, ShouldBeNil)
			token.UnhashedToken = unhashedToken

			So(token.RotatedAt, ShouldEqual, getTime().Unix())
			So(token.ClientIp, ShouldEqual, "192.168.10.12")
			So(token.UserAgent, ShouldEqual, "a new user agent")
			So(token.AuthTokenSeen, ShouldBeFalse)
			So(token.SeenAt, ShouldEqual, 0)
			So(token.PrevAuthToken, ShouldEqual, prevToken)

			// ability to auth using an old token

			lookedUp, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.AuthTokenSeen, ShouldBeTrue)
			So(lookedUp.SeenAt, ShouldEqual, getTime().Unix())

			lookedUp, err = userAuthTokenService.LookupToken(unhashedPrev)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.Id, ShouldEqual, token.Id)
			So(lookedUp.AuthTokenSeen, ShouldBeTrue)

			getTime = func() time.Time {
				return t.Add(time.Hour + (2 * time.Minute))
			}

			lookedUp, err = userAuthTokenService.LookupToken(unhashedPrev)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.AuthTokenSeen, ShouldBeTrue)

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
			token, err := userAuthTokenService.CreateToken(userID, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)

			lookedUp, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)

			getTime = func() time.Time {
				return t.Add(10 * time.Minute)
			}

			prevToken := token.UnhashedToken
			refreshed, err := userAuthTokenService.RefreshToken(token, "1.1.1.1", "firefox")
			So(err, ShouldBeNil)
			So(refreshed, ShouldBeTrue)

			getTime = func() time.Time {
				return t.Add(20 * time.Minute)
			}

			current, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(current, ShouldNotBeNil)

			prev, err := userAuthTokenService.LookupToken(prevToken)
			So(err, ShouldBeNil)
			So(prev, ShouldNotBeNil)
		})

		Convey("will not mark token unseen when prev and current are the same", func() {
			token, err := userAuthTokenService.CreateToken(userID, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)

			lookedUp, err := userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)

			lookedUp, err = userAuthTokenService.LookupToken(token.UnhashedToken)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)

			lookedUp, err = ctx.getAuthTokenByID(lookedUp.Id)
			So(err, ShouldBeNil)
			So(lookedUp, ShouldNotBeNil)
			So(lookedUp.AuthTokenSeen, ShouldBeTrue)
		})

		Convey("Rotate token", func() {
			token, err := userAuthTokenService.CreateToken(userID, "192.168.10.11:1234", "some user agent")
			So(err, ShouldBeNil)
			So(token, ShouldNotBeNil)

			prevToken := token.AuthToken

			Convey("Should rotate current token and previous token when auth token seen", func() {
				updated, err := ctx.markAuthTokenAsSeen(token.Id)
				So(err, ShouldBeNil)
				So(updated, ShouldBeTrue)

				getTime = func() time.Time {
					return t.Add(10 * time.Minute)
				}

				refreshed, err := userAuthTokenService.RefreshToken(token, "1.1.1.1", "firefox")
				So(err, ShouldBeNil)
				So(refreshed, ShouldBeTrue)

				storedToken, err := ctx.getAuthTokenByID(token.Id)
				So(err, ShouldBeNil)
				So(storedToken, ShouldNotBeNil)
				So(storedToken.AuthTokenSeen, ShouldBeFalse)
				So(storedToken.PrevAuthToken, ShouldEqual, prevToken)
				So(storedToken.AuthToken, ShouldNotEqual, prevToken)

				prevToken = storedToken.AuthToken

				updated, err = ctx.markAuthTokenAsSeen(token.Id)
				So(err, ShouldBeNil)
				So(updated, ShouldBeTrue)

				getTime = func() time.Time {
					return t.Add(20 * time.Minute)
				}

				refreshed, err = userAuthTokenService.RefreshToken(token, "1.1.1.1", "firefox")
				So(err, ShouldBeNil)
				So(refreshed, ShouldBeTrue)

				storedToken, err = ctx.getAuthTokenByID(token.Id)
				So(err, ShouldBeNil)
				So(storedToken, ShouldNotBeNil)
				So(storedToken.AuthTokenSeen, ShouldBeFalse)
				So(storedToken.PrevAuthToken, ShouldEqual, prevToken)
				So(storedToken.AuthToken, ShouldNotEqual, prevToken)
			})

			Convey("Should rotate current token, but keep previous token when auth token not seen", func() {
				token.RotatedAt = getTime().Add(-2 * time.Minute).Unix()

				getTime = func() time.Time {
					return t.Add(2 * time.Minute)
				}

				refreshed, err := userAuthTokenService.RefreshToken(token, "1.1.1.1", "firefox")
				So(err, ShouldBeNil)
				So(refreshed, ShouldBeTrue)

				storedToken, err := ctx.getAuthTokenByID(token.Id)
				So(err, ShouldBeNil)
				So(storedToken, ShouldNotBeNil)
				So(storedToken.AuthTokenSeen, ShouldBeFalse)
				So(storedToken.PrevAuthToken, ShouldEqual, prevToken)
				So(storedToken.AuthToken, ShouldNotEqual, prevToken)
			})
		})

		Reset(func() {
			getTime = time.Now
		})
	})
}

func createTestContext(t *testing.T) *testContext {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)
	tokenService := &UserAuthTokenServiceImpl{
		SQLStore: sqlstore,
		Cfg: &setting.Cfg{
			LoginCookieName:                   "grafana_session",
			LoginCookieMaxDays:                7,
			LoginDeleteExpiredTokensAfterDays: 30,
			LoginCookieRotation:               10,
		},
		log: log.New("test-logger"),
	}

	UrgentRotateTime = time.Minute

	return &testContext{
		sqlstore:     sqlstore,
		tokenService: tokenService,
	}
}

type testContext struct {
	sqlstore     *sqlstore.SqlStore
	tokenService *UserAuthTokenServiceImpl
}

func (c *testContext) getAuthTokenByID(id int64) (*userAuthToken, error) {
	sess := c.sqlstore.NewSession()
	var t userAuthToken
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
