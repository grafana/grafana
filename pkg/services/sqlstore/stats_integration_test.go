// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegration_GetUserStats(t *testing.T) {
	InitTestDB(t)

	cmd := &models.CreateUserCommand{
		Email:   "admin@test.com",
		Name:    "Admin",
		Login:   "admin",
		OrgName: mainOrgName,
		IsAdmin: true,
	}
	err := CreateUser(context.Background(), cmd)
	require.NoError(t, err)
	firstUser := cmd.Result

	{
		defaultAutoAssign := setting.AutoAssignOrg
		defaultOrgID := setting.AutoAssignOrgId
		defaultRole := setting.AutoAssignOrgRole

		setting.AutoAssignOrg = true
		setting.AutoAssignOrgId = int(firstUser.OrgId)
		setting.AutoAssignOrgRole = "Editor"

		defer func() {
			setting.AutoAssignOrg = defaultAutoAssign
			setting.AutoAssignOrgId = defaultOrgID
			setting.AutoAssignOrgRole = defaultRole
		}()
	}

	users := make([]models.User, 5)

	for i := range users {
		cmd := &models.CreateUserCommand{
			Email: fmt.Sprintf("usertest%v@test.com", i),
			Name:  fmt.Sprintf("user name %v", i),
			Login: fmt.Sprintf("user_test_%v_login", i),
			OrgId: firstUser.OrgId,
		}
		err := CreateUser(context.Background(), cmd)
		require.NoError(t, err)
		users[i] = cmd.Result
	}

	query := models.GetUserStatsQuery{
		MustUpdate: true,
	}
	err = GetUserStats(&query)
	require.NoError(t, err)
	assert.EqualValues(t, models.UserStats{
		Users:   6,
		Admins:  1,
		Editors: 5,
		Viewers: 0,
	}, query.Result)
}
