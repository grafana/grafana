package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	log "github.com/inconshreveable/log15"
	"github.com/stretchr/testify/require"
)

func Test_syncOrgRoles_doesNotBreakWhenTryingToRemoveLastOrgAdmin(t *testing.T) {
	user := createSimpleUser()
	externalUser := createSimpleExternalUser()
	remResp := createResponseWithOneErrLastOrgAdminItem()

	bus.ClearBusHandlers()
	defer bus.ClearBusHandlers()
	bus.AddHandler("test", func(q *models.GetUserOrgListQuery) error {

		q.Result = createUserOrgDTO()

		return nil
	})

	bus.AddHandler("test", func(cmd *models.RemoveOrgUserCommand) error {
		testData := remResp[0]
		remResp = remResp[1:]

		require.Equal(t, testData.orgId, cmd.OrgId)
		return testData.response
	})
	bus.AddHandler("test", func(cmd *models.SetUsingOrgCommand) error {
		return nil
	})

	err := syncOrgRoles(&user, &externalUser)
	require.Empty(t, remResp)
	require.NoError(t, err)
}

func Test_syncOrgRoles_whenTryingToRemoveLastOrgLogsError(t *testing.T) {
	var logOutput string
	logger.SetHandler(log.FuncHandler(func(r *log.Record) error {
		logOutput = r.Msg
		return nil
	}))

	user := createSimpleUser()
	externalUser := createSimpleExternalUser()
	remResp := createResponseWithOneErrLastOrgAdminItem()

	bus.ClearBusHandlers()
	defer bus.ClearBusHandlers()
	bus.AddHandler("test", func(q *models.GetUserOrgListQuery) error {

		q.Result = createUserOrgDTO()

		return nil
	})

	bus.AddHandler("test", func(cmd *models.RemoveOrgUserCommand) error {
		testData := remResp[0]
		remResp = remResp[1:]

		require.Equal(t, testData.orgId, cmd.OrgId)
		return testData.response
	})
	bus.AddHandler("test", func(cmd *models.SetUsingOrgCommand) error {
		return nil
	})

	err := syncOrgRoles(&user, &externalUser)
	require.NoError(t, err)
	require.Equal(t, models.ErrLastOrgAdmin.Error(), logOutput)
}

func createSimpleUser() models.User {
	user := models.User{
		Id: 1,
	}

	return user
}

func createUserOrgDTO() []*models.UserOrgDTO {
	users := []*models.UserOrgDTO{
		{
			OrgId: 1,
			Name:  "Bar",
			Role:  models.ROLE_VIEWER,
		},
		{
			OrgId: 10,
			Name:  "Foo",
			Role:  models.ROLE_ADMIN,
		},
		{
			OrgId: 11,
			Name:  "Stuff",
			Role:  models.ROLE_VIEWER,
		},
	}
	return users
}

func createSimpleExternalUser() models.ExternalUserInfo {
	externalUser := models.ExternalUserInfo{
		AuthModule: "ldap",
		OrgRoles: map[int64]models.RoleType{
			1: models.ROLE_VIEWER,
		},
	}

	return externalUser
}

func createResponseWithOneErrLastOrgAdminItem() []struct {
	orgId    int64
	response error
} {
	remResp := []struct {
		orgId    int64
		response error
	}{
		{
			orgId:    10,
			response: models.ErrLastOrgAdmin,
		},
		{
			orgId:    11,
			response: nil,
		},
	}
	return remResp
}
