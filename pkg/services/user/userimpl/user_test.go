package userimpl

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestUserService(t *testing.T) {
	userStore := newUserStoreFake()
	orgService := orgtest.NewOrgServiceFake()
	userService := LegacyService{
		store:        userStore,
		orgService:   orgService,
		cacheService: localcache.ProvideService(),
		teamService:  &teamtest.FakeService{},
		tracer:       tracing.InitializeTracerForTest(),
		db:           db.InitTestDB(t),
	}
	userService.cfg = setting.NewCfg()

	t.Run("create user", func(t *testing.T) {
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{
			Email: "email",
			Login: "login",
			Name:  "name",
		})
		require.NoError(t, err)
	})

	t.Run("create user should fail when username and email are empty", func(t *testing.T) {
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{
			Email: "",
			Login: "",
			Name:  "name",
		})

		require.ErrorIs(t, err, user.ErrEmptyUsernameAndEmail)
	})

	t.Run("get user by ID", func(t *testing.T) {
		userService.cfg = setting.NewCfg()
		userStore.ExpectedUser = &user.User{ID: 1, Email: "email", Login: "login", Name: "name"}
		u, err := userService.GetByID(context.Background(), &user.GetUserByIDQuery{ID: 1})
		require.NoError(t, err)
		require.Equal(t, "login", u.Login)
		require.Equal(t, "name", u.Name)
		require.Equal(t, "email", u.Email)
		require.False(t, u.IsProvisioned)
	})

	t.Run("delete user store returns error", func(t *testing.T) {
		userStore.ExpectedDeleteUserError = user.ErrUserNotFound
		t.Cleanup(func() {
			userStore.ExpectedDeleteUserError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err, user.ErrUserNotFound)
	})

	t.Run("delete user successfully", func(t *testing.T) {
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("delete user store returns error", func(t *testing.T) {
		userStore.ExpectedDeleteUserError = user.ErrUserNotFound
		t.Cleanup(func() {
			userStore.ExpectedDeleteUserError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err, user.ErrUserNotFound)
	})

	t.Run("delete user successfully", func(t *testing.T) {
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("GetByID - email conflict", func(t *testing.T) {
		userStore.ExpectedError = errors.New("email conflict")
		query := user.GetUserByIDQuery{}
		_, err := userService.GetByID(context.Background(), &query)
		require.Error(t, err)
	})

	t.Run("Testing DB - return list users based on their is_disabled flag", func(t *testing.T) {
		userStore := newUserStoreFake()
		orgService := orgtest.NewOrgServiceFake()
		userService := LegacyService{
			store:        userStore,
			orgService:   orgService,
			cacheService: localcache.ProvideService(),
			teamService:  teamtest.NewFakeService(),
			tracer:       tracing.InitializeTracerForTest(),
		}
		usr := &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
		}

		usr2 := &user.SignedInUser{
			OrgID:       0,
			Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
		}

		query1 := &user.GetSignedInUserQuery{OrgID: 1, UserID: 1}
		userStore.ExpectedSignedInUser = usr
		orgService.ExpectedUserOrgDTO = []*org.UserOrgDTO{{OrgID: 0}, {OrgID: 1}}
		result, err := userService.GetSignedInUser(context.Background(), query1)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.Equal(t, query1.OrgID, result.OrgID)
		userStore.ExpectedSignedInUser = usr2
		query2 := &user.GetSignedInUserQuery{OrgID: 0, UserID: 1}
		result2, err := userService.GetSignedInUser(context.Background(), query2)
		require.Nil(t, err)
		require.NotNil(t, result2)
		assert.Equal(t, query2.OrgID, result2.OrgID)
	})

	t.Run("SignedInUserQuery with a different org", func(t *testing.T) {
		query := user.GetSignedInUserQuery{UserID: 2}
		userStore.ExpectedSignedInUser = &user.SignedInUser{
			OrgID:   1,
			Email:   "ac2@test.com",
			Name:    "ac2 name",
			Login:   "ac2",
			OrgName: "ac1@test.com",
		}
		userStore.ExpectedError = nil
		queryResult, err := userService.GetSignedInUser(context.Background(), &query)

		require.NoError(t, err)
		require.EqualValues(t, queryResult.OrgID, 1)
		require.Equal(t, queryResult.Email, "ac2@test.com")
		require.Equal(t, queryResult.Name, "ac2 name")
		require.Equal(t, queryResult.Login, "ac2")
		require.Equal(t, queryResult.OrgName, "ac1@test.com")
	})
}

func TestService_Update(t *testing.T) {
	setup := func(opts ...func(svc *LegacyService)) *LegacyService {
		service := &LegacyService{
			store:  &FakeUserStore{},
			tracer: tracing.InitializeTracerForTest(),
		}
		for _, o := range opts {
			o(service)
		}
		return service
	}

	t.Run("should return error if old password does not match stored password", func(t *testing.T) {
		service := setup(func(svc *LegacyService) {
			stored, err := user.Password("test").Hash("salt")
			require.NoError(t, err)

			svc.store = &FakeUserStore{ExpectedUser: &user.User{Password: stored, Salt: "salt"}}
		})

		err := service.Update(context.Background(), &user.UpdateUserCommand{
			OldPassword: passwordPtr("test123"),
		})
		assert.ErrorIs(t, err, user.ErrPasswordMissmatch)
	})

	t.Run("should return error new password is not valid", func(t *testing.T) {
		service := setup(func(svc *LegacyService) {
			stored, err := user.Password("test").Hash("salt")
			require.NoError(t, err)
			svc.cfg = setting.NewCfg()
			svc.store = &FakeUserStore{ExpectedUser: &user.User{Password: stored, Salt: "salt"}}
		})

		err := service.Update(context.Background(), &user.UpdateUserCommand{
			OldPassword: passwordPtr("test"),
			Password:    passwordPtr("asd"),
		})
		require.ErrorIs(t, err, user.ErrPasswordTooShort)
	})

	t.Run("Can set using org", func(t *testing.T) {
		orgID := int64(1)
		service := setup(func(svc *LegacyService) {
			svc.orgService = &orgtest.FakeOrgService{ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: orgID}}}
		})
		err := service.Update(context.Background(), &user.UpdateUserCommand{UserID: 2, OrgID: &orgID})
		require.NoError(t, err)
	})

	t.Run("Cannot set using org when user is not member of it", func(t *testing.T) {
		orgID := int64(1)
		service := setup(func(svc *LegacyService) {
			svc.orgService = &orgtest.FakeOrgService{ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: 2}}}
		})
		err := service.Update(context.Background(), &user.UpdateUserCommand{UserID: 2, OrgID: &orgID})
		require.Error(t, err)
	})
}

