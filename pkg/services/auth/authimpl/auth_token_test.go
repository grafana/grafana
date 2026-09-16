package authimpl

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
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

			storedAuthToken, err := ctx.getAuthTokenByID(userToken.Id)
			require.Nil(t, err)
			require.NotNil(t, storedAuthToken)
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
				userIds := make([]int64, 0, 3)
				for i := range 3 {
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
				userIds := make([]int64, 0, 3)
				extSessionIds := make([]int64, 0, 3)
				for i := range 3 {
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

	t.Run("When populating userAuthToken from UserToken should copy all properties", func(t *testing.T) {
		ut := auth.UserToken{
			Id:                1,
			UserId:            2,
			AuthToken:         "a",
			UserAgent:         "c",
			ClientIp:          "d",
			SeenAt:            3,
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
		uatBytes, err := json.Marshal(uat) // #nosec G117 -- test fixture marshaling internal struct
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
			UserAgent:         "c",
			ClientIp:          "d",
			SeenAt:            3,
			CreatedAt:         5,
			UpdatedAt:         6,
			UnhashedToken:     "e",
			ExternalSessionId: 7,
		}
		uatBytes, err := json.Marshal(uat) // #nosec G117 -- test fixture marshaling internal struct
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
	sqlstore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	tracer := tracing.InitializeTracerForTest()

	cfg := &setting.Cfg{
		LoginMaxInactiveLifetime: maxInactiveDurationVal,
		LoginMaxLifetime:         maxLifetimeDurationVal,
	}

	sqlProvider := legacysql.NewDatabaseProvider(sqlstore)
	extSessionStore := provideExternalSessionStore(sqlProvider, &fakes.FakeSecretsService{}, tracer)

	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)

	tokenService := &UserAuthTokenService{
		sql:                  sqlProvider,
		cfgProvider:          cfgProvider,
		log:                  log.New("test-logger"),
		externalSessionStore: extSessionStore,
		tracer:               tracer,
	}

	return &testContext{
		sqlstore:        sqlstore,
		cfg:             cfg,
		tokenService:    tokenService,
		extSessionStore: &extSessionStore,
	}
}

type testContext struct {
	sqlstore        db.DB
	cfg             *setting.Cfg
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
