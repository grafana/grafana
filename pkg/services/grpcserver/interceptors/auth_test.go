package interceptors

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func TestAuthenticator_Authenticate(t *testing.T) {
	serviceAccountId := int64(1)
	t.Run("accepts valid token", func(t *testing.T) {
		pluginAuth, authenticator := initAuth(org.RoleAdmin)
		ctx, err := setupContext(pluginAuth)
		require.NoError(t, err)
		_, err = authenticator.Authenticate(ctx)
		require.NoError(t, err)
	})

	t.Run("rejects invalid token", func(t *testing.T) {
		pluginAuth, authenticator := initAuth(org.RoleAdmin)
		ctx, err := setupContext(pluginAuth)
		require.NoError(t, err)
		ctx = metadata.NewIncomingContext(ctx, metadata.Pairs("authorization", "Bearer invalid"))
		_, err = authenticator.Authenticate(ctx)
		require.Error(t, err)
	})

	t.Run("removes auth header from context", func(t *testing.T) {
		pluginAuth, authenticator := initAuth(org.RoleAdmin)
		ctx, err := setupContext(pluginAuth)
		require.NoError(t, err)
		md, ok := metadata.FromIncomingContext(ctx)
		require.True(t, ok)
		require.NotEmpty(t, md["authorization"])
		ctx, err = authenticator.Authenticate(ctx)
		require.NoError(t, err)
		md, ok = metadata.FromIncomingContext(ctx)
		require.True(t, ok)
		require.Empty(t, md["authorization"])
	})

	t.Run("sets SignInUser", func(t *testing.T) {
		pluginAuth, authenticator := initAuth(org.RoleAdmin)
		ctx, err := setupContext(pluginAuth)
		require.NoError(t, err)
		ctx, err = authenticator.Authenticate(ctx)
		require.NoError(t, err)
		signedInUser := grpccontext.FromContext(ctx).SignedInUser
		require.Equal(t, serviceAccountId, signedInUser.UserID)
	})

	t.Run("sets SignInUser permissions", func(t *testing.T) {
		permissions := []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionAPIKeyRead,
				Scope:  accesscontrol.ScopeAPIKeysAll,
			},
		}
		pluginAuth, authenticator := initAuth(org.RoleAdmin, permissions)
		ctx, err := setupContext(pluginAuth)
		require.NoError(t, err)
		ctx, err = authenticator.Authenticate(ctx)
		require.NoError(t, err)
		signedInUser := grpccontext.FromContext(ctx).SignedInUser
		require.Equal(t, serviceAccountId, signedInUser.UserID)
		require.Equal(t, []string{accesscontrol.ScopeAPIKeysAll}, signedInUser.Permissions[1][accesscontrol.ActionAPIKeyRead])
	})
}

type fakeUserService struct {
	user.Service
	OrgRole org.RoleType
}

func (f *fakeUserService) GetSignedInUserWithCacheCtx(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return &user.SignedInUser{
		UserID:      1,
		OrgID:       1,
		OrgRole:     f.OrgRole,
		Permissions: make(map[int64]map[string][]string),
	}, nil
}

func setupContext(pluginAuth jwt.PluginAuthService) (context.Context, error) {
	ctx := context.Background()
	token, err := pluginAuth.Generate("user:1:1:", "test")
	if err != nil {
		return nil, err
	}
	md := metadata.New(map[string]string{})
	md["authorization"] = []string{"Bearer " + token}
	return metadata.NewIncomingContext(ctx, md), nil
}

func initAuth(role org.RoleType, permissions ...[]accesscontrol.Permission) (jwt.PluginAuthService, Authenticator) {
	cfg := setting.NewCfg()
	tracer := tracing.InitializeTracerForTest()
	features := featuremgmt.WithFeatures(featuremgmt.FlagJwtTokenGeneration)
	pluginAuth, err := jwt.ProvidePluginAuthService(cfg, features, kvstore.NewFakeSecretsKVStore())
	if err != nil {
		panic(err)
	}
	orgService := orgtest.NewOrgServiceFake()
	ac := accesscontrolmock.New()
	if permissions != nil {
		ac = ac.WithPermissions(permissions[0])
	}
	return pluginAuth, ProvideAuthenticator(cfg, orgService, &fakeUserService{OrgRole: role}, ac, grpccontext.ProvideContextHandler(tracer), pluginAuth)
}
