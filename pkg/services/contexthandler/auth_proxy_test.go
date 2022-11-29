package contexthandler

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const userID = int64(1)
const orgID = int64(4)

// Test initContextWithAuthProxy with a cached user ID that is no longer valid.
//
// In this case, the cache entry should be ignored/cleared and another attempt should be done to sign the user
// in without cache.
func TestInitContextWithAuthProxy_CachedInvalidUserID(t *testing.T) {
	const name = "markelog"

	svc := getContextHandler(t)

	req, err := http.NewRequest("POST", "http://example.com", nil)
	require.NoError(t, err)
	ctx := &models.ReqContext{
		Context: &web.Context{Req: req},
		Logger:  log.New("Test"),
	}
	req.Header.Set(svc.Cfg.AuthProxyHeaderName, name)
	h, err := authproxy.HashCacheKey(name)
	require.NoError(t, err)
	key := fmt.Sprintf(authproxy.CachePrefix, h)

	t.Logf("Injecting stale user ID in cache with key %q", key)
	err = svc.RemoteCache.Set(context.Background(), key, int64(33), 0)
	require.NoError(t, err)

	authEnabled := svc.initContextWithAuthProxy(ctx, orgID)
	require.True(t, authEnabled)

	require.Equal(t, userID, ctx.SignedInUser.UserID)
	require.True(t, ctx.IsSignedIn)

	i, err := svc.RemoteCache.Get(context.Background(), key)
	require.NoError(t, err)
	require.Equal(t, userID, i.(int64))
}

type fakeRenderService struct {
	rendering.Service
}

func getContextHandler(t *testing.T) *ContextHandler {
	t.Helper()

	sqlStore := db.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{
		Name: "database",
	}
	cfg.AuthProxyHeaderName = "X-Killa"
	cfg.AuthProxyEnabled = true
	cfg.AuthProxyHeaderProperty = "username"
	remoteCacheSvc, err := remotecache.ProvideService(cfg, sqlStore)
	require.NoError(t, err)
	userAuthTokenSvc := authtest.NewFakeUserAuthTokenService()
	renderSvc := &fakeRenderService{}
	authJWTSvc := models.NewFakeJWTService()
	tracer := tracing.InitializeTracerForTest()

	loginService := loginservice.LoginServiceMock{ExpectedUser: &user.User{ID: userID}}
	userService := usertest.FakeUserService{
		GetSignedInUserFn: func(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
			if query.UserID != userID {
				return &user.SignedInUser{}, user.ErrUserNotFound
			}
			return &user.SignedInUser{
				UserID: userID,
				OrgID:  orgID,
			}, nil
		},
	}
	orgService := orgtest.NewOrgServiceFake()

	authProxy := authproxy.ProvideAuthProxy(cfg, remoteCacheSvc, loginService, &userService, &FakeGetSignUserStore{})
	authenticator := &fakeAuthenticator{}

	return ProvideService(cfg, userAuthTokenSvc, authJWTSvc, remoteCacheSvc,
		renderSvc, sqlStore, tracer, authProxy, loginService, nil, authenticator,
		&userService, orgService, nil, nil)
}

type FakeGetSignUserStore struct {
	db.DB
}

func (f *FakeGetSignUserStore) GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error {
	if query.UserId != userID {
		return user.ErrUserNotFound
	}

	query.Result = &user.SignedInUser{
		UserID: userID,
		OrgID:  orgID,
	}
	return nil
}

type fakeAuthenticator struct{}

func (fa *fakeAuthenticator) AuthenticateUser(c context.Context, query *models.LoginUserQuery) error {
	return nil
}
