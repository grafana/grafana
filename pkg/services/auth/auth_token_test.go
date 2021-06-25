package auth

import (
	"context"
	"encoding/json"
	"net"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestUserAuthToken(t *testing.T) {
	t.Run("Test user auth token", func(t *testing.T) {
		ctx := createTestContext(t)
		userAuthTokenService := ctx.tokenService
		user := &models.User{Id: int64(10)}
		userID := user.Id

		dt := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
		getTime = func() time.Time {
			return dt
		}

		t.Run("When creating token", func(t *testing.T) {
			userToken, err := userAuthTokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)
			require.NotNil(t, userToken)
			require.False(t, userToken.AuthTokenSeen)

			t.Run("Can count active tokens", func(t *testing.T) {
				count, err := userAuthTokenService.ActiveTokenCount(context.Background())
				require.NoError(t, err)
				require.Equal(t, int64(1), count)
			})

			t.Run("When lookup unhashed token should return user auth token", func(t *testing.T) {
				userToken, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
				require.NoError(t, err)
				require.NotNil(t, userToken)
				require.Equal(t, userID, userToken.UserId)
				require.True(t, userToken.AuthTokenSeen)

				storedAuthToken, err := ctx.getAuthTokenByID(userToken.Id)
				require.NoError(t, err)
				require.NotNil(t, storedAuthToken)
				require.True(t, storedAuthToken.AuthTokenSeen)
			})

			t.Run("When lookup hashed token should return user auth token not found error", func(t *testing.T) {
				userToken, err := userAuthTokenService.LookupToken(context.Background(), userToken.AuthToken)
				require.Equal(t, models.ErrUserTokenNotFound, err)
				require.Nil(t, userToken)
			})

			t.Run("soft revoking existing token should not delete it", func(t *testing.T) {
				err = userAuthTokenService.RevokeToken(context.Background(), userToken, true)
				require.NoError(t, err)

				model, err := ctx.getAuthTokenByID(userToken.Id)
				require.NoError(t, err)
				require.NotNil(t, model)
				require.Greater(t, model.RevokedAt, int64(0))
			})

			t.Run("revoking existing token should delete it", func(t *testing.T) {
				err = userAuthTokenService.RevokeToken(context.Background(), userToken, false)
				require.NoError(t, err)

				model, err := ctx.getAuthTokenByID(userToken.Id)
				require.NoError(t, err)
				require.Nil(t, model)
			})

			t.Run("revoking nil token should return error", func(t *testing.T) {
				err = userAuthTokenService.RevokeToken(context.Background(), nil, false)
				require.Equal(t, models.ErrUserTokenNotFound, err)
			})

			t.Run("revoking non-existing token should return error", func(t *testing.T) {
				userToken.Id = 1000
				err = userAuthTokenService.RevokeToken(context.Background(), userToken, false)
				require.Equal(t, models.ErrUserTokenNotFound, err)
			})

			t.Run("When creating an additional token", func(t *testing.T) {
				userToken2, err := userAuthTokenService.CreateToken(context.Background(), user,
					net.ParseIP("192.168.10.11"), "some user agent")
				require.NoError(t, err)
				require.NotNil(t, userToken2)

				t.Run("Can get first user token", func(t *testing.T) {
					token, err := userAuthTokenService.GetUserToken(context.Background(), userID, userToken.Id)
					require.NoError(t, err)
					require.NotNil(t, token)
					require.Equal(t, userToken.Id, token.Id)
				})

				t.Run("Can get second user token", func(t *testing.T) {
					token, err := userAuthTokenService.GetUserToken(context.Background(), userID, userToken2.Id)
					require.NoError(t, err)
					require.NotNil(t, token)
					require.Equal(t, userToken2.Id, token.Id)
				})

				t.Run("Can get user tokens", func(t *testing.T) {
					tokens, err := userAuthTokenService.GetUserTokens(context.Background(), userID)
					require.NoError(t, err)
					require.Equal(t, 2, len(tokens))
					require.Equal(t, userToken.Id, tokens[0].Id)
					require.Equal(t, userToken2.Id, tokens[1].Id)
				})

				t.Run("Can revoke all user tokens", func(t *testing.T) {
					err := userAuthTokenService.RevokeAllUserTokens(context.Background(), userID)
					require.NoError(t, err)

					model, err := ctx.getAuthTokenByID(userToken.Id)
					require.NoError(t, err)
					require.Nil(t, model)

					model2, err := ctx.getAuthTokenByID(userToken2.Id)
					require.NoError(t, err)
					require.Nil(t, model2)
				})
			})

			t.Run("When revoking users tokens in a batch", func(t *testing.T) {
				t.Run("Can revoke all users tokens", func(t *testing.T) {
					userIds := []int64{}
					for i := 0; i < 3; i++ {
						userId := userID + int64(i+1)
						userIds = append(userIds, userId)
						_, err := userAuthTokenService.CreateToken(context.Background(), user,
							net.ParseIP("192.168.10.11"), "some user agent")
						require.NoError(t, err)
					}

					err := userAuthTokenService.BatchRevokeAllUserTokens(context.Background(), userIds)
					require.NoError(t, err)

					for _, v := range userIds {
						tokens, err := userAuthTokenService.GetUserTokens(context.Background(), v)
						require.NoError(t, err)
						require.Equal(t, 0, len(tokens))
					}
				})
			})
		})

		t.Run("expires correctly", func(t *testing.T) {
			userToken, err := userAuthTokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)

			userToken, err = userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)

			getTime = func() time.Time {
				return dt.Add(time.Hour)
			}

			rotated, err := userAuthTokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)
			require.True(t, rotated)

			userToken, err = userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)

			stillGood, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)
			require.NotNil(t, stillGood)

			model, err := ctx.getAuthTokenByID(userToken.Id)
			require.NoError(t, err)

			t.Run("when rotated_at is 6:59:59 ago should find token", func(t *testing.T) {
				getTime = func() time.Time {
					return time.Unix(model.RotatedAt, 0).Add(24 * 7 * time.Hour).Add(-time.Second)
				}

				stillGood, err = userAuthTokenService.LookupToken(context.Background(), stillGood.UnhashedToken)
				require.NoError(t, err)
				require.NotNil(t, stillGood)
			})

			t.Run("when rotated_at is 7:00:00 ago should return token expired error", func(t *testing.T) {
				getTime = func() time.Time {
					return time.Unix(model.RotatedAt, 0).Add(24 * 7 * time.Hour)
				}

				notGood, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
				_, ok := err.(*models.TokenExpiredError)
				require.True(t, ok)
				require.Nil(t, notGood)

				t.Run("should not find active token when expired", func(t *testing.T) {
					count, err := userAuthTokenService.ActiveTokenCount(context.Background())
					require.NoError(t, err)
					require.Equal(t, int64(0), count)
				})
			})

			t.Run("when rotated_at is 5 days ago and created_at is 29 days and 23:59:59 ago should not find token", func(t *testing.T) {
				updated, err := ctx.updateRotatedAt(model.Id, time.Unix(model.CreatedAt, 0).Add(24*25*time.Hour).Unix())
				require.NoError(t, err)
				require.True(t, updated)

				getTime = func() time.Time {
					return time.Unix(model.CreatedAt, 0).Add(24 * 30 * time.Hour).Add(-time.Second)
				}

				stillGood, err = userAuthTokenService.LookupToken(context.Background(), stillGood.UnhashedToken)
				require.NoError(t, err)
				require.NotNil(t, stillGood)
			})

			t.Run("when rotated_at is 5 days ago and created_at is 30 days ago should return token expired error", func(t *testing.T) {
				updated, err := ctx.updateRotatedAt(model.Id, time.Unix(model.CreatedAt, 0).Add(24*25*time.Hour).Unix())
				require.NoError(t, err)
				require.True(t, updated)

				getTime = func() time.Time {
					return time.Unix(model.CreatedAt, 0).Add(24 * 30 * time.Hour)
				}

				notGood, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
				_, ok := err.(*models.TokenExpiredError)
				require.True(t, ok)

				require.Nil(t, notGood)
			})
		})

		t.Run("can properly rotate tokens", func(t *testing.T) {
			userToken, err := userAuthTokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)

			prevToken := userToken.AuthToken
			unhashedPrev := userToken.UnhashedToken

			rotated, err := userAuthTokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("192.168.10.12"), "a new user agent")
			require.NoError(t, err)
			require.False(t, rotated)

			updated, err := ctx.markAuthTokenAsSeen(userToken.Id)
			require.NoError(t, err)
			require.True(t, updated)

			model, err := ctx.getAuthTokenByID(userToken.Id)
			require.NoError(t, err)

			var tok models.UserToken
			err = model.toUserToken(&tok)
			require.NoError(t, err)

			getTime = func() time.Time {
				return dt.Add(time.Hour)
			}

			rotated, err = userAuthTokenService.TryRotateToken(context.Background(), &tok,
				net.ParseIP("192.168.10.12"), "a new user agent")
			require.NoError(t, err)
			require.True(t, rotated)

			unhashedToken := tok.UnhashedToken

			model, err = ctx.getAuthTokenByID(tok.Id)
			require.NoError(t, err)
			model.UnhashedToken = unhashedToken

			require.Equal(t, getTime().Unix(), model.RotatedAt)
			require.Equal(t, "192.168.10.12", model.ClientIp)
			require.Equal(t, "a new user agent", model.UserAgent)
			require.False(t, model.AuthTokenSeen)
			require.Equal(t, 0, model.SeenAt)
			require.Equal(t, prevToken, model.PrevAuthToken)

			// ability to auth using an old token

			lookedUpUserToken, err := userAuthTokenService.LookupToken(context.Background(), model.UnhashedToken)
			require.NoError(t, err)
			require.NotNil(t, lookedUpUserToken)
			require.True(t, lookedUpUserToken.AuthTokenSeen)
			require.Equal(t, getTime().Unix(), lookedUpUserToken.SeenAt)

			lookedUpUserToken, err = userAuthTokenService.LookupToken(context.Background(), unhashedPrev)
			require.NoError(t, err)
			require.NotNil(t, lookedUpUserToken)
			require.Equal(t, model.Id, lookedUpUserToken.Id)
			require.True(t, lookedUpUserToken.AuthTokenSeen)

			getTime = func() time.Time {
				return dt.Add(time.Hour + (2 * time.Minute))
			}

			lookedUpUserToken, err = userAuthTokenService.LookupToken(context.Background(), unhashedPrev)
			require.NoError(t, err)
			require.NotNil(t, lookedUpUserToken)
			require.True(t, lookedUpUserToken.AuthTokenSeen)

			lookedUpModel, err := ctx.getAuthTokenByID(lookedUpUserToken.Id)
			require.NoError(t, err)
			require.NotNil(t, lookedUpModel)
			require.False(t, lookedUpModel.AuthTokenSeen)

			rotated, err = userAuthTokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("192.168.10.12"), "a new user agent")
			require.NoError(t, err)
			require.True(t, rotated)

			model, err = ctx.getAuthTokenByID(userToken.Id)
			require.NoError(t, err)
			require.NotNil(t, model)
			require.Equal(t, int64(0), model.SeenAt)
		})

		t.Run("keeps prev token valid for 1 minute after it is confirmed", func(t *testing.T) {
			userToken, err := userAuthTokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)
			require.NotNil(t, userToken)

			lookedUpUserToken, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)
			require.NotNil(t, lookedUpUserToken)

			getTime = func() time.Time {
				return dt.Add(10 * time.Minute)
			}

			prevToken := userToken.UnhashedToken
			rotated, err := userAuthTokenService.TryRotateToken(context.Background(), userToken,
				net.ParseIP("1.1.1.1"), "firefox")
			require.NoError(t, err)
			require.True(t, rotated)

			getTime = func() time.Time {
				return dt.Add(20 * time.Minute)
			}

			currentUserToken, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)
			require.NotNil(t, currentUserToken)

			prevUserToken, err := userAuthTokenService.LookupToken(context.Background(), prevToken)
			require.NoError(t, err)
			require.NotNil(t, prevUserToken)
		})

		t.Run("will not mark token unseen when prev and current are the same", func(t *testing.T) {
			userToken, err := userAuthTokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)
			require.NotNil(t, userToken)

			lookedUpUserToken, err := userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)
			require.NotNil(t, lookedUpUserToken)

			lookedUpUserToken, err = userAuthTokenService.LookupToken(context.Background(), userToken.UnhashedToken)
			require.NoError(t, err)
			require.NotNil(t, lookedUpUserToken)

			lookedUpModel, err := ctx.getAuthTokenByID(lookedUpUserToken.Id)
			require.NoError(t, err)
			require.NotNil(t, lookedUpModel)
			require.True(t, lookedUpModel.AuthTokenSeen)
		})

		t.Run("Rotate token", func(t *testing.T) {
			userToken, err := userAuthTokenService.CreateToken(context.Background(), user,
				net.ParseIP("192.168.10.11"), "some user agent")
			require.NoError(t, err)
			require.NotNil(t, userToken)

			prevToken := userToken.AuthToken

			t.Run("Should rotate current token and previous token when auth token seen", func(t *testing.T) {
				updated, err := ctx.markAuthTokenAsSeen(userToken.Id)
				require.NoError(t, err)
				require.True(t, updated)

				getTime = func() time.Time {
					return dt.Add(10 * time.Minute)
				}

				rotated, err := userAuthTokenService.TryRotateToken(context.Background(), userToken,
					net.ParseIP("1.1.1.1"), "firefox")
				require.NoError(t, err)
				require.True(t, rotated)

				storedToken, err := ctx.getAuthTokenByID(userToken.Id)
				require.NoError(t, err)
				require.NotNil(t, storedToken)
				require.False(t, storedToken.AuthTokenSeen)
				require.Equal(t, prevToken, storedToken.PrevAuthToken)
				require.NotEqual(t, prevToken, storedToken.AuthToken)

				prevToken = storedToken.AuthToken

				updated, err = ctx.markAuthTokenAsSeen(userToken.Id)
				require.NoError(t, err)
				require.True(t, updated)

				getTime = func() time.Time {
					return dt.Add(20 * time.Minute)
				}

				rotated, err = userAuthTokenService.TryRotateToken(context.Background(), userToken,
					net.ParseIP("1.1.1.1"), "firefox")
				require.NoError(t, err)
				require.True(t, rotated)

				storedToken, err = ctx.getAuthTokenByID(userToken.Id)
				require.NoError(t, err)
				require.NotNil(t, storedToken)
				require.False(t, storedToken.AuthTokenSeen)
				require.Equal(t, prevToken, storedToken.PrevAuthToken)
				require.NotEqual(t, prevToken, storedToken.AuthToken)
			})

			t.Run("Should rotate current token, but keep previous token when auth token not seen", func(t *testing.T) {
				userToken.RotatedAt = getTime().Add(-2 * time.Minute).Unix()

				getTime = func() time.Time {
					return dt.Add(2 * time.Minute)
				}

				rotated, err := userAuthTokenService.TryRotateToken(context.Background(), userToken,
					net.ParseIP("1.1.1.1"), "firefox")
				require.NoError(t, err)
				require.True(t, rotated)

				storedToken, err := ctx.getAuthTokenByID(userToken.Id)
				require.NoError(t, err)
				require.NotNil(t, storedToken)
				require.False(t, storedToken.AuthTokenSeen)
				require.Equal(t, prevToken, storedToken.PrevAuthToken)
				require.NotEqual(t, prevToken, storedToken.AuthToken)
			})
		})

		t.Run("When populating userAuthToken from UserToken should copy all properties", func(t *testing.T) {
			ut := models.UserToken{
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
			require.NoError(t, err)
			utJSON, err := simplejson.NewJson(utBytes)
			require.NoError(t, err)
			utMap := utJSON.MustMap()

			var uat userAuthToken
			err = uat.fromUserToken(&ut)
			require.NoError(t, err)
			uatBytes, err := json.Marshal(uat)
			require.NoError(t, err)
			uatJSON, err := simplejson.NewJson(uatBytes)
			require.NoError(t, err)
			uatMap := uatJSON.MustMap()

			require.True(t, cmp.Equal(uatMap, utMap))
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
			require.NoError(t, err)
			uatJSON, err := simplejson.NewJson(uatBytes)
			require.NoError(t, err)
			uatMap := uatJSON.MustMap()

			var ut models.UserToken
			err = uat.toUserToken(&ut)
			require.NoError(t, err)
			utBytes, err := json.Marshal(ut)
			require.NoError(t, err)
			utJSON, err := simplejson.NewJson(utBytes)
			require.NoError(t, err)
			utMap := utJSON.MustMap()

			require.True(t, cmp.Equal(utMap, uatMap))
		})

		t.Cleanup(func() {
			getTime = time.Now
		})
	})
}

