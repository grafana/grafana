package loginservice

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_syncOrgRoles_doesNotBreakWhenTryingToRemoveLastOrgAdmin(t *testing.T) {
	user := createSimpleUser()
	externalUser := createSimpleExternalUser()
	authInfoMock := &logintest.AuthInfoServiceFake{}

	login := Implementation{
		QuotaService:    quotatest.New(false, nil),
		AuthInfoService: authInfoMock,
		SQLStore:        nil,
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
		SQLStore:        nil,
		userService:     usertest.NewUserServiceFake(),
		orgService:      orgService,
		accessControl:   &actest.FakeService{},
	}

	err := login.syncOrgRoles(context.Background(), &user, &externalUser)
	require.NoError(t, err)
	assert.Contains(t, buf.String(), models.ErrLastOrgAdmin.Error())
}

func Test_teamSync(t *testing.T) {
	authInfoMock := &logintest.AuthInfoServiceFake{}
	login := Implementation{
		QuotaService:    quotatest.New(false, nil),
		AuthInfoService: authInfoMock,
	}

	email := "test_user@example.org"
	upserCmd := &models.UpsertUserCommand{ExternalUser: &models.ExternalUserInfo{Email: email},
		UserLookupParams: models.UserLookupParams{Email: &email}}
	expectedUser := &user.User{
		ID:    1,
		Email: email,
		Name:  "test_user",
		Login: "test_user",
	}
	authInfoMock.ExpectedUser = expectedUser

	var actualUser *user.User
	var actualExternalUser *models.ExternalUserInfo

	t.Run("login.TeamSync should not be called when  nil", func(t *testing.T) {
		err := login.UpsertUser(context.Background(), upserCmd)
		require.Nil(t, err)
		assert.Nil(t, actualUser)
		assert.Nil(t, actualExternalUser)

		t.Run("login.TeamSync should be called when not nil", func(t *testing.T) {
			teamSyncFunc := func(user *user.User, externalUser *models.ExternalUserInfo) error {
				actualUser = user
				actualExternalUser = externalUser
				return nil
			}
			login.TeamSync = teamSyncFunc
			err := login.UpsertUser(context.Background(), upserCmd)
			require.Nil(t, err)
			assert.Equal(t, actualUser, expectedUser)
			assert.Equal(t, actualExternalUser, upserCmd.ExternalUser)
		})

		t.Run("login.TeamSync should propagate its errors to the caller", func(t *testing.T) {
			teamSyncFunc := func(user *user.User, externalUser *models.ExternalUserInfo) error {
				return errors.New("teamsync test error")
			}
			login.TeamSync = teamSyncFunc
			err := login.UpsertUser(context.Background(), upserCmd)
			require.Error(t, err)
		})
	})
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

func createSimpleExternalUser() models.ExternalUserInfo {
	externalUser := models.ExternalUserInfo{
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
			Response: models.ErrLastOrgAdmin,
		},
		{
			OrgID:    11,
			Response: nil,
		},
	}
	return remResp
}
