// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegration_GetAdminStats(t *testing.T) {
	InitTestDB(t)

	query := models.GetAdminStatsQuery{}
	err := GetAdminStats(&query)
	require.NoError(t, err)
}

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

	const nUsers = 100
	users := make([]models.User, nUsers)

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

	orgs := make([]models.Org, 10)

	for i := range orgs {
		cmd := &models.CreateOrgCommand{
			Name:   fmt.Sprintf("org %d", i),
			UserId: firstUser.Id,
		}
		err := CreateOrg(cmd)
		require.NoError(t, err)
		orgs[i] = cmd.Result
	}

	for _, u := range users {
		for _, o := range orgs {
			cmd := &models.AddOrgUserCommand{
				Role:   "Viewer",
				UserId: u.Id,
				OrgId:  o.Id,
			}
			err := AddOrgUser(cmd)
			require.NoErrorf(t, err, "uID %d oID %d", u.Id, o.Id)
		}
	}

	query := models.GetUserStatsQuery{
		MustUpdate: true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = GetUserStats(ctx, &query)
	require.NoError(t, err)
	assert.EqualValues(t, models.UserStats{
		Users:   nUsers + 1,
		Admins:  1,
		Editors: nUsers,
		Viewers: 0,
	}, query.Result)
}