func createTestContext(t *testing.T) *testContext {
	t.Helper()
	maxInactiveDurationVal, _ := time.ParseDuration("168h")
	maxLifetimeDurationVal, _ := time.ParseDuration("720h")
	sqlstore := sqlstore.InitTestDB(t)
	tokenService := &UserAuthTokenService{
		SQLStore: sqlstore,
		Cfg: &setting.Cfg{
			LoginMaxInactiveLifetime:     maxInactiveDurationVal,
			LoginMaxLifetime:             maxLifetimeDurationVal,
			TokenRotationIntervalMinutes: 10,
		},
		log: log.New("test-logger"),
	}

	return &testContext{
		sqlstore:     sqlstore,
		tokenService: tokenService,
	}
}

type testContext struct {
	sqlstore     *sqlstore.SQLStore
	tokenService *UserAuthTokenService
}

func (c *testContext) getAuthTokenByID(id int64) (*userAuthToken, error) {
	sess := c.sqlstore.NewSession(context.Background())
	var t userAuthToken
	found, err := sess.ID(id).Get(&t)
	if err != nil || !found {
		return nil, err
	}

	return &t, nil
}

func (c *testContext) markAuthTokenAsSeen(id int64) (bool, error) {
	sess := c.sqlstore.NewSession(context.Background())
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

func (c *testContext) updateRotatedAt(id, rotatedAt int64) (bool, error) {
	sess := c.sqlstore.NewSession(context.Background())
	res, err := sess.Exec("UPDATE user_auth_token SET rotated_at = ? WHERE id = ?", rotatedAt, id)
	if err != nil {
		return false, err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected == 1, nil
}
