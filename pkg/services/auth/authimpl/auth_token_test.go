package authimpl

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationUserAuthToken(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := createTestContext(t)
	usr := &user.User{ID: int64(10)}

	now := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
	getTime = func() time.Time { return now }
	defer func() { getTime = time.Now }()

	t.Run("When creating token", func(t *testing.T) {
		createToken := func() *auth.UserToken {
			userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  net.ParseIP("192.168.10.11"),
				UserAgent: "some user agent",
			})
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
			require.Equal(t, usr.ID, userToken.UserId)
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
			userToken2, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  net.ParseIP("192.168.10.11"),
				UserAgent: "some user agent",
			})
			require.Nil(t, err)
			require.NotNil(t, userToken2)

			t.Run("Can get first user token", func(t *testing.T) {
				token, err := ctx.tokenService.GetUserToken(context.Background(), usr.ID, userToken.Id)
				require.Nil(t, err)
				require.NotNil(t, token)
				require.Equal(t, userToken.Id, token.Id)
			})

			t.Run("Can get second user token", func(t *testing.T) {
				token, err := ctx.tokenService.GetUserToken(context.Background(), usr.ID, userToken2.Id)
				require.Nil(t, err)
				require.NotNil(t, token)
				require.Equal(t, userToken2.Id, token.Id)
			})

			t.Run("Can get user tokens", func(t *testing.T) {
				tokens, err := ctx.tokenService.GetUserTokens(context.Background(), usr.ID)
				require.Nil(t, err)
				require.Equal(t, 2, len(tokens))
				require.Equal(t, userToken.Id, tokens[0].Id)
				require.Equal(t, userToken2.Id, tokens[1].Id)
			})

			t.Run("Can revoke all user tokens", func(t *testing.T) {
				err := ctx.tokenService.RevokeAllUserTokens(context.Background(), usr.ID)
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
					userId := usr.ID + int64(i+1)
					userIds = append(userIds, userId)
					_, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
						User:      usr,
						ClientIP:  net.ParseIP("192.168.10.11"),
						UserAgent: "some user agent",
					})
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

	t.Run("When creating token with external session", func(t *testing.T) {
		createToken := func() *auth.UserToken {
			userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:            usr,
				ClientIP:        net.ParseIP("192.168.10.11"),
				UserAgent:       "some user agent",
				ExternalSession: &auth.ExternalSession{UserID: usr.ID, AuthModule: "test", UserAuthID: 1},
			})
			require.Nil(t, err)
			require.NotNil(t, userToken)
			require.False(t, userToken.AuthTokenSeen)
			return userToken
		}

		userToken := createToken()

		t.Run("soft revoking existing token should remove the associated external session", func(t *testing.T) {
			err := ctx.tokenService.RevokeToken(context.Background(), userToken, true)
			require.Nil(t, err)

			model, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, model)
			require.Greater(t, model.RevokedAt, int64(0))

			extSess, err := ctx.getExternalSessionByID(userToken.ExternalSessionId)
			require.Nil(t, err)
			require.Nil(t, extSess)
		})

		t.Run("revoking existing token should also remove the associated external session", func(t *testing.T) {
			err := ctx.tokenService.RevokeToken(context.Background(), userToken, false)
			require.Nil(t, err)

			model, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.Nil(t, model)

			extSess, err := ctx.getExternalSessionByID(userToken.ExternalSessionId)
			require.Nil(t, err)
			require.Nil(t, extSess)
		})

		t.Run("When revoking users tokens in a batch", func(t *testing.T) {
			t.Run("Can revoke all users tokens and associated external sessions", func(t *testing.T) {
				userIds := []int64{}
				extSessionIds := []int64{}
				for i := 0; i < 3; i++ {
					userId := usr.ID + int64(i+1)
					userIds = append(userIds, userId)
					token, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
						User:            usr,
						ClientIP:        net.ParseIP("192.168.10.11"),
						UserAgent:       "some user agent",
						ExternalSession: &auth.ExternalSession{UserID: userId, AuthModule: "test", UserAuthID: 1},
					})
					require.Nil(t, err)
					extSessionIds = append(extSessionIds, token.ExternalSessionId)
				}

				err := ctx.tokenService.BatchRevokeAllUserTokens(context.Background(), userIds)
				require.Nil(t, err)

				for i := 0; i < len(userIds); i++ {
					tokens, err := ctx.tokenService.GetUserTokens(context.Background(), userIds[i])
					require.Nil(t, err)
					require.Equal(t, 0, len(tokens))

					extSess, err := ctx.getExternalSessionByID(extSessionIds[i])
					require.Nil(t, err)
					require.Nil(t, extSess)
				}
			})
		})
	})

	t.Run("expires correctly", func(t *testing.T) {
		ctx := createTestContext(t)
		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:      usr,
			ClientIP:  net.ParseIP("192.168.10.11"),
			UserAgent: "some user agent",
		})
		require.Nil(t, err)

		userToken, err = ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)

		getTime = func() time.Time { return now.Add(time.Hour) }

		_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{
			UnHashedToken: userToken.UnhashedToken,
			IP:            net.ParseIP("192.168.10.11"),
			UserAgent:     "some user agent",
		})
		require.Nil(t, err)

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
			_, err := ctx.updateRotatedAt(model.Id, time.Unix(model.CreatedAt, 0).Add(24*25*time.Hour).Unix())
			require.Nil(t, err)

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
		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:      usr,
			ClientIP:  net.ParseIP("192.168.10.11"),
			UserAgent: "some user agent",
		})
		require.Nil(t, err)

		prevToken := userToken.AuthToken
		unhashedPrev := userToken.UnhashedToken

		model, err := ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)

		model.UnhashedToken = userToken.UnhashedToken
		getTime = func() time.Time { return now.Add(time.Hour) }

		newToken, err := ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{
			UnHashedToken: model.UnhashedToken,
			IP:            net.ParseIP("192.168.10.12"),
			UserAgent:     "a new user agent",
		})
		require.Nil(t, err)

		model, err = ctx.getAuthTokenByID(model.Id)
		require.Nil(t, err)
		model.UnhashedToken = newToken.UnhashedToken

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

		_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{
			UnHashedToken: userToken.UnhashedToken,
			IP:            net.ParseIP("192.168.10.12"),
			UserAgent:     "a new user agent",
		})
		require.Nil(t, err)

		model, err = ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)
		require.NotNil(t, model)
		require.Equal(t, int64(0), model.SeenAt)
	})

	t.Run("keeps prev token valid for 1 minute after it is confirmed", func(t *testing.T) {
		getTime = func() time.Time { return now }
		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:      usr,
			ClientIP:  net.ParseIP("192.168.10.11"),
			UserAgent: "some user agent",
		})
		require.Nil(t, err)
		require.NotNil(t, userToken)

		lookedUpUserToken, err := ctx.tokenService.LookupToken(context.Background(), userToken.UnhashedToken)
		require.Nil(t, err)
		require.NotNil(t, lookedUpUserToken)

		getTime = func() time.Time { return now.Add(10 * time.Minute) }

		prevToken := userToken.UnhashedToken
		_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{
			UnHashedToken: userToken.UnhashedToken,
			IP:            net.ParseIP("1.1.1.1"),
			UserAgent:     "firefox",
		})
		require.Nil(t, err)

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
		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:      usr,
			ClientIP:  net.ParseIP("192.168.10.11"),
			UserAgent: "some user agent",
		})
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

	t.Run("RotateToken", func(t *testing.T) {
		advanceTime := func(d time.Duration) {
			currentTime := getTime()
			getTime = func() time.Time {
				return currentTime.Add(d)
			}
		}

		var prev string
		token, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:      usr,
			ClientIP:  nil,
			UserAgent: "",
		})
		require.NoError(t, err)
		t.Run("should rotate token when called with current auth token", func(t *testing.T) {
			advanceTime(SkipRotationTime + 1*time.Second)
			prev = token.UnhashedToken
			token, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: token.UnhashedToken})
			require.NoError(t, err)
			assert.True(t, token.UnhashedToken != prev)
			assert.True(t, token.PrevAuthToken == hashToken("", prev))
		})

		t.Run("should rotate token when called with previous", func(t *testing.T) {
			advanceTime(SkipRotationTime + 1*time.Second)
			newPrev := token.UnhashedToken
			token, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: prev})
			require.NoError(t, err)
			assert.True(t, token.PrevAuthToken == hashToken("", newPrev))
		})

		t.Run("should not rotate token when called with old previous", func(t *testing.T) {
			advanceTime(SkipRotationTime + 1*time.Second)
			_, err = ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: prev})
			require.ErrorIs(t, err, auth.ErrUserTokenNotFound)
		})

		t.Run("should not rotate token when last rotation happened recently", func(t *testing.T) {
			advanceTime(SkipRotationTime + 1*time.Second)
			prevToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  nil,
				UserAgent: "",
			})
			require.NoError(t, err)

			advanceTime(SkipRotationTime + 1*time.Second)
			rotatedToken, err := ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: prevToken.UnhashedToken})
			require.NoError(t, err)
			assert.True(t, rotatedToken.UnhashedToken != prevToken.UnhashedToken)
			assert.True(t, rotatedToken.PrevAuthToken == hashToken("", prevToken.UnhashedToken))

			// Should not rotate because it already rotated less than 5s ago
			skippedToken, err := ctx.tokenService.RotateToken(context.Background(), auth.RotateCommand{UnHashedToken: rotatedToken.UnhashedToken})
			require.NoError(t, err)
			assert.True(t, skippedToken.UnhashedToken == rotatedToken.UnhashedToken)
			assert.True(t, skippedToken.PrevAuthToken == hashToken("", prevToken.UnhashedToken))
		})

		t.Run("should return error when token is revoked", func(t *testing.T) {
			revokedToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  nil,
				UserAgent: "",
			})
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
			expiredToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  nil,
				UserAgent: "",
			})
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

		t.Run("should only delete revoked tokens that are outside on specified window", func(t *testing.T) {
			usr := &user.User{ID: 100}
			token1, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  nil,
				UserAgent: "",
			})
			require.NoError(t, err)

			token2, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:      usr,
				ClientIP:  nil,
				UserAgent: "",
			})
			require.NoError(t, err)

			getTime = func() time.Time {
				return time.Now()
			}
			// revoked token1 with time now
			err = ctx.tokenService.RevokeToken(context.Background(), token1, true)
			require.NoError(t, err)

			getTime = func() time.Time {
				return time.Now().Add(-25 * time.Hour)
			}
			// revoked token1 with time at 25 hours ago
			err = ctx.tokenService.RevokeToken(context.Background(), token2, true)
			require.NoError(t, err)

			err = ctx.tokenService.DeleteUserRevokedTokens(context.Background(), usr.ID, 24*time.Hour)
			require.NoError(t, err)

			revokedTokens, err := ctx.tokenService.GetUserRevokedTokens(context.Background(), usr.ID)
			require.NoError(t, err)
			assert.Len(t, revokedTokens, 1)

			getTime = time.Now
		})
	})

	t.Run("When populating userAuthToken from UserToken should copy all properties", func(t *testing.T) {
		ut := auth.UserToken{
			Id:                1,
			UserId:            2,
			AuthToken:         "a",
			PrevAuthToken:     "b",
			UserAgent:         "c",
			ClientIp:          "d",
			AuthTokenSeen:     true,
			SeenAt:            3,
			RotatedAt:         4,
			CreatedAt:         5,
			UpdatedAt:         6,
			UnhashedToken:     "e",
			ExternalSessionId: 7,
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
			Id:                1,
			UserId:            2,
			AuthToken:         "a",
			PrevAuthToken:     "b",
			UserAgent:         "c",
			ClientIp:          "d",
			AuthTokenSeen:     true,
			SeenAt:            3,
			RotatedAt:         4,
			CreatedAt:         5,
			UpdatedAt:         6,
			UnhashedToken:     "e",
			ExternalSessionId: 7,
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
	tracer := tracing.InitializeTracerForTest()

	cfg := &setting.Cfg{
		LoginMaxInactiveLifetime:     maxInactiveDurationVal,
		LoginMaxLifetime:             maxLifetimeDurationVal,
		TokenRotationIntervalMinutes: 10,
	}

	extSessionStore := provideExternalSessionStore(sqlstore, &fakes.FakeSecretsService{}, tracer)

	tokenService := &UserAuthTokenService{
		sqlStore:             sqlstore,
		cfg:                  cfg,
		log:                  log.New("test-logger"),
		singleflight:         new(singleflight.Group),
		externalSessionStore: extSessionStore,
		features:             featuremgmt.WithFeatures(featuremgmt.FlagSkipTokenRotationIfRecent),
		tracer:               tracer,
	}

	return &testContext{
		sqlstore:        sqlstore,
		tokenService:    tokenService,
		extSessionStore: &extSessionStore,
	}
}

type testContext struct {
	sqlstore        db.DB
	tokenService    *UserAuthTokenService
	extSessionStore *auth.ExternalSessionStore
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

func (c *testContext) getExternalSessionByID(ID int64) (*auth.ExternalSession, error) {
	var res *auth.ExternalSession
	err := c.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var t auth.ExternalSession
		found, err := sess.ID(ID).Get(&t)
		if err != nil || !found {
			return err
		}

		res = &t
		return nil
	})

	return res, err
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

func TestIntegrationTokenCount(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := createTestContext(t)
	user := &user.User{ID: int64(10)}

	createToken := func() *auth.UserToken {
		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:      user,
			ClientIP:  net.ParseIP("192.168.10.11"),
			UserAgent: "some user agent",
		})
		require.Nil(t, err)
		require.NotNil(t, userToken)
		require.False(t, userToken.AuthTokenSeen)
		return userToken
	}

	createToken()

	now := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
	getTime = func() time.Time { return now }
	defer func() { getTime = time.Now }()

	count, err := ctx.tokenService.ActiveTokenCount(context.Background(), nil)
	require.Nil(t, err)
	require.Equal(t, int64(1), count)

	var userID int64 = 10
	count, err = ctx.tokenService.ActiveTokenCount(context.Background(), &userID)
	require.Nil(t, err)
	require.Equal(t, int64(1), count)

	userID = 11
	count, err = ctx.tokenService.ActiveTokenCount(context.Background(), &userID)
	require.Nil(t, err)
	require.Equal(t, int64(0), count)
}

