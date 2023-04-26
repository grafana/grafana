package authimpl

import (
	"context"
	"encoding/json"
	"net"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserAuthToken(t *testing.T) {
	ctx := createTestContext(t)
	user := &user.User{ID: int64(10)}
	// userID := user.Id

	now := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
	getTime = func() time.Time { return now }
	defer func() { getTime = time.Now }()

	t.Run("When creating token", func(t *testing.T) {
		createToken := func() *auth.UserToken {
			userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.Nil(t, err)
			require.NotNil(t, userToken)
			require.False(t, userToken.AuthTokenSeen)
			return userToken
		}

		userToken := createToken()

		t.Run("Can count active tokens", func(t *testing.T) {
			m, err := ctx.tokenService.reportActiveTokenCount(context.Background(), &quota.ScopeParameters{})
			require.Nil(t, err)
			tag, err := quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, quota.GlobalScope)
			require.NoError(t, err)
			count, ok := m.Get(tag)
			require.True(t, ok)
			require.Equal(t, int64(1), count)
		})

		t.Run("When lookup unhashed token should return user auth token", func(t *testing.T) {
			userToken, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.Nil(t, err)
			require.NotNil(t, userToken)
			require.Equal(t, user.ID, userToken.UserId)
			require.True(t, userToken.AuthTokenSeen)

			storedAuthToken, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, storedAuthToken)
			require.True(t, storedAuthToken.AuthTokenSeen)
		})

		t.Run("When lookup hashed token should return user auth token not found error", func(t *testing.T) {
			userToken, err := ctx.tokenService.LookupToken(context.Background(), userToken.AuthToken)
			require.Equal(t, auth.ErrUserTokenNotFound, err)
			require.Nil(t, userToken)
		})

		t.Run("soft revoking existing token should not delete it", func(t *testing.T) {
			err := ctx.tokenService.RevokeToken(context.Background(), userToken, true)
			require.Nil(t, err)

			model, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, model)
			require.Greater(t, model.RevokedAt, int64(0))
		})

		t.Run("revoking existing token should delete it", func(t *testing.T) {
			err := ctx.tokenService.RevokeToken(context.Background(), userToken, false)
			require.Nil(t, err)

			model, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.Nil(t, model)
		})

		t.Run("revoking nil token should return error", func(t *testing.T) {
			err := ctx.tokenService.RevokeToken(context.Background(), nil, false)
			require.Equal(t, auth.ErrUserTokenNotFound, err)
		})

		t.Run("revoking non-existing token should return error", func(t *testing.T) {
			userToken.Id = 1000
			err := ctx.tokenService.RevokeToken(context.Background(), userToken, false)
			require.Equal(t, auth.ErrUserTokenNotFound, err)
		})

		ctx = createTestContext(t)
		userToken = createToken()

		t.Run("When creating an additional token", func(t *testing.T) {
			userToken2, err := ctx.tokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.Nil(t, err)
			require.NotNil(t, userToken2)

			t.Run("Can get first user token", func(t *testing.T) {
				token, err := ctx.tokenService.GetUserToken(context.Background(), user.ID, userToken.Id)
				require.Nil(t, err)
				require.NotNil(t, token)
				require.Equal(t, userToken.Id, token.Id)
			})

			t.Run("Can get second user token", func(t *testing.T) {
				token, err := ctx.tokenService.GetUserToken(context.Background(), user.ID, userToken2.Id)
				require.Nil(t, err)
				require.NotNil(t, token)
				require.Equal(t, userToken2.Id, token.Id)
			})

			t.Run("Can get user tokens", func(t *testing.T) {
				tokens, err := ctx.tokenService.GetUserTokens(context.Background(), user.ID)
				require.Nil(t, err)
				require.Equal(t, 2, len(tokens))
				require.Equal(t, userToken.Id, tokens[0].Id)
				require.Equal(t, userToken2.Id, tokens[1].Id)
			})

			t.Run("Can revoke all user tokens", func(t *testing.T) {
				err := ctx.tokenService.RevokeAllUserTokens(context.Background(), user.ID)
				require.Nil(t, err)

				model, err := ctx.getAuthTokenByID(userToken.Id)
				require.Nil(t, err)
				require.Nil(t, model)

				model2, err := ctx.getAuthTokenByID(userToken2.Id)
				require.Nil(t, err)
				require.Nil(t, model2)
			})
		})

		t.Run("When revoking users tokens in a batch", func(t *testing.T) {
			t.Run("Can revoke all users tokens", func(t *testing.T) {
				userIds := []int64{}
				for i := 0; i < 3; i++ {
					userId := user.ID + int64(i+1)
					userIds = append(userIds, userId)
					_, err := ctx.tokenService.CreateToken(context.Background(), user,
						net.ParseIP("192.168.10.11"), "some user agent")
					require.Nil(t, err)
				}

				err := ctx.tokenService.BatchRevokeAllUserTokens(context.Background(), userIds)
				require.Nil(t, err)

				for _, v := range userIds {
					tokens, err := ctx.tokenService.GetUserTokens(context.Background(), v)
					require.Nil(t, err)
					require.Equal(t, 0, len(tokens))
				}
			})
		})
	})

	t.Run("expires correctly", func(t *testing.T) {
		ctx := createTestContext(t)
		userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
			net.ParseIP("192.168.10.11"), "some user agent")
		require.Nil(t, err)

		userToken, err = ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)

		getTime = func() time.Time { return now.Add(time.Hour) }

		rotated, _, err := ctx.tokenService.TryRotateToken(context.Background(), userToken,
			net.ParseIP("192.168.10.11"), "some user agent")
		require.Nil(t, err)
		require.True(t, rotated)

		userToken, err = ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)

		stillGood, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, stillGood)

		model, err := ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)

		t.Run("when rotated_at is 6:59:59 ago should find token", func(t *testing.T) {
			getTime = func() time.Time {
				return time.Unix(model.RotatedAt, 0).Add(24 * 7 * time.Hour).Add(-time.Second)
			}

			stillGood, err = ctx.tokenService.LookupToken(context.Background(), stillGood.UnhashedToken)
			require.Nil(t, err)
			require.NotNil(t, stillGood)
		})

		t.Run("when rotated_at is 7:00:00 ago should return token expired error", func(t *testing.T) {
			getTime = func() time.Time {
				return time.Unix(model.RotatedAt, 0).Add(24 * 7 * time.Hour)
			}

			notGood, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.Equal(t, reflect.TypeOf(err), reflect.TypeOf(&auth.TokenExpiredError{}))
			require.Nil(t, notGood)

			t.Run("should not find active token when expired", func(t *testing.T) {
				m, err := ctx.tokenService.reportActiveTokenCount(context.Background(), &quota.ScopeParameters{})
				require.Nil(t, err)
				tag, err := quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, quota.GlobalScope)
				require.NoError(t, err)
				count, ok := m.Get(tag)
				require.True(t, ok)
				require.Equal(t, int64(0), count)
			})
		})

		t.Run("when rotated_at is 5 days ago and created_at is 29 days and 23:59:59 ago should not find token", func(t *testing.T) {
			updated, err := ctx.updateRotatedAt(model.Id, time.Unix(model.CreatedAt, 0).Add(24*25*time.Hour).Unix())
			require.Nil(t, err)
			require.True(t, updated)

			getTime = func() time.Time {
				return time.Unix(model.CreatedAt, 0).Add(24 * 30 * time.Hour).Add(-time.Second)
			}

			stillGood, err = ctx.tokenService.LookupToken(context.Background(), stillGood.UnhashedToken)
			require.Nil(t, err)
			require.NotNil(t, stillGood)
		})

		t.Run("when rotated_at is 5 days ago and created_at is 30 days ago should return token expired error", func(t *testing.T) {
			updated, err := ctx.updateRotatedAt(model.Id, time.Unix(model.CreatedAt, 0).Add(24*25*time.Hour).Unix())
			require.Nil(t, err)
			require.True(t, updated)

			getTime = func() time.Time {
				return time.Unix(model.CreatedAt, 0).Add(24 * 30 * time.Hour)
			}

			notGood, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.Equal(t, reflect.TypeOf(err), reflect.TypeOf(&auth.TokenExpiredError{}))
			require.Nil(t, notGood)
		})
	})

	t.Run("can properly rotate tokens", func(t *testing.T) {
		getTime = func() time.Time { return now }
		ctx := createTestContext(t)
		userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
			net.ParseIP("192.168.10.11"), "some user agent")
		require.Nil(t, err)

		prevToken := userToken.AuthToken
		unhashedPrev := userToken.UnhashedToken

		rotated, _, err := ctx.tokenService.TryRotateToken(context.Background(), userToken,
			net.ParseIP("192.168.10.12"), "a new user agent")
		require.Nil(t, err)
		require.False(t, rotated)

		updated, err := ctx.markAuthTokenAsSeen(userToken.Id)
		require.Nil(t, err)
		require.True(t, updated)

		model, err := ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)

		var tok auth.UserToken
		err = model.toUserToken(&tok)
		require.Nil(t, err)

		getTime = func() time.Time { return now.Add(time.Hour) }

		rotated, newToken, err := ctx.tokenService.TryRotateToken(context.Background(), &tok,
			net.ParseIP("192.168.10.12"), "a new user agent")
		require.Nil(t, err)
		require.True(t, rotated)

		unhashedToken := newToken.UnhashedToken

		model, err = ctx.getAuthTokenByID(tok.Id)
		require.Nil(t, err)
		model.UnhashedToken = unhashedToken

		require.Equal(t, getTime().Unix(), model.RotatedAt)
		require.Equal(t, "192.168.10.12", model.ClientIp)
		require.Equal(t, "a new user agent", model.UserAgent)
		require.False(t, model.AuthTokenSeen)
		require.Equal(t, int64(0), model.SeenAt)
		require.Equal(t, prevToken, model.PrevAuthToken)

		// ability to auth using an old token

		lookedUpUserToken, err := ctx.tokenService.LookupToken(context.Background(), model.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)
		require.True(t, lookedUpUserToken.AuthTokenSeen)
		require.Equal(t, getTime().Unix(), lookedUpUserToken.SeenAt)

		lookedUpUserToken, err = ctx.tokenService.LookupToken(context.Background(), unhashedPrev)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)
		require.Equal(t, model.Id, lookedUpUserToken.Id)
		require.False(t, lookedUpUserToken.AuthTokenSeen)

		getTime = func() time.Time {
			return now.Add(time.Hour + (2 * time.Minute))
		}

		lookedUpUserToken, err = ctx.tokenService.LookupToken(context.Background(), unhashedPrev)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)
		require.False(t, lookedUpUserToken.AuthTokenSeen)

		lookedUpModel, err := ctx.getAuthTokenByID(lookedUpUserToken.Id)
		require.Nil(t, err)
		require.NotNil(t, lookedUpModel)
		require.False(t, lookedUpModel.AuthTokenSeen)

		rotated, _, err = ctx.tokenService.TryRotateToken(context.Background(), userToken,
			net.ParseIP("192.168.10.12"), "a new user agent")
		require.Nil(t, err)
		require.True(t, rotated)

		model, err = ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)
		require.NotNil(t, model)
		require.Equal(t, int64(0), model.SeenAt)
	})

	t.Run("keeps prev token valid for 1 minute after it is confirmed", func(t *testing.T) {
		getTime = func() time.Time { return now }
		userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
			net.ParseIP("192.168.10.11"), "some user agent")
		require.Nil(t, err)
		require.NotNil(t, userToken)

		lookedUpUserToken, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)

		getTime = func() time.Time { return now.Add(10 * time.Minute) }

		prevToken := userToken.UnhashedToken
		rotated, _, err := ctx.tokenService.TryRotateToken(context.Background(), userToken,
			net.ParseIP("1.1.1.1"), "firefox")
		require.Nil(t, err)
		require.True(t, rotated)

		getTime = func() time.Time {
			return now.Add(20 * time.Minute)
		}

		currentUserToken, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, currentUserToken)

		prevUserToken, err := ctx.tokenService.LookupToken(context.Background(), prevToken)
		require.Nil(t, err)
		require.NotNil(t, prevUserToken)
	})

	t.Run("will not mark token unseen when prev and current are the same", func(t *testing.T) {
		userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
			net.ParseIP("192.168.10.11"), "some user agent")
		require.Nil(t, err)
		require.NotNil(t, userToken)

		lookedUpUserToken, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)

		lookedUpUserToken, err = ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)

		lookedUpModel, err := ctx.getAuthTokenByID(lookedUpUserToken.Id)
		require.Nil(t, err)
		require.NotNil(t, lookedUpModel)
		require.True(t, lookedUpModel.AuthTokenSeen)
	})

	t.Run("TryRotateToken", func(t *testing.T) {
		t.Run("Should rotate current token and previous token when auth token seen", func(t *testing.T) {
			getTime = func() time.Time { return now }
			userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.Nil(t, err)
			require.NotNil(t, userToken)

			prevToken := userToken.AuthToken

			updated, err := ctx.markAuthTokenAsSeen(userToken.Id)
			require.Nil(t, err)
			require.True(t, updated)

			getTime = func() time.Time {
				return now.Add(10 * time.Minute)
			}

			rotated, _, err := ctx.tokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("1.1.1.1"), "firefox")
			require.Nil(t, err)
			require.True(t, rotated)

			storedToken, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, storedToken)
			require.False(t, storedToken.AuthTokenSeen)
			require.Equal(t, prevToken, storedToken.PrevAuthToken)
			require.NotEqual(t, prevToken, storedToken.AuthToken)

			prevToken = storedToken.AuthToken

			updated, err = ctx.markAuthTokenAsSeen(userToken.Id)
			require.Nil(t, err)
			require.True(t, updated)

			getTime = func() time.Time {
				return now.Add(20 * time.Minute)
			}

			rotated, _, err = ctx.tokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("1.1.1.1"), "firefox")
			require.Nil(t, err)
			require.True(t, rotated)

			storedToken, err = ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, storedToken)
			require.False(t, storedToken.AuthTokenSeen)
			require.Equal(t, prevToken, storedToken.PrevAuthToken)
			require.NotEqual(t, prevToken, storedToken.AuthToken)
		})

		t.Run("Should rotate current token, but keep previous token when auth token not seen", func(t *testing.T) {
			getTime = func() time.Time { return now }
			userToken, err := ctx.tokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.Nil(t, err)
			require.NotNil(t, userToken)

			prevToken := userToken.AuthToken
			userToken.RotatedAt = now.Add(-2 * time.Minute).Unix()

			getTime = func() time.Time {
				return now.Add(2 * time.Minute)
			}

			rotated, _, err := ctx.tokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("1.1.1.1"), "firefox")
			require.Nil(t, err)
			require.True(t, rotated)

			storedToken, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, storedToken)
			require.False(t, storedToken.AuthTokenSeen)
			require.Equal(t, prevToken, storedToken.PrevAuthToken)
			require.NotEqual(t, prevToken, storedToken.AuthToken)
		})
	})

	t.Run("RotateToken", func(t *testing.T) {
		var prev string
		token, err := ctx.tokenService.CreateToken(context.Background(), user, nil, "")
		require.NoError(t, err)
		t.Run("should rotate token when called with current auth token", func(t *testing.T) {
			prev = token.UnhashedToken
			token, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: token.UnhashedToken})
			require.NoError(t, err)
			assert.True(t, token.UnhashedToken != prev)
			assert.True(t, token.PrevAuthToken == hashToken(prev))
		})

		t.Run("should rotate token when called with previous", func(t *testing.T) {
			newPrev := token.UnhashedToken
			token, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: prev})
			require.NoError(t, err)
			assert.True(t, token.PrevAuthToken == hashToken(newPrev))
		})

		t.Run("should not rotate token when called with old previous", func(t *testing.T) {
			_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: prev})
			require.ErrorIs(t, err, auth.ErrUserTokenNotFound)
		})

		t.Run("should return error when token is revoked", func(t *testing.T) {
			revokedToken, err := ctx.tokenService.CreateToken(context.Background(), user, nil, "")
			require.NoError(t, err)
			// mark token as revoked
			err = ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
				_, err := sess.Exec("UPDATE user_auth_token SET revoked_at = 1 WHERE id = ?", revokedToken.Id)
				return err
			})
			require.NoError(t, err)

			_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: revokedToken.UnhashedToken})
			assert.ErrorIs(t, err, auth.ErrInvalidSessionToken)
		})

		t.Run("should return error when token has expired", func(t *testing.T) {
			expiredToken, err := ctx.tokenService.CreateToken(context.Background(), user, nil, "")
			require.NoError(t, err)
			// mark token as expired
			err = ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
				_, err := sess.Exec("UPDATE user_auth_token SET created_at = 1 WHERE id = ?", expiredToken.Id)
				return err
			})
			require.NoError(t, err)

			_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: expiredToken.UnhashedToken})
			assert.ErrorIs(t, err, auth.ErrInvalidSessionToken)
		})
	})

	t.Run("When populating userAuthToken from UserToken should copy all properties", func(t *testing.T) {
		ut := auth.UserToken{
			Id:            1,
			UserId:        2,
			AuthToken:     "a",
			PrevAuthToken: "b",
			UserAgent:     "c",
			ClientIp:      "d",
			AuthTokenSeen: true,
			SeenAt:        3,
			RotatedAt:     4,
			CreatedAt:     5,
			UpdatedAt:     6,
			UnhashedToken: "e",
		}
		utBytes, err := json.Marshal(ut)
		require.Nil(t, err)
		utJSON, err := simplejson.NewJson(utBytes)
		require.Nil(t, err)
		utMap := utJSON.MustMap()

		var uat userAuthToken
		err = uat.fromUserToken(&ut)
		require.Nil(t, err)
		uatBytes, err := json.Marshal(uat)
		require.Nil(t, err)
		uatJSON, err := simplejson.NewJson(uatBytes)
		require.Nil(t, err)
		uatMap := uatJSON.MustMap()

		require.True(t, reflect.DeepEqual(uatMap, utMap))
	})

	t.Run("When populating userToken from userAuthToken should copy all properties", func(t *testing.T) {
		uat := userAuthToken{
			Id:            1,
			UserId:        2,
			AuthToken:     "a",
			PrevAuthToken: "b",
			UserAgent:     "c",
			ClientIp:      "d",
			AuthTokenSeen: true,
			SeenAt:        3,
			RotatedAt:     4,
			CreatedAt:     5,
			UpdatedAt:     6,
			UnhashedToken: "e",
		}
		uatBytes, err := json.Marshal(uat)
		require.Nil(t, err)
		uatJSON, err := simplejson.NewJson(uatBytes)
		require.Nil(t, err)
		uatMap := uatJSON.MustMap()

		var ut auth.UserToken
		err = uat.toUserToken(&ut)
		require.Nil(t, err)
		utBytes, err := json.Marshal(ut)
		require.Nil(t, err)
		utJSON, err := simplejson.NewJson(utBytes)
		require.Nil(t, err)
		utMap := utJSON.MustMap()

		require.True(t, reflect.DeepEqual(utMap, uatMap))
	})
}

