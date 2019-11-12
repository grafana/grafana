package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func Test_syncOrgRoles_doesNotBreakWhenTryingToRemoveLastOrgAdminButLogsInstead(t *testing.T) {
	user := models.User{
		Id: 1,
	}
	externalUser := models.ExternalUserInfo{
		AuthModule: "ldap",
		OrgRoles: map[int64]models.RoleType{
			1: models.ROLE_VIEWER,
		},
	}

	bus.ClearBusHandlers()
	defer bus.ClearBusHandlers()
	bus.AddHandler("test", func(q *models.GetUserOrgListQuery) error {
		q.Result = []*models.UserOrgDTO{
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

		return nil
	})
	bus.AddHandler("test", func(cmd *models.UpdateOrgUserCommand) error {
		return nil
	})
	bus.AddHandler("test", func(cmd *models.AddOrgUserCommand) error {
		return nil
	})

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