func TestIntegrationRevokeAllUserTokens(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should not fail if the external sessions could not be removed", func(t *testing.T) {
		ctx := createTestContext(t)
		usr := &user.User{ID: int64(10)}

		// Mock the external session store to return an error
		mockExternalSessionStore := &authtest.MockExternalSessionStore{}

		mockExternalSessionStore.On("Create", mock.Anything, mock.IsType(&auth.ExternalSession{})).Run(func(args mock.Arguments) {
			extSession := args.Get(1).(*auth.ExternalSession)
			extSession.ID = 1
		}).Return(nil)
		mockExternalSessionStore.On("DeleteExternalSessionsByUserID", mock.Anything, usr.ID).Return(errors.New("some error"))
		ctx.tokenService.externalSessionStore = mockExternalSessionStore

		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:            usr,
			ClientIP:        net.ParseIP("192.168.10.11"),
			UserAgent:       "some user agent",
			ExternalSession: &auth.ExternalSession{UserID: usr.ID, AuthModule: "test", UserAuthID: 1},
		})
		require.Nil(t, err)
		require.NotNil(t, userToken)

		err = ctx.tokenService.RevokeAllUserTokens(context.Background(), usr.ID)
		require.Nil(t, err)

		model, err := ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)
		require.Nil(t, model)
	})
}

