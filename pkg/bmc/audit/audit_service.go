package audit

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"

	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

var Log = log.New("Audit")

// ============================= Dashboard Audit ====================================

func DashboardCreateAudit(c *contextmodel.ReqContext, dashboard *dashboards.Dashboard, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "New dashboard created.", OperationSubType: "Dashboard " + dashboard.Title + " created successfully."}, kp.DashboardCreateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard create failed.", OperationSubType: "Dashboard " + dashboard.Title + " create failed with error: " + err.Error()}, kp.DashboardCreateAudit)
	}
}

func DashboardUpdateAudit(c *contextmodel.ReqContext, dashboard *dashboards.Dashboard, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard updated.", OperationSubType: "Dashboard " + dashboard.Title + " updated successfully."}, kp.DashboardUpdateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard update failed.", OperationSubType: "Dashboard " + dashboard.Title + " update failed with error: " + err.Error()}, kp.DashboardUpdateAudit)
	}
}

func DashboardDeleteAudit(c *contextmodel.ReqContext, err error, dash ...*dashboards.Dashboard) {
	if err == nil {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard deleted.", OperationSubType: "Dashboard " + dashboard.Title + " deleted successfully."}, kp.DashboardDeleteAudit)
		}
	} else {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard delete failed.", OperationSubType: " Dashboard " + dashboard.Title + " delete failed with error: " + err.Error()}, kp.DashboardDeleteAudit)
		}
	}
}

func DashboardSoftDeleteAudit(c *contextmodel.ReqContext, err error, dash ...*dashboards.Dashboard) {
	if err == nil {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard moved to trash.", OperationSubType: "Dashboard " + dashboard.Title + " moved to trash."}, kp.DashboardSoftDeleteAudit)
		}
	} else {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard delete failed.", OperationSubType: "Dashboard " + dashboard.Title + " delete failed with error: " + err.Error()}, kp.DashboardSoftDeleteAudit)
		}
	}
}

func RestoreDeletedDashboardAudit(c *contextmodel.ReqContext, dashboard *dashboards.Dashboard, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard restored successfully.", OperationSubType: "Dashboard " + dashboard.Title + " restored successfully."}, kp.RestoreDeletedDashboardAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard restore failed.", OperationSubType: "Dashboard " + dashboard.Title + " restore failed with error: " + err.Error()}, kp.RestoreDeletedDashboardAudit)
	}
}

// =======================================================================================

// ============================= Report Schedule Audit ====================================

type RSAudit struct {
	Id         int64
	Name       string
	ReportType string
}

func checkXLSRSType(reportType string) string {
	if reportType == "xls" {
		return "xlsx"
	}
	return reportType
}

func RSCreateAudit(c *contextmodel.ReqContext, m *models.InsertRS, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: m.Data.Name, ObjectType: checkXLSRSType(m.Data.ReportType), ObjectDetails: "Report schedule created successfully.", OperationSubType: "Report schedule " + m.Data.Name + " created successfully."}, kp.ReportSchedulerCreateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: m.Data.Name, ObjectType: checkXLSRSType(m.Data.ReportType), ObjectDetails: "Report schedule create failed.", OperationSubType: "Report schedule " + m.Data.Name + " create failed with error: " + err.Error()}, kp.ReportSchedulerCreateAudit)
	}
}

func RSUpdateAudit(c *contextmodel.ReqContext, m *models.UpdateRS, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: m.Data.Name, ObjectType: checkXLSRSType(m.Data.ReportType), ObjectDetails: "Report schedule updated successfully.", OperationSubType: "Report schedule " + m.Data.Name + " updated successfully."}, kp.ReportSchedulerUpdateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: m.Data.Name, ObjectType: checkXLSRSType(m.Data.ReportType), ObjectDetails: "Report schedule update failed.", OperationSubType: "Report scheduler " + m.Data.Name + " update failed with error: " + err.Error()}, kp.ReportSchedulerUpdateAudit)
	}
}

