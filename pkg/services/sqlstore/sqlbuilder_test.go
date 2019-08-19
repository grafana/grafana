package sqlstore

import (
	"context"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestSqlBuilder(t *testing.T) {
	t.Run("writeDashboardPermissionFilter", func(t *testing.T) {
		t.Run("user ACL", func(t *testing.T) {
			test(t,
				DashboardProps{},
				&DashboardPermission{User: true, Permission: models.PERMISSION_VIEW},
				Search{UserFromACL: true, RequiredPermission: models.PERMISSION_VIEW},
				shouldFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{User: true, Permission: models.PERMISSION_VIEW},
				Search{UserFromACL: true, RequiredPermission: models.PERMISSION_EDIT},
				shouldNotFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{User: true, Permission: models.PERMISSION_EDIT},
				Search{UserFromACL: true, RequiredPermission: models.PERMISSION_EDIT},
				shouldFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{User: true, Permission: models.PERMISSION_VIEW},
				Search{RequiredPermission: models.PERMISSION_VIEW},
				shouldNotFind,
			)
		})

		t.Run("role ACL", func(t *testing.T) {
			test(t,
				DashboardProps{},
				&DashboardPermission{Role: models.ROLE_VIEWER, Permission: models.PERMISSION_VIEW},
				Search{UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_VIEW},
				shouldFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{Role: models.ROLE_VIEWER, Permission: models.PERMISSION_VIEW},
				Search{UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_EDIT},
				shouldNotFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{Role: models.ROLE_EDITOR, Permission: models.PERMISSION_VIEW},
				Search{UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_VIEW},
				shouldNotFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{Role: models.ROLE_EDITOR, Permission: models.PERMISSION_VIEW},
				Search{UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_VIEW},
				shouldNotFind,
			)
		})

		t.Run("team ACL", func(t *testing.T) {
			test(t,
				DashboardProps{},
				&DashboardPermission{Team: true, Permission: models.PERMISSION_VIEW},
				Search{UserFromACL: true, RequiredPermission: models.PERMISSION_VIEW},
				shouldFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{Team: true, Permission: models.PERMISSION_VIEW},
				Search{UserFromACL: true, RequiredPermission: models.PERMISSION_EDIT},
				shouldNotFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{Team: true, Permission: models.PERMISSION_EDIT},
				Search{UserFromACL: true, RequiredPermission: models.PERMISSION_EDIT},
				shouldFind,
			)

			test(t,
				DashboardProps{},
				&DashboardPermission{Team: true, Permission: models.PERMISSION_EDIT},
				Search{UserFromACL: false, RequiredPermission: models.PERMISSION_EDIT},
				shouldNotFind,
			)
		})

		t.Run("defaults for user ACL", func(t *testing.T) {
			test(t,
				DashboardProps{},
				nil,
				Search{OrgId: -1, UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_VIEW},
				shouldNotFind,
			)

			test(t,
				DashboardProps{OrgId: -1},
				nil,
				Search{OrgId: -1, UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_VIEW},
				shouldFind,
			)

			test(t,
				DashboardProps{OrgId: -1},
				nil,
				Search{OrgId: -1, UsersOrgRole: models.ROLE_EDITOR, RequiredPermission: models.PERMISSION_EDIT},
				shouldFind,
			)

			test(t,
				DashboardProps{OrgId: -1},
				nil,
				Search{OrgId: -1, UsersOrgRole: models.ROLE_VIEWER, RequiredPermission: models.PERMISSION_EDIT},
				shouldNotFind,
			)
		})
	})
}

var shouldFind = true
var shouldNotFind = false

type DashboardProps struct {
	OrgId int64
}

type DashboardPermission struct {
	User       bool
	Team       bool
	Role       models.RoleType
	Permission models.PermissionType
}

type Search struct {
	UsersOrgRole       models.RoleType
	UserFromACL        bool
	RequiredPermission models.PermissionType
	OrgId              int64
}

type dashboardResponse struct {
	Id int64
}

func test(t *testing.T, dashboardProps DashboardProps, dashboardPermission *DashboardPermission, search Search, shouldFind bool) {
	// Will also cleanup the db
	sqlStore := InitTestDB(t)

	dashboard, err := createDummyDashboard(dashboardProps)
	if !assert.Equal(t, nil, err) {
		return
	}

	var aclUserId int64
	if dashboardPermission != nil {
		aclUserId, err = createDummyAcl(dashboardPermission, search, dashboard.Id)
		if !assert.Equal(t, nil, err) {
			return
		}
	}
	dashboards, err := getDashboards(sqlStore, search, aclUserId)
	if !assert.Equal(t, nil, err) {
		return
	}

	if shouldFind {
		if assert.Equal(t, 1, len(dashboards), "Should return one dashboard") {
			assert.Equal(t, dashboards[0].Id, dashboard.Id, "Should return created dashboard")
		}
	} else {
		assert.Equal(t, 0, len(dashboards), "Should node return any dashboard")
	}
}

func createDummyUser() (*models.User, error) {
	uid := rand.Intn(9999999)
	createUserCmd := &models.CreateUserCommand{
		Email:          string(uid) + "@example.com",
		Login:          string(uid),
		Name:           string(uid),
		Company:        "",
		OrgName:        "",
		Password:       string(uid),
		EmailVerified:  true,
		IsAdmin:        false,
		SkipOrgSetup:   false,
		DefaultOrgRole: string(models.ROLE_VIEWER),
	}
	err := CreateUser(context.Background(), createUserCmd)
	if err != nil {
		return nil, err
	}

	return &createUserCmd.Result, nil
}

func createDummyTeam() (*models.Team, error) {
	cmd := &models.CreateTeamCommand{
		// Does not matter in this tests actually
		OrgId: 1,
		Name:  "test",
		Email: "test@example.com",
	}
	err := CreateTeam(cmd)
	if err != nil {
		return nil, err
	}

	return &cmd.Result, nil
}

func createDummyDashboard(dashboardProps DashboardProps) (*models.Dashboard, error) {
	json, _ := simplejson.NewJson([]byte(`{"schemaVersion":17,"title":"gdev dashboards","uid":"","version":1}`))

	saveDashboardCmd := &models.SaveDashboardCommand{
		Dashboard:    json,
		UserId:       0,
		Overwrite:    false,
		Message:      "",
		RestoredFrom: 0,
		PluginId:     "",
		FolderId:     0,
		IsFolder:     false,
		UpdatedAt:    time.Time{},
	}
	if dashboardProps.OrgId != 0 {
		saveDashboardCmd.OrgId = dashboardProps.OrgId
	} else {
		saveDashboardCmd.OrgId = 1
	}

	err := SaveDashboard(saveDashboardCmd)
	if err != nil {
		return nil, err
	}

	return saveDashboardCmd.Result, nil
}

func createDummyAcl(dashboardPermission *DashboardPermission, search Search, dashboardId int64) (int64, error) {
	acl := &models.DashboardAcl{
		OrgId:       1,
		Created:     time.Now(),
		Updated:     time.Now(),
		Permission:  dashboardPermission.Permission,
		DashboardId: dashboardId,
	}

	var user *models.User
	var err error
	if dashboardPermission.User {
		user, err = createDummyUser()
		if err != nil {
			return 0, err
		}

		acl.UserId = user.Id
	}

	if dashboardPermission.Team {
		team, err := createDummyTeam()
		if err != nil {
			return 0, err
		}
		if search.UserFromACL {
			user, err = createDummyUser()
			if err != nil {
				return 0, err
			}
			addTeamMemberCmd := &models.AddTeamMemberCommand{
				UserId: user.Id,
				OrgId:  1,
				TeamId: team.Id,
			}
			err = AddTeamMember(addTeamMemberCmd)
			if err != nil {
				return 0, err
			}
		}

		acl.TeamId = team.Id
	}

	if len(string(dashboardPermission.Role)) > 0 {
		acl.Role = &dashboardPermission.Role
	}

	updateAclCmd := &models.UpdateDashboardAclCommand{
		DashboardId: dashboardId,
		Items:       []*models.DashboardAcl{acl},
	}
	err = UpdateDashboardAcl(updateAclCmd)
	if user != nil {
		return user.Id, err
	}
	return 0, err
}

func getDashboards(sqlStore *SqlStore, search Search, aclUserId int64) ([]*dashboardResponse, error) {
	builder := &SqlBuilder{}
	signedInUser := &models.SignedInUser{
		UserId: 9999999999,
	}

	if search.OrgId == 0 {
		signedInUser.OrgId = 1
	} else {
		signedInUser.OrgId = search.OrgId
	}

	if len(string(search.UsersOrgRole)) > 0 {
		signedInUser.OrgRole = search.UsersOrgRole
	} else {
		signedInUser.OrgRole = models.ROLE_VIEWER
	}
	if search.UserFromACL {
		signedInUser.UserId = aclUserId
	}

	var res []*dashboardResponse
	builder.Write("SELECT * FROM dashboard WHERE true")
	builder.writeDashboardPermissionFilter(signedInUser, search.RequiredPermission)
	err := sqlStore.engine.SQL(builder.GetSqlString(), builder.params...).Find(&res)
	return res, err
}