func TestIntegrationRevokeToken(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should not fail if the external sessions could not be removed", func(t *testing.T) {
		ctx := createTestContext(t)
		usr := &user.User{ID: int64(10)}
		mockExternalSessionStore := &authtest.MockExternalSessionStore{}

		mockExternalSessionStore.On("Create", mock.Anything, mock.IsType(&auth.ExternalSession{})).Run(func(args mock.Arguments) {
			extSession := args.Get(1).(*auth.ExternalSession)
			extSession.ID = 2
		}).Return(nil)
		mockExternalSessionStore.On("Delete", mock.Anything, int64(2)).Return(errors.New("some error"))
		ctx.tokenService.externalSessionStore = mockExternalSessionStore

		userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
			User:            usr,
			ClientIP:        net.ParseIP("192.168.10.11"),
			UserAgent:       "some user agent",
			ExternalSession: &auth.ExternalSession{UserID: usr.ID, AuthModule: "test", UserAuthID: 1},
		})
		require.Nil(t, err)
		require.NotNil(t, userToken)

		err = ctx.tokenService.RevokeToken(context.Background(), userToken, false)
		require.Nil(t, err)

		model, err := ctx.getAuthTokenByID(userToken.Id)
		require.Nil(t, err)
		require.Nil(t, model)
	})
}