func TestUpdateLastSeenAt(t *testing.T) {
	userStore := newUserStoreFake()
	orgService := orgtest.NewOrgServiceFake()
	userService := LegacyService{
		store:        userStore,
		orgService:   orgService,
		cacheService: localcache.ProvideService(),
		teamService:  &teamtest.FakeService{},
		tracer:       tracing.InitializeTracerForTest(),
	}
	userService.cfg = setting.NewCfg()
	userService.cfg.UserLastSeenUpdateInterval = 5 * time.Minute

	t.Run("update last seen at", func(t *testing.T) {
		userStore.ExpectedSignedInUser = &user.SignedInUser{UserID: 1, OrgID: 1, Email: "email", Login: "login", Name: "name", LastSeenAt: time.Now().Add(-20 * time.Minute)}
		err := userService.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{UserID: 1, OrgID: 1})
		require.NoError(t, err)
	})

	userService.cacheService.Flush()

	t.Run("do not update last seen at", func(t *testing.T) {
		userStore.ExpectedSignedInUser = &user.SignedInUser{UserID: 1, OrgID: 1, Email: "email", Login: "login", Name: "name", LastSeenAt: time.Now().Add(-1 * time.Minute)}
		err := userService.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{UserID: 1, OrgID: 1})
		require.ErrorIs(t, err, user.ErrLastSeenUpToDate, err)
	})
}

