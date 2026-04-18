package interceptors

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apikey"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestAuthenticator_Authenticate(t *testing.T) {
	tracer := tracing.InitializeTracerForTest()
	serviceAccountId := int64(1)
	t.Run("accepts service api key with admin role", func(t *testing.T) {
		s := newFakeAPIKey(&apikey.APIKey{
			ID:               1,
			OrgID:            1,
			Key:              "admin-api-key",
			Name:             "Admin API Key",
			ServiceAccountId: &serviceAccountId,
		}, nil)
		ac := accesscontrolmock.New()
		a := ProvideAuthenticator(s, &fakeUserService{OrgRole: org.RoleAdmin}, ac, grpccontext.ProvideContextHandler(tracer))
		ctx, err := setupContext()
		require.NoError(t, err)
		_, err = a.Authenticate(ctx)
		require.NoError(t, err)
	})

	t.Run("rejects non-admin role", func(t *testing.T) {
		s := newFakeAPIKey(&apikey.APIKey{
			ID:               1,
			OrgID:            1,
			Key:              "admin-api-key",
			Name:             "Admin API Key",
			ServiceAccountId: &serviceAccountId,
		}, nil)
		ac := accesscontrolmock.New()
		a := ProvideAuthenticator(s, &fakeUserService{OrgRole: org.RoleEditor}, ac, grpccontext.ProvideContextHandler(tracer))
		ctx, err := setupContext()
		require.NoError(t, err)
		_, err = a.Authenticate(ctx)
		require.NotNil(t, err)
	})

	t.Run("removes auth header from context", func(t *testing.T) {
		s := newFakeAPIKey(&apikey.APIKey{
			ID:               1,
			OrgID:            1,
			Key:              "admin-api-key",
			Name:             "Admin API Key",
			ServiceAccountId: &serviceAccountId,
		}, nil)
		ac := accesscontrolmock.New()
		a := ProvideAuthenticator(s, &fakeUserService{OrgRole: org.RoleAdmin}, ac, grpccontext.ProvideContextHandler(tracer))
		ctx, err := setupContext()
		require.NoError(t, err)
		md, ok := metadata.FromIncomingContext(ctx)
		require.True(t, ok)
		require.NotEmpty(t, md["authorization"])
		ctx, err = a.Authenticate(ctx)
		require.NoError(t, err)
		md, ok = metadata.FromIncomingContext(ctx)
		require.True(t, ok)
		require.Empty(t, md["authorization"])
	})

	t.Run("sets SignInUser", func(t *testing.T) {
		s := newFakeAPIKey(&apikey.APIKey{
			ID:               1,
			OrgID:            1,
			Key:              "admin-api-key",
			Name:             "Admin API Key",
			ServiceAccountId: &serviceAccountId,
		}, nil)
		ac := accesscontrolmock.New()
		a := ProvideAuthenticator(s, &fakeUserService{OrgRole: org.RoleAdmin}, ac, grpccontext.ProvideContextHandler(tracer))
		ctx, err := setupContext()
		require.NoError(t, err)
		ctx, err = a.Authenticate(ctx)
		require.NoError(t, err)
		signedInUser := grpccontext.FromContext(ctx).SignedInUser
		require.Equal(t, serviceAccountId, signedInUser.UserID)
	})

	t.Run("sets SignInUser permissions", func(t *testing.T) {
		s := newFakeAPIKey(&apikey.APIKey{
			ID:               1,
			OrgID:            1,
			Key:              "admin-api-key",
			Name:             "Admin API Key",
			ServiceAccountId: &serviceAccountId,
		}, nil)
		permissions := []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionUsersWrite,
				Scope:  accesscontrol.ScopeUsersAll,
			},
		}
		ac := accesscontrolmock.New().WithPermissions(permissions)
		a := ProvideAuthenticator(s, &fakeUserService{OrgRole: org.RoleAdmin}, ac, grpccontext.ProvideContextHandler(tracer))
		ctx, err := setupContext()
		require.NoError(t, err)
		ctx, err = a.Authenticate(ctx)
		require.NoError(t, err)
		signedInUser := grpccontext.FromContext(ctx).SignedInUser
		require.Equal(t, serviceAccountId, signedInUser.UserID)
		require.Equal(t, []string{accesscontrol.ScopeUsersAll}, signedInUser.Permissions[1][accesscontrol.ActionUsersWrite])
	})
}

type fakeAPIKey struct {
	apikey.Service
	key *apikey.APIKey
	err error
}

func newFakeAPIKey(key *apikey.APIKey, err error) *fakeAPIKey {
	return &fakeAPIKey{
		key: key,
		err: err,
	}
}

func (f *fakeAPIKey) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	return f.key, f.err
}

type fakeUserService struct {
	user.Service
	OrgRole org.RoleType
}

func (f *fakeUserService) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return &user.SignedInUser{
		UserID:      1,
		OrgID:       1,
		OrgRole:     f.OrgRole,
		Permissions: make(map[int64]map[string][]string),
	}, nil
}

func setupContext() (context.Context, error) {
	ctx := context.Background()
	key, err := satokengen.New("sa")
	if err != nil {
		return ctx, err
	}
	md := metadata.New(map[string]string{})
	md["authorization"] = []string{"Bearer " + key.ClientSecret}
	return metadata.NewIncomingContext(ctx, md), nil
}
