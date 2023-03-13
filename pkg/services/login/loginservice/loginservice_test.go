package loginservice

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func Test_syncOrgRoles_doesNotBreakWhenTryingToRemoveLastOrgAdmin(t *testing.T) {
	user := createSimpleUser()
	externalUser := createSimpleExternalUser()
	authInfoMock := &logintest.AuthInfoServiceFake{}

	login := Implementation{
		QuotaService:    quotatest.New(false, nil),
		AuthInfoService: authInfoMock,
		userService:     usertest.NewUserServiceFake(),
		orgService:      orgtest.NewOrgServiceFake(),
	}

	err := login.syncOrgRoles(context.Background(), &user, &externalUser)
	require.NoError(t, err)
}

func Test_syncOrgRoles_whenTryingToRemoveLastOrgLogsError(t *testing.T) {
	buf := &bytes.Buffer{}
	logger.Swap(level.NewFilter(log.NewLogfmtLogger(buf), level.AllowInfo()))

	user := createSimpleUser()
	externalUser := createSimpleExternalUser()

	authInfoMock := &logintest.AuthInfoServiceFake{}

	orgService := orgtest.NewOrgServiceFake()
	orgService.ExpectedUserOrgDTO = createUserOrgDTO()
	orgService.ExpectedOrgListResponse = createResponseWithOneErrLastOrgAdminItem()

	login := Implementation{
		QuotaService:    quotatest.New(false, nil),
		AuthInfoService: authInfoMock,
		userService:     usertest.NewUserServiceFake(),
		orgService:      orgService,
		accessControl:   &actest.FakeService{},
	}

	err := login.syncOrgRoles(context.Background(), &user, &externalUser)
	require.NoError(t, err)
	assert.Contains(t, buf.String(), org.ErrLastOrgAdmin.Error())
}

func Test_teamSync(t *testing.T) {
	authInfoMock := &logintest.AuthInfoServiceFake{}
	loginsvc := Implementation{
		QuotaService:    quotatest.New(false, nil),
		AuthInfoService: authInfoMock,
	}

	email := "test_user@example.org"
	upsertCmd := &login.UpsertUserCommand{ExternalUser: &login.ExternalUserInfo{Email: email},
		UserLookupParams: login.UserLookupParams{Email: &email}}
	expectedUser := &user.User{
		ID:    1,
		Email: email,
		Name:  "test_user",
		Login: "test_user",
	}
	authInfoMock.ExpectedUser = expectedUser

	var actualUser *user.User
	var actualExternalUser *login.ExternalUserInfo

	t.Run("login.TeamSync should not be called when nil", func(t *testing.T) {
		err := loginsvc.UpsertUser(context.Background(), upsertCmd)
		require.Nil(t, err)
		assert.Nil(t, actualUser)
		assert.Nil(t, actualExternalUser)

		t.Run("login.TeamSync should be called when not nil", func(t *testing.T) {
			teamSyncFunc := func(user *user.User, externalUser *login.ExternalUserInfo) error {
				actualUser = user
				actualExternalUser = externalUser
				return nil
			}
			loginsvc.TeamSync = teamSyncFunc
			err := loginsvc.UpsertUser(context.Background(), upsertCmd)
			require.Nil(t, err)
			assert.Equal(t, actualUser, expectedUser)
			assert.Equal(t, actualExternalUser, upsertCmd.ExternalUser)
		})

		t.Run("login.TeamSync should not be called when not nil and skipTeamSync is set for externalUserInfo", func(t *testing.T) {
			var actualUser *user.User
			var actualExternalUser *login.ExternalUserInfo
			upsertCmdSkipTeamSync := &login.UpsertUserCommand{
				ExternalUser: &login.ExternalUserInfo{
					Email: email,
					// sending in ExternalUserInfo with SkipTeamSync yields no team sync
					SkipTeamSync: true,
				},
				UserLookupParams: login.UserLookupParams{Email: &email},
			}
			teamSyncFunc := func(user *user.User, externalUser *login.ExternalUserInfo) error {
				actualUser = user
				actualExternalUser = externalUser
				return nil
			}
			loginsvc.TeamSync = teamSyncFunc
			err := loginsvc.UpsertUser(context.Background(), upsertCmdSkipTeamSync)
			require.Nil(t, err)
			assert.Nil(t, actualUser)
			assert.Nil(t, actualExternalUser)
		})

		t.Run("login.TeamSync should propagate its errors to the caller", func(t *testing.T) {
			teamSyncFunc := func(user *user.User, externalUser *login.ExternalUserInfo) error {
				return errors.New("teamsync test error")
			}
			loginsvc.TeamSync = teamSyncFunc
			err := loginsvc.UpsertUser(context.Background(), upsertCmd)
			require.Error(t, err)
		})
	})
}

func TestUpsertUser_crashOnLog_issue62538(t *testing.T) {
	authInfoMock := &logintest.AuthInfoServiceFake{}
	authInfoMock.ExpectedError = user.ErrUserNotFound
	loginsvc := Implementation{
		QuotaService:    quotatest.New(false, nil),
		AuthInfoService: authInfoMock,
	}

	email := "test_user@example.org"
	upsertCmd := &login.UpsertUserCommand{
		ExternalUser:     &login.ExternalUserInfo{Email: email},
		UserLookupParams: login.UserLookupParams{Email: &email},
		SignupAllowed:    false,
	}

	var err error
	require.NotPanics(t, func() {
		err = loginsvc.UpsertUser(context.Background(), upsertCmd)
	})
	require.ErrorIs(t, err, login.ErrSignupNotAllowed)
}

func createSimpleUser() user.User {
	user := user.User{
		ID: 1,
	}

	return user
}

func createUserOrgDTO() []*org.UserOrgDTO {
	users := []*org.UserOrgDTO{
		{
			OrgID: 1,
			Name:  "Bar",
			Role:  org.RoleViewer,
		},
		{
			OrgID: 10,
			Name:  "Foo",
			Role:  org.RoleAdmin,
		},
		{
			OrgID: 11,
			Name:  "Stuff",
			Role:  org.RoleViewer,
		},
	}
	return users
}

func createSimpleExternalUser() login.ExternalUserInfo {
	externalUser := login.ExternalUserInfo{
		AuthModule: login.LDAPAuthModule,
		OrgRoles: map[int64]org.RoleType{
			1: org.RoleViewer,
		},
	}

	return externalUser
}

func createResponseWithOneErrLastOrgAdminItem() orgtest.OrgListResponse {
	remResp := orgtest.OrgListResponse{
		{
			OrgID:    10,
			Response: org.ErrLastOrgAdmin,
		},
		{
			OrgID:    11,
			Response: nil,
		},
	}
	return remResp
}