func TestMetrics(t *testing.T) {
	userStore := newUserStoreFake()
	orgService := orgtest.NewOrgServiceFake()

	userService := LegacyService{
		store:        userStore,
		orgService:   orgService,
		cacheService: localcache.ProvideService(),
		teamService:  &teamtest.FakeService{},
		tracer:       tracing.InitializeTracerForTest(),
	}

	t.Run("update user with role None", func(t *testing.T) {
		userStore.ExpectedCountUserAccountsWithEmptyRoles = int64(1)

		userService.cfg = setting.NewCfg()
		userService.cfg.BasicAuthStrongPasswordPolicy = true

		stats := userService.GetUsageStats(context.Background())
		assert.NotEmpty(t, stats)

		assert.Len(t, stats, 2, stats)
		assert.Equal(t, int64(1), stats["stats.user.role_none.count"])
		assert.Equal(t, 1, stats["stats.password_policy.count"])
	})
}

func TestService_NoLegacyFallback(t *testing.T) {
	enableK8sUsersRedirect(t)

	k8sErr := errors.New("k8s boom")
	legacyUser := &user.User{ID: 1, Login: "from-legacy"}

	t.Run("GetByID", func(t *testing.T) {
		t.Run("k8s hit is returned without consulting legacy", func(t *testing.T) {
			s := newWrapperServiceForTest(
				&usertest.FakeUserService{ExpectedUser: &user.User{ID: 2, Login: "from-k8s"}},
				&usertest.FakeUserService{ExpectedUser: legacyUser},
			)
			got, err := s.GetByID(context.Background(), &user.GetUserByIDQuery{ID: 5})
			require.NoError(t, err)
			require.Equal(t, "from-k8s", got.Login)
		})

		t.Run("k8s error is surfaced, no fallback to legacy", func(t *testing.T) {
			s := newWrapperServiceForTest(
				&usertest.FakeUserService{ExpectedError: k8sErr},
				&usertest.FakeUserService{ExpectedUser: legacyUser},
			)
			got, err := s.GetByID(context.Background(), &user.GetUserByIDQuery{ID: 5})
			require.ErrorIs(t, err, k8sErr)
			require.Nil(t, got)
		})
	})

	t.Run("GetByUID", func(t *testing.T) {
		t.Run("k8s hit is returned without consulting legacy", func(t *testing.T) {
			s := newWrapperServiceForTest(
				&usertest.FakeUserService{ExpectedUser: &user.User{ID: 2, Login: "from-k8s"}},
				&usertest.FakeUserService{ExpectedUser: legacyUser},
			)
			got, err := s.GetByUID(context.Background(), &user.GetUserByUIDQuery{UID: "uid"})
			require.NoError(t, err)
			require.Equal(t, "from-k8s", got.Login)
		})

		t.Run("k8s error is surfaced, no fallback to legacy", func(t *testing.T) {
			s := newWrapperServiceForTest(
				&usertest.FakeUserService{ExpectedError: k8sErr},
				&usertest.FakeUserService{ExpectedUser: legacyUser},
			)
			got, err := s.GetByUID(context.Background(), &user.GetUserByUIDQuery{UID: "uid"})
			require.ErrorIs(t, err, k8sErr)
			require.Nil(t, got)
		})
	})
}

// ctxCapturingUserService records the context passed to GetProfile so tests can
// assert which identity the k8s lookup runs as.
type ctxCapturingUserService struct {
	usertest.FakeUserService
	gotCtx context.Context
}

func (f *ctxCapturingUserService) GetProfile(ctx context.Context, _ *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	f.gotCtx = ctx
	return &user.UserProfileDTO{}, nil
}

func (f *ctxCapturingUserService) GetByID(ctx context.Context, _ *user.GetUserByIDQuery) (*user.User, error) {
	f.gotCtx = ctx
	return &user.User{}, nil
}

