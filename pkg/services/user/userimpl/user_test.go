package userimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/teamguardian/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/userauth/userauthtest"
	"github.com/stretchr/testify/require"
)

func TestUserService(t *testing.T) {
	userStore := newUserStoreFake()
	orgService := orgtest.NewOrgServiceFake()
	starService := startest.NewStarServiceFake()
	dashboardService := dashboards.NewFakeDashboardService(t)
	preferenceService := preftest.NewPreferenceServiceFake()
	teamMemberService := manager.NewTeamGuardianMock()
	userAuthService := userauthtest.NewFakeUserAuthService()
	quotaService := quotatest.NewQuotaServiceFake()
	accessControlStore := mock.New()
	userService := Service{
		store:              userStore,
		orgService:         orgService,
		starService:        starService,
		dashboardService:   dashboardService,
		preferenceService:  preferenceService,
		teamMemberService:  teamMemberService,
		userAuthService:    userAuthService,
		quotaService:       quotaService,
		accessControlStore: accessControlStore,
	}

	t.Run("create user", func(t *testing.T) {
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{})
		require.NoError(t, err)
	})

	t.Run("delete user store returns error", func(t *testing.T) {
		userStore.ExpectedDeleteUserError = models.ErrUserNotFound
		t.Cleanup(func() {
			userStore.ExpectedDeleteUserError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err, models.ErrUserNotFound)
	})

	t.Run("delete user returns from team", func(t *testing.T) {
		teamMemberService.ExpectedError = errors.New("some error")
		t.Cleanup(func() {
			teamMemberService.ExpectedError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err)
	})

	t.Run("delete user returns from team and pref", func(t *testing.T) {
		teamMemberService.ExpectedError = errors.New("some error")
		preferenceService.ExpectedError = errors.New("some error 2")
		t.Cleanup(func() {
			teamMemberService.ExpectedError = nil
			preferenceService.ExpectedError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err)
	})

	t.Run("delete user successfully", func(t *testing.T) {
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.NoError(t, err)
	})
}

type FakeUserStore struct {
	ExpectedUser            *user.User
	ExpectedError           error
	ExpectedDeleteUserError error
}

func newUserStoreFake() *FakeUserStore {
	return &FakeUserStore{}
}

func (f *FakeUserStore) Get(ctx context.Context, query *user.User) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) Insert(ctx context.Context, query *user.User) (int64, error) {
	return 0, f.ExpectedError
}

func (f *FakeUserStore) Delete(ctx context.Context, userID int64) error {
	return f.ExpectedDeleteUserError
}

func (f *FakeUserStore) GetNotServiceAccount(ctx context.Context, userID int64) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}