func createTestContext(t *testing.T) *testContext {
	t.Helper()
	maxInactiveDurationVal, _ := time.ParseDuration("168h")
	maxLifetimeDurationVal, _ := time.ParseDuration("720h")
	sqlstore := db.InitTestDB(t)

	cfg := &setting.Cfg{
		LoginMaxInactiveLifetime:     maxInactiveDurationVal,
		LoginMaxLifetime:             maxLifetimeDurationVal,
		TokenRotationIntervalMinutes: 10,
	}

	tokenService := &UserAuthTokenService{
		sqlStore:     sqlstore,
		cfg:          cfg,
		log:          log.New("test-logger"),
		singleflight: new(singleflight.Group),
	}

	return &testContext{
		sqlstore:     sqlstore,
		tokenService: tokenService,
	}
}

type testContext struct {
	sqlstore     db.DB
	tokenService *UserAuthTokenService
}

func (c *testContext) getAuthTokenByID(id int64) (*userAuthToken, error) {
	var res *userAuthToken
	err := c.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var t userAuthToken
		found, err := sess.ID(id).Get(&t)
		if err != nil || !found {
			return err
		}

		res = &t
		return nil
	})

	return res, err
}

func (c *testContext) markAuthTokenAsSeen(id int64) (bool, error) {
	hasRowsAffected := false
	err := c.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
		res, err := sess.Exec("UPDATE user_auth_token SET auth_token_seen = ? WHERE id = ?", c.sqlstore.GetDialect().BooleanStr(true), id)
		if err != nil {
			return err
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return err
		}
		hasRowsAffected = rowsAffected == 1
		return nil
	})
	return hasRowsAffected, err
}

func (c *testContext) updateRotatedAt(id, rotatedAt int64) (bool, error) {
	hasRowsAffected := false
	err := c.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
		res, err := sess.Exec("UPDATE user_auth_token SET rotated_at = ? WHERE id = ?", rotatedAt, id)
		if err != nil {
			return err
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return err
		}

		hasRowsAffected = rowsAffected == 1
		return nil
	})
	return hasRowsAffected, err
}