func RSDeleteAudit(c *contextmodel.ReqContext, m []RSAudit, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule deleted successfully.", OperationSubType: "Report scheduler " + rs.Name + " deleted successfully."}, kp.ReportSchedulerDeleteAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule delete failed.", OperationSubType: "Report scheduler " + rs.Name + " delete failed with error: " + err.Error()}, kp.ReportSchedulerDeleteAudit)
		}
	}

}

func RSEnableAudit(c *contextmodel.ReqContext, m []RSAudit, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule enabled.", OperationSubType: "Report schedule " + rs.Name + " enabled."}, kp.ReportSchedulerEnableAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule enable failed.", Err: err, OperationSubType: "Report schedule " + rs.Name + " enable failed with error: " + err.Error()}, kp.ReportSchedulerEnableAudit)
		}
	}
}

func RSDisableAudit(c *contextmodel.ReqContext, m []RSAudit, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule disabled.", OperationSubType: "Report schedule " + rs.Name + " disabled."}, kp.ReportSchedulerDisableAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule disable failed.", OperationSubType: "Report schedule " + rs.Name + " disable dailed with error: " + err.Error()}, kp.ReportSchedulerDisableAudit)
		}
	}
}

func RSRunNowAudit(c *contextmodel.ReqContext, rsName string, reportType string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: rsName, ObjectType: checkXLSRSType(reportType), ObjectDetails: "Report schedule run once successful.", OperationSubType: "Report schedule " + rsName + " run now successful."}, kp.ReportSchedulerRunNowAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: rsName, ObjectType: checkXLSRSType(reportType), ObjectDetails: "Report schedule run once failed.", OperationSubType: "Report schedule " + rsName + " run now failed with error: " + err.Error()}, kp.ReportSchedulerRunNowAudit)
	}
}

func RSUpdateOwnerAudit(c *contextmodel.ReqContext, m []RSAudit, query models.UpdateRSOwner, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report schedule owner changed from " + query.PreviousOwner + " to " + query.NewOwner + ".", OperationSubType: "Report scheduler owner updated successfully."}, kp.ReportSchedulerReassignOwnerAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: checkXLSRSType(rs.ReportType), ObjectDetails: "Report scheduler owner update failed with error: " + err.Error(), Err: err, OperationSubType: "Report scheduler owner update failed."}, kp.ReportSchedulerReassignOwnerAudit)
		}
	}
}

// ========================================================================================

// ============================= DAshboard and Folder permissions update Audit ====================================

func DashboardUserPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, dashboardName string, userName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed.", OperationSubType: "Permission removed for user " + userName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission updated.", OperationSubType: permission + " permission updated for user " + userName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed failed.", OperationSubType: "Permission remove failed for user " + userName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboardName, ObjectDetails: "Dashboard permission update failed.", OperationSubType: permission + " permission update failed for user " + userName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		}
	}
}

func DashboardTeamPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, dashboardName string, teamName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed.", OperationSubType: "Permission removed for team " + teamName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission updated.", OperationSubType: permission + " permission updated for team " + teamName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed failed.", OperationSubType: "Permission remove failed for team " + teamName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboardName, ObjectDetails: "Dashboard permission update failed.", OperationSubType: permission + " permission update failed for team " + teamName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		}
	}
}

func DashboardRolePermissionUpdateAudit(c *contextmodel.ReqContext, permission string, dashboardName string, role string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed.", OperationSubType: "Permission removed for role " + role + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission updated.", OperationSubType: permission + " permission updated for role " + role + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed failed.", OperationSubType: "Permission remove failed for role " + role + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboardName, ObjectDetails: "Dashboard permission update failed.", OperationSubType: permission + " permission update failed for role " + role + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		}
	}
}

func FolderUserPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, folderName string, userName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed.", OperationSubType: "Permission removed for user " + userName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission updated.", OperationSubType: permission + " permission updated for user " + userName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder permission removed failed.", OperationSubType: "Permission remove failed for user " + userName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder permission update failed.", OperationSubType: permission + " permission update failed for user " + userName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		}
	}
}

func FolderTeamPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, folderName string, teamName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed.", OperationSubType: "Permission removed for team " + teamName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission updated.", OperationSubType: permission + " permission updated for team " + teamName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder permission removed failed.", OperationSubType: "Permission remove failed for team " + teamName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder permission update failed.", OperationSubType: permission + " permission update failed for team " + teamName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		}
	}
}

func FolderRolePermissionUpdateAudit(c *contextmodel.ReqContext, permission string, folderName string, role string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed.", OperationSubType: "Permission removed for role " + role + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission updated.", OperationSubType: permission + " permission updated for role " + role + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder permission removed failed.", OperationSubType: "Permission remove failed for role " + role + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder permission update failed.", OperationSubType: permission + " permission update failed for role " + role + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		}
	}
}

func getResourceNameByUID(a db.DB, ctx context.Context, resourceID string, resource any, resourceObj any, col string) (string, error) {
	resourceGetErr := a.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Table(resource).Where("uid = ?", resourceID).Cols(col).Get(&resourceObj)
		if err != nil {
			return err
		} else if !exists {
			return errors.New("resource not found")
		}
		return nil
	})
	resourceName := resourceObj.(string)
	return resourceName, resourceGetErr
}

func SetUserPermissionAudit(c *contextmodel.ReqContext, a db.DB, userService user.Service, permission string, resourceType string, resourceID string, userID int64, setUserPermissionErr error) {
	var resourceName string
	var resourceGetErr error
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if resourceType == "dashboards" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, &dashboards.Dashboard{}, dashboards.Dashboard{UID: resourceID, OrgID: c.OrgID}, "title")
	} else if resourceType == "folders" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, "folder", folder.Folder{UID: resourceID, OrgID: c.OrgID}, "title")
	}
	if resourceGetErr != nil {
		Log.Error("Error while getting resource details for audit")
	}
	user, err := userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		Log.Error("Error while getting user details for audit")
	}

	if resourceType == "dashboards" {
		DashboardUserPermissionUpdateAudit(c, permission, resourceName, user.Name, setUserPermissionErr)
	} else if resourceType == "folders" {
		FolderUserPermissionUpdateAudit(c, permission, resourceName, user.Name, setUserPermissionErr)
	}
}

func SetTeamPermissionAudit(c *contextmodel.ReqContext, a db.DB, teamService team.Service, permission string, resourceType string, resourceID string, teamID int64, setTeamPermissionErr error) {
	var resourceName string
	var resourceGetErr error
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if resourceType == "dashboards" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, &dashboards.Dashboard{}, dashboards.Dashboard{UID: resourceID, OrgID: c.OrgID}, "title")
	} else if resourceType == "folders" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, "folder", folder.Folder{UID: resourceID, OrgID: c.OrgID}, "title")
	}
	if resourceGetErr != nil {
		Log.Error("Error while getting resource details for audit")
	}
	team, err := teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{OrgID: c.OrgID, ID: teamID})
	if err != nil {
		Log.Error("Error while getting team details for audit")
	}

	if resourceType == "dashboards" {
		DashboardTeamPermissionUpdateAudit(c, permission, resourceName, team.Name, setTeamPermissionErr)
	} else if resourceType == "folders" {
		FolderTeamPermissionUpdateAudit(c, permission, resourceName, team.Name, setTeamPermissionErr)
	}
}

func SetRolePermissionAudit(c *contextmodel.ReqContext, a db.DB, role string, permission string, resourceType string, resourceID string, setRolePermissionErr error) {
	var resourceName string
	var resourceGetErr error
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if resourceType == "dashboards" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, &dashboards.Dashboard{}, dashboards.Dashboard{UID: resourceID, OrgID: c.OrgID}, "title")
	} else if resourceType == "folders" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, "folder", folder.Folder{UID: resourceID, OrgID: c.OrgID}, "title")
	}
	if resourceGetErr != nil {
		Log.Error("Error while getting resource details for audit")
	}

	if resourceType == "dashboards" {
		DashboardRolePermissionUpdateAudit(c, permission, resourceName, role, setRolePermissionErr)
	} else if resourceType == "folders" {
		FolderRolePermissionUpdateAudit(c, permission, resourceName, role, setRolePermissionErr)
	}
}