func TestService_GetProfile_SelfReadElevatesToServiceIdentity(t *testing.T) {
	enableK8sUsersRedirect(t)

	const selfUID = "u-self"
	const selfID int64 = 5

	caller := &identity.StaticRequester{Type: claims.TypeUser, UserUID: selfUID, UserID: selfID, OrgID: 2}

	t.Run("reading own profile runs as the service identity", func(t *testing.T) {
		k8s := &ctxCapturingUserService{}
		s := newWrapperServiceForTest(k8s, &usertest.FakeUserService{})

		ctx := identity.WithRequester(context.Background(), caller)
		_, err := s.GetProfile(ctx, &user.GetUserProfileQuery{UserID: selfID, UID: selfUID})
		require.NoError(t, err)
		require.True(t, identity.IsServiceIdentity(k8s.gotCtx), "self-read should be elevated to the service identity")
	})

	t.Run("reading own profile by internal ID only is elevated", func(t *testing.T) {
		k8s := &ctxCapturingUserService{}
		s := newWrapperServiceForTest(k8s, &usertest.FakeUserService{})

		ctx := identity.WithRequester(context.Background(), caller)
		_, err := s.GetProfile(ctx, &user.GetUserProfileQuery{UserID: selfID})
		require.NoError(t, err)
		require.True(t, identity.IsServiceIdentity(k8s.gotCtx))
	})

	t.Run("reading another user's profile keeps the caller identity", func(t *testing.T) {
		k8s := &ctxCapturingUserService{}
		s := newWrapperServiceForTest(k8s, &usertest.FakeUserService{})

		ctx := identity.WithRequester(context.Background(), caller)
		_, err := s.GetProfile(ctx, &user.GetUserProfileQuery{UserID: 99, UID: "u-other"})
		require.NoError(t, err)
		require.False(t, identity.IsServiceIdentity(k8s.gotCtx), "reading another user must not be elevated")
		got, err := identity.GetRequester(k8s.gotCtx)
		require.NoError(t, err)
		require.Equal(t, selfUID, got.GetRawIdentifier())
	})
}

func TestService_GetByID_SelfReadElevatesToServiceIdentity(t *testing.T) {
	enableK8sUsersRedirect(t)

	const selfID int64 = 5
	caller := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "u-self", UserID: selfID, OrgID: 2}

	t.Run("reading own user runs as the service identity", func(t *testing.T) {
		k8s := &ctxCapturingUserService{}
		s := newWrapperServiceForTest(k8s, &usertest.FakeUserService{})

		ctx := identity.WithRequester(context.Background(), caller)
		_, err := s.GetByID(ctx, &user.GetUserByIDQuery{ID: selfID})
		require.NoError(t, err)
		require.True(t, identity.IsServiceIdentity(k8s.gotCtx))
	})

	t.Run("reading another user keeps the caller identity", func(t *testing.T) {
		k8s := &ctxCapturingUserService{}
		s := newWrapperServiceForTest(k8s, &usertest.FakeUserService{})

		ctx := identity.WithRequester(context.Background(), caller)
		_, err := s.GetByID(ctx, &user.GetUserByIDQuery{ID: 99})
		require.NoError(t, err)
		require.False(t, identity.IsServiceIdentity(k8s.gotCtx))
	})
}

func newWrapperServiceForTest(k8sService, legacyService user.Service) *Service {
	return &Service{
		legacyService:     legacyService,
		k8sService:        k8sService,
		openFeatureClient: openfeature.NewDefaultClient(),
		logger:            log.New("test"),
		tracer:            tracing.InitializeTracerForTest(),
		cfg:               setting.NewCfg(),
	}
}

func enableK8sUsersRedirect(t *testing.T) {
	t.Helper()
	flag, err := setting.ParseFlag(featuremgmt.FlagKubernetesUsersRedirect, "true")
	require.NoError(t, err)
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesUsersRedirect: flag,
	})
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(nil))
	})
}

