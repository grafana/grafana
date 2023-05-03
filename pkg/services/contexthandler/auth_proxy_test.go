package contexthandler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/anonymous/anontest"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
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
	ctx := &contextmodel.ReqContext{
		Context: &web.Context{Req: req},
		Logger:  log.New("Test"),
	}
	req.Header.Set(svc.Cfg.AuthProxyHeaderName, name)
	h, err := authproxy.HashCacheKey(name)
	require.NoError(t, err)
	key := fmt.Sprintf(authproxy.CachePrefix, h)

	t.Logf("Injecting stale user ID in cache with key %q", key)
	userIdPayload := []byte(strconv.FormatInt(int64(33), 10))
	err = svc.RemoteCache.Set(context.Background(), key, userIdPayload, 0)
	require.NoError(t, err)

	authEnabled := svc.initContextWithAuthProxy(ctx, orgID)
	require.True(t, authEnabled)

	require.Equal(t, userID, ctx.SignedInUser.UserID)
	require.True(t, ctx.IsSignedIn)

	cachedByteArray, err := svc.RemoteCache.Get(context.Background(), key)
	require.NoError(t, err)

	cacheUserId, err := strconv.ParseInt(string(cachedByteArray), 10, 64)

	require.NoError(t, err)
	require.Equal(t, userID, cacheUserId)
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
	remoteCacheSvc, err := remotecache.ProvideService(cfg, sqlStore, &usagestats.UsageStatsMock{}, fakes.NewFakeSecretsService())
	require.NoError(t, err)
	userAuthTokenSvc := authtest.NewFakeUserAuthTokenService()
	renderSvc := &fakeRenderService{}
	authJWTSvc := jwt.NewFakeJWTService()
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

	authProxy := authproxy.ProvideAuthProxy(cfg, remoteCacheSvc, loginService, &userService, nil, service.NewLDAPFakeService())
	authenticator := &fakeAuthenticator{}

	return ProvideService(cfg, userAuthTokenSvc, authJWTSvc, remoteCacheSvc,
		renderSvc, sqlStore, tracer, authProxy, loginService, nil, authenticator,
		&userService, orgService, nil, featuremgmt.WithFeatures(),
		&authntest.FakeService{}, &anontest.FakeAnonymousSessionService{})
}

type fakeAuthenticator struct{}

func (fa *fakeAuthenticator) AuthenticateUser(c context.Context, query *login.LoginUserQuery) error {
	return nil
}