// ========================================================================================

// ====================================== Roles Audit =====================================

func RoleCreateAudit(c *contextmodel.ReqContext, roleName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: "New role created.", OperationSubType: "Role " + roleName + " created successfully."}, kp.RoleCreateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: roleName, ObjectDetails: "Role create failed.", OperationSubType: "Role " + roleName + " create failed with error: " + err.Error()}, kp.RoleCreateAudit)
	}
}

func RoleUpdateAudit(c *contextmodel.ReqContext, roleName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: "Role updated.", OperationSubType: "Role " + roleName + " updated successfully."}, kp.RoleUpdateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: roleName, ObjectDetails: "Role update failed.", OperationSubType: "Role " + roleName + " update failed with error: " + err.Error()}, kp.RoleUpdateAudit)
	}
}

func RoleDeleteAudit(c *contextmodel.ReqContext, roleName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: "Role deleted.", OperationSubType: "Role " + roleName + " deleted successfully."}, kp.RoleDeleteAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: roleName, ObjectDetails: "Role delete failed.", OperationSubType: "Role " + roleName + " delete failed with error: " + err.Error()}, kp.RoleDeleteAudit)
	}
}

func RoleManagePermissionsAudit(c *contextmodel.ReqContext, permissions []string, roleName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: "Role permissions updated.", OperationSubType: "Permissions updated for role " + roleName + " : " + strings.Join(permissions, ", ")}, kp.RoleManagePermissionsAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: roleName, ObjectDetails: "Role permissions update failed.", OperationSubType: "Permissions update failed for role " + roleName + " with error: " + err.Error()}, kp.RoleManagePermissionsAudit)
	}
}

func getUserDetailForAudit(c *contextmodel.ReqContext, sqlstore sqlstore.SQLStore, users []int64) ([]string, error) {
	var usersData = make([]string, 0)
	usersGetErr := sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
		err := sess.Table(&user.User{}).In("id", users).Where("org_id = ?", c.OrgID).Cols("login").Find(&usersData)
		return err
	})
	return usersData, usersGetErr
}

func pluralize(count int, word string) string {
	if count == 1 {
		return word
	}
	return word + "s"
}

func RoleManageUsersAudit(c *contextmodel.ReqContext, sqlstore sqlstore.SQLStore, roleName string, usersAdded []int64, usersRemoved []int64, err error) {
	if err == nil {
		if len(usersAdded) != 0 {
			users, err := getUserDetailForAudit(c, sqlstore, usersAdded)
			if err != nil {
				Log.Error("Error while getting user details for audit")
			}
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: pluralize(len(usersAdded), "User") + " role update successful.", OperationSubType: "Role " + roleName + " updated for " + pluralize(len(usersAdded), "user") + ": " + strings.Join(users, ", ")}, kp.RoleManageUsersAudit)

		}
		if len(usersRemoved) != 0 {
			users, err := getUserDetailForAudit(c, sqlstore, usersRemoved)
			if err != nil {
				Log.Error("Error while getting user details for audit")
			}
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: pluralize(len(usersRemoved), "User") + " role update successful.", OperationSubType: "Role " + roleName + " removed for " + pluralize(len(usersRemoved), "user") + ": " + strings.Join(users, ", ")}, kp.RoleManageUsersAudit)
		}
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: roleName, ObjectDetails: "Users role update failed.", OperationSubType: "Users role update failed."}, kp.RoleManageUsersAudit)
	}
}