func TestIntegrationCreateUser(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	ss := db.InitTestDB(t)
	userStore := &sqlStore{
		db:      ss,
		dialect: ss.GetDialect(),
		logger:  log.NewNopLogger(),
		cfg:     cfg,
	}

	t.Run("SkipOrgSetup=true: InsertOrgUser is not called, DefaultOrgRole is ignored", func(t *testing.T) {
		var inserted *org.OrgUser
		userService := LegacyService{
			store: userStore,
			orgService: &orgtest.FakeOrgService{
				InsertOrgUserFn: func(_ context.Context, orgUser *org.OrgUser) (int64, error) {
					inserted = orgUser
					return 1, nil
				},
			},
			cacheService: localcache.ProvideService(),
			teamService:  &teamtest.FakeService{},
			tracer:       tracing.InitializeTracerForTest(),
			cfg:          setting.NewCfg(),
			db:           ss,
		}
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{
			Email:          "skip@example.com",
			Login:          "skipuser",
			Name:           "skipuser",
			DefaultOrgRole: "Editor",
			SkipOrgSetup:   true,
		})
		require.NoError(t, err)
		require.Nil(t, inserted, "InsertOrgUser must not be called when SkipOrgSetup=true")
	})

	t.Run("SkipOrgSetup=false, empty DefaultOrgRole: org_user inserted with AutoAssignOrgRole", func(t *testing.T) {
		var inserted *org.OrgUser
		cfg := setting.NewCfg()
		cfg.AutoAssignOrg = true
		cfg.AutoAssignOrgRole = string(org.RoleViewer)
		userService := LegacyService{
			store: userStore,
			orgService: &orgtest.FakeOrgService{
				InsertOrgUserFn: func(_ context.Context, orgUser *org.OrgUser) (int64, error) {
					inserted = orgUser
					return 1, nil
				},
			},
			cacheService: localcache.ProvideService(),
			teamService:  &teamtest.FakeService{},
			tracer:       tracing.InitializeTracerForTest(),
			cfg:          cfg,
			db:           ss,
		}
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{
			Email: "fallback@example.com",
			Login: "fallbackuser",
			Name:  "fallbackuser",
		})
		require.NoError(t, err)
		require.NotNil(t, inserted, "InsertOrgUser must be called when SkipOrgSetup=false")
		assert.Equal(t, org.RoleViewer, inserted.Role, "Role must come from cfg.AutoAssignOrgRole when DefaultOrgRole is empty")
	})

	t.Run("create user should roll back created user if OrgUser cannot be created", func(t *testing.T) {
		userService := LegacyService{
			store: userStore,
			orgService: &orgtest.FakeOrgService{InsertOrgUserFn: func(ctx context.Context, orgUser *org.OrgUser) (int64, error) {
				return 0, errors.New("some error")
			}},
			cacheService: localcache.ProvideService(),
			teamService:  &teamtest.FakeService{},
			tracer:       tracing.InitializeTracerForTest(),
			cfg:          setting.NewCfg(),
			db:           ss,
		}
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{
			Email: "email",
			Login: "login",
			Name:  "name",
		})
		require.Error(t, err)

		usr, err := userService.GetByLogin(context.Background(), &user.GetUserByLoginQuery{LoginOrEmail: "login"})
		require.Nil(t, usr)
		require.Error(t, err)
		require.ErrorIs(t, err, user.ErrUserNotFound)
	})
}

type FakeUserStore struct {
	ExpectedUser                            *user.User
	ExpectedSignedInUser                    *user.SignedInUser
	ExpectedUserProfile                     *user.UserProfileDTO
	ExpectedSearchUserQueryResult           *user.SearchUserQueryResult
	ExpectedError                           error
	ExpectedDeleteUserError                 error
	ExpectedCountUserAccountsWithEmptyRoles int64
	ExpectedListUsersByIdOrUid              []*user.User
}

func newUserStoreFake() *FakeUserStore {
	return &FakeUserStore{}
}

func (f *FakeUserStore) Insert(ctx context.Context, query *user.User) (int64, error) {
	return 0, f.ExpectedError
}

func (f *FakeUserStore) Delete(ctx context.Context, userID int64) error {
	return f.ExpectedDeleteUserError
}

func (f *FakeUserStore) GetByID(context.Context, int64) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) GetByUID(context.Context, string) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) ListByIdOrUID(context.Context, []string, []int64) ([]*user.User, error) {
	return f.ExpectedListUsersByIdOrUid, f.ExpectedError
}

func (f *FakeUserStore) LoginConflict(context.Context, string, string) error {
	return f.ExpectedError
}

func (f *FakeUserStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return f.ExpectedSignedInUser, f.ExpectedError
}

func (f *FakeUserStore) GetProfile(ctx context.Context, query *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	return f.ExpectedUserProfile, f.ExpectedError
}

func (f *FakeUserStore) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	return f.ExpectedSearchUserQueryResult, f.ExpectedError
}

func (f *FakeUserStore) Count(ctx context.Context) (int64, error) {
	return 0, nil
}

func (f *FakeUserStore) CountUserAccountsWithEmptyRole(ctx context.Context) (int64, error) {
	return f.ExpectedCountUserAccountsWithEmptyRoles, nil
}