func TestIntegrationBatchRevokeAllUserTokens(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should not fail if the external sessions could not be removed", func(t *testing.T) {
		ctx := createTestContext(t)
		userIds := []int64{1, 2, 3}
		mockExternalSessionStore := &authtest.MockExternalSessionStore{}

		mockExternalSessionStore.On("BatchDeleteExternalSessionsByUserIDs", mock.Anything, userIds).Return(errors.New("some error"))
		ctr := int64(0)
		mockExternalSessionStore.On("Create", mock.Anything, mock.IsType(&auth.ExternalSession{})).Run(func(args mock.Arguments) {
			extSession := args.Get(1).(*auth.ExternalSession)
			ctr += 1
			extSession.ID = ctr
		}).Return(nil)

		ctx.tokenService.externalSessionStore = mockExternalSessionStore

		for _, userID := range userIds {
			usr := &user.User{ID: userID}
			userToken, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{
				User:            usr,
				ClientIP:        net.ParseIP("192.168.10.11"),
				UserAgent:       "some user agent",
				ExternalSession: &auth.ExternalSession{UserID: usr.ID, AuthModule: "test", UserAuthID: 1},
			})
			require.Nil(t, err)
			require.NotNil(t, userToken)
		}

		// Batch revoke all user tokens
		err := ctx.tokenService.BatchRevokeAllUserTokens(context.Background(), userIds)
		require.Nil(t, err)

		// Verify that the tokens have been revoked
		for _, userID := range userIds {
			tokens, err := ctx.tokenService.GetUserTokens(context.Background(), userID)
			require.Nil(t, err)
			require.Equal(t, 0, len(tokens))
		}
	})
}