func getTeamDetailForAudit(c *contextmodel.ReqContext, sqlstore sqlstore.SQLStore, teams []int64) ([]string, error) {
	var teamsData = make([]string, 0)
	teamsGetErr := sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
		err := sess.Table(&team.Team{}).In("id", teams).Where("org_id = ?", c.OrgID).Cols("name").Find(&teamsData)
		return err
	})
	return teamsData, teamsGetErr
}

func RoleManageTeamsAudit(c *contextmodel.ReqContext, sqlstore sqlstore.SQLStore, roleName string, teamsAdded []int64, teamsRemoved []int64, err error) {
	if err == nil {
		if len(teamsAdded) != 0 {
			teams, err := getTeamDetailForAudit(c, sqlstore, teamsAdded)
			if err != nil {
				Log.Error("Error while getting team details for audit")
			}
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: pluralize(len(teamsAdded), "Team") + " role update successful.", OperationSubType: "Role " + roleName + " updated for " + pluralize(len(teamsAdded), "team") + ": " + strings.Join(teams, ", ")}, kp.RoleManageTeamsAudit)

		}
		if len(teamsRemoved) != 0 {
			teams, err := getTeamDetailForAudit(c, sqlstore, teamsRemoved)
			if err != nil {
				Log.Error("Error while getting team details for audit")
			}
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: roleName, ObjectDetails: pluralize(len(teamsRemoved), "Team") + " role update successful.", OperationSubType: "Role " + roleName + " removed for " + pluralize(len(teamsRemoved), "team") + ": " + strings.Join(teams, ", ")}, kp.RoleManageTeamsAudit)
		}
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: roleName, ObjectDetails: "Teams role update failed.", OperationSubType: "Teams role update failed."}, kp.RoleManageTeamsAudit)
	}
}

// ========================================================================================

// ====================================== Folder Audit =====================================

func FolderCreateAudit(c *contextmodel.ReqContext, folderName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "New folder created.", OperationSubType: "Folder " + folderName + " created successfully."}, kp.FolderCreateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder create failed.", OperationSubType: "Folder " + folderName + " create failed with error: " + err.Error()}, kp.FolderCreateAudit)
	}
}

func FolderUpdateAudit(c *contextmodel.ReqContext, folderName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder updated.", OperationSubType: "Folder " + folderName + " updated successfully."}, kp.FolderUpdateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder update failed.", OperationSubType: "Folder " + folderName + " update failed with error: " + err.Error()}, kp.FolderUpdateAudit)
	}
}

func FolderDeleteAudit(c *contextmodel.ReqContext, folderName string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder deleted.", OperationSubType: "Folder " + folderName + " deleted successfully."}, kp.FolderDeleteAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: folderName, ObjectDetails: "Folder delete failed.", OperationSubType: " Folder " + folderName + " delete failed with error: " + err.Error()}, kp.FolderDeleteAudit)
	}
}

// =====================================================================================================

// ====================================== Dashboard Features Audit =====================================

func ManageDashboardFeaturesAudit(c *contextmodel.ReqContext, featureName string, flag bool, err error) {
	if err == nil {
		if flag == true {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: featureName, ObjectDetails: "Dashboard feature updated.", OperationSubType: "Feature " + featureName + " enabled."}, kp.ManageDashboardFeaturesAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: featureName, ObjectDetails: "Dashboard feature updated.", OperationSubType: "Feature " + featureName + " disabled."}, kp.ManageDashboardFeaturesAudit)
		}
	} else {
		if flag == true {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: featureName, ObjectDetails: "Dashboard feature update failed.", OperationSubType: "Feature " + featureName + " enable failed with error: " + err.Error()}, kp.ManageDashboardFeaturesAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: featureName, ObjectDetails: "Dashboard feature update failed.", OperationSubType: "Feature " + featureName + " diable failed with error: " + err.Error()}, kp.ManageDashboardFeaturesAudit)
		}
	}
}

// =======================================Functions to send audit event=================================================

func sendAudit(e kp.EventOpt, kpObj kp.EventType) {
	kpObj.Send(e)
}
