package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestStatsDataAccess(t *testing.T) {
	t.Run("Testing Stats Data Access", func(t *testing.T) {
		InitTestDB(t)

		t.Run("Get system stats should not results in error", func(t *testing.T) {
			populateDB(t)

			query := models.GetSystemStatsQuery{}
			err := GetSystemStats(&query)
			assert.Nil(t, err)
			assert.Equal(t, query.Result.Users, int64(3))
			assert.Equal(t, query.Result.Editors, 1)
			assert.Equal(t, query.Result.Viewers, 1)
			assert.Equal(t, query.Result.Admins, 3)
		})

		t.Run("Get system user count stats should not results in error", func(t *testing.T) {
			query := models.GetSystemUserCountStatsQuery{}
			err := GetSystemUserCountStats(context.Background(), &query)
			assert.Nil(t, err)
		})

		t.Run("Get datasource stats should not results in error", func(t *testing.T) {
			query := models.GetDataSourceStatsQuery{}
			err := GetDataSourceStats(&query)
			assert.Nil(t, err)
		})

		t.Run("Get datasource access stats should not results in error", func(t *testing.T) {
			query := models.GetDataSourceAccessStatsQuery{}
			err := GetDataSourceAccessStats(&query)
			assert.Nil(t, err)
		})

		t.Run("Get alert notifier stats should not results in error", func(t *testing.T) {
			query := models.GetAlertNotifierUsageStatsQuery{}
			err := GetAlertNotifiersUsageStats(context.Background(), &query)
			assert.Nil(t, err)
		})

		t.Run("Get admin stats should not result in error", func(t *testing.T) {
			query := models.GetAdminStatsQuery{}
			err := GetAdminStats(&query)
			assert.Nil(t, err)
		})
	})
}

func populateDB(t *testing.T) {
	users := make([]models.User, 3)
	for i := range users {
		cmd := &models.CreateUserCommand{
			Email:   fmt.Sprintf("usertest%v@test.com", i),
			Name:    fmt.Sprintf("user name %v", i),
			Login:   fmt.Sprintf("user_test_%v_login", i),
			OrgName: fmt.Sprintf("Org #%v", i),
		}
		err := CreateUser(context.Background(), cmd)
		assert.Nil(t, err)
		users[i] = cmd.Result
	}

	// get 1st user's organisation
	getOrgByIdQuery := &models.GetOrgByIdQuery{Id: users[0].OrgId}
	err := GetOrgById(getOrgByIdQuery)
	assert.Nil(t, err)
	org := getOrgByIdQuery.Result

	// add 2nd user as editor
	cmd := &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[1].Id,
		Role:   models.ROLE_EDITOR,
	}
	err = AddOrgUser(cmd)
	assert.Nil(t, err)

	// add 3rd user as viewer
	cmd = &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[2].Id,
		Role:   models.ROLE_VIEWER,
	}
	err = AddOrgUser(cmd)
	assert.Nil(t, err)

	// get 2nd user's organisation
	getOrgByIdQuery = &models.GetOrgByIdQuery{Id: users[1].OrgId}
	err = GetOrgById(getOrgByIdQuery)
	assert.Nil(t, err)
	org = getOrgByIdQuery.Result

	// add 1st user as admin
	cmd = &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[0].Id,
		Role:   models.ROLE_ADMIN,
	}
	err = AddOrgUser(cmd)
	assert.Nil(t, err)
}
