package kafkaproducer

import (
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type EventType int

const (
	DataSourceAddEvent EventType = iota
	DataSourceUpdateEvent
	DataSourceDeleteEvent
	PreferencesEvent
	ReportBrandingSettingsEvent
	ReportFtpSettingsEvent

	// Dashboard
	DashboardCreateAudit
	DashboardUpdateAudit
	DashboardDeleteAudit
	DashboardSoftDeleteAudit
	RestoreDeletedDashboardAudit
	DashboardPermissionUpdateAudit

	//Report Scheduler
	ReportSchedulerCreateAudit
	ReportSchedulerUpdateAudit
	ReportSchedulerDeleteAudit
	ReportSchedulerEnableAudit
	ReportSchedulerDisableAudit
	ReportSchedulerRunNowAudit
	ReportSchedulerReassignOwnerAudit

	//Folder
	FolderCreateAudit
	FolderUpdateAudit
	FolderDeleteAudit
	FolderPermissionUpdateAudit

	//Role
	RoleCreateAudit
	RoleUpdateAudit
	RoleDeleteAudit
	RoleManagePermissionsAudit
	RoleManageUsersAudit
	RoleManageTeamsAudit

	//Features
	ManageDashboardFeaturesAudit
)

type EventMetadata struct {
	AuditCategory string
	OperationType string
	ObjectName    string
	ObjectDetails string
}

func (t EventType) toMeta() *EventMetadata {
	switch t {
	case DataSourceAddEvent:
		return &EventMetadata{
			AuditCategory: "DATASOURCE",
			OperationType: "ADD_DATASOURCE",
			ObjectName:    "Datasource",
			ObjectDetails: "Datasource of type: %s",
		}
	case DataSourceUpdateEvent:
		return &EventMetadata{
			AuditCategory: "DATASOURCE",
			OperationType: "UPDATE_DATASOURCE",
			ObjectName:    "Datasource",
			ObjectDetails: "Datasource of type: %s",
		}
	case DataSourceDeleteEvent:
		return &EventMetadata{
			AuditCategory: "DATASOURCE",
			OperationType: "DELETE_DATASOURCE",
			ObjectName:    "Datasource",
			ObjectDetails: "Datasource of type: %s",
		}
	case PreferencesEvent:
		return &EventMetadata{
			AuditCategory: "PREFERENCES",
			OperationType: "ORG_PREFERENCES",
			ObjectName:    "Organization Preferences",
			ObjectDetails: "Change in organization preference",
		}
	case ReportBrandingSettingsEvent:
		return &EventMetadata{
			AuditCategory: "REPORTS_SETTING",
			OperationType: "REPORTS_BRANDING_SETTING",
			ObjectName:    "Reports Branding Setting",
			ObjectDetails: "Branding setting for organization",
		}
	case ReportFtpSettingsEvent:
		return &EventMetadata{
			AuditCategory: "REPORTS_SETTING",
			OperationType: "REPORTS_FTP_SETTING",
			ObjectName:    "Reports FTP Setting",
			ObjectDetails: "FTP setting for organization",
		}
	case DashboardCreateAudit:
		return &EventMetadata{
			AuditCategory: "DASHBOARD",
			OperationType: "CREATE",
			ObjectName:    "Dashboard",
		}
	case DashboardUpdateAudit:
		return &EventMetadata{
			AuditCategory: "DASHBOARD",
			OperationType: "UPDATE",
			ObjectName:    "Dashboard",
		}
	case DashboardDeleteAudit:
		return &EventMetadata{
			AuditCategory: "DASHBOARD",
			OperationType: "DELETE",
			ObjectName:    "Dashboard",
		}
	case DashboardSoftDeleteAudit:
		return &EventMetadata{
			AuditCategory: "DASHBOARD",
			OperationType: "DELETE",
			ObjectName:    "Dashboard",
		}
	case RestoreDeletedDashboardAudit:
		return &EventMetadata{
			AuditCategory: "DASHBOARD",
			OperationType: "RESTORE",
			ObjectName:    "Dashboard",
		}
	case DashboardPermissionUpdateAudit:
		return &EventMetadata{
			AuditCategory: "DASHBOARD",
			OperationType: "PERMISSION_UPDATE",
			ObjectName:    "Dashboard",
		}
	case ReportSchedulerCreateAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "CREATE",
			ObjectName:    "Report Scheduler",
		}
	case ReportSchedulerUpdateAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "UPDATE",
			ObjectName:    "Report Scheduler",
		}
	case ReportSchedulerDeleteAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "DELETE",
			ObjectName:    "Report Scheduler",
		}
	case ReportSchedulerEnableAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "ENABLE",
			ObjectName:    "Report Scheduler",
		}
	case ReportSchedulerDisableAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "DISABLE",
			ObjectName:    "Report Scheduler",
		}
	case ReportSchedulerRunNowAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "RUN_NOW",
			ObjectName:    "Report Scheduler",
		}
	case ReportSchedulerReassignOwnerAudit:
		return &EventMetadata{
			AuditCategory: "REPORT SCHEDULER",
			OperationType: "REASSIGN",
			ObjectName:    "Report Scheduler",
		}
	case FolderCreateAudit:
		return &EventMetadata{
			AuditCategory: "FOLDER",
			OperationType: "CREATE",
			ObjectName:    "Folder",
		}
	case FolderUpdateAudit:
		return &EventMetadata{
			AuditCategory: "FOLDER",
			OperationType: "UPDATE",
			ObjectName:    "Folder",
		}
	case FolderDeleteAudit:
		return &EventMetadata{
			AuditCategory: "FOLDER",
			OperationType: "DELETE",
			ObjectName:    "Folder",
		}
	case FolderPermissionUpdateAudit:
		return &EventMetadata{
			AuditCategory: "FOLDER",
			OperationType: "PERMISSION_UPDATE",
			ObjectName:    "Folder",
		}
	case RoleCreateAudit:
		return &EventMetadata{
			AuditCategory: "ROLE",
			OperationType: "CREATE",
			ObjectName:    "Role",
		}
	case RoleUpdateAudit:
		return &EventMetadata{
			AuditCategory: "ROLE",
			OperationType: "UPDATE",
			ObjectName:    "Role",
		}
	case RoleDeleteAudit:
		return &EventMetadata{
			AuditCategory: "ROLE",
			OperationType: "DELETE",
			ObjectName:    "Role",
		}
	case RoleManagePermissionsAudit:
		return &EventMetadata{
			AuditCategory: "ROLE",
			OperationType: "MANAGE_PERMISSIONS",
			ObjectName:    "Role",
		}
	case RoleManageUsersAudit:
		return &EventMetadata{
			AuditCategory: "ROLE",
			OperationType: "MANAGE_USERS",
			ObjectName:    "Role",
		}
	case RoleManageTeamsAudit:
		return &EventMetadata{
			AuditCategory: "ROLE",
			OperationType: "MANAGE_TEAMS",
			ObjectName:    "Role",
		}
	case ManageDashboardFeaturesAudit:
		return &EventMetadata{
			AuditCategory: "PREFERENCES",
			OperationType: "MANAGE_FEATURES",
			ObjectName:    "Dashboard Features",
		}
	default:
		return &EventMetadata{
			AuditCategory: "UNKNOWN",
			OperationType: "UNKNOWN_OPERATION",
			ObjectName:    "N/A",
			ObjectDetails: "N/A",
		}
	}
}

type EventOpt struct {
	Ctx              *contextmodel.ReqContext
	AuditCategory    string
	ObjectID         string
	ObjectCategory   string
	ObjectName       string
	ObjectType       string
	ObjectDetails    string
	OperationType    string
	OperationStatus  string
	OperationSubType string
	Prev             interface{}
	New              interface{}
	Err              error
}

func (t EventType) Send(opt EventOpt) {
	instance := GetInstance()
	if opt.Ctx == nil || instance == nil {
		return
	}
	tenantID := strconv.FormatInt(opt.Ctx.OrgID, 10)
	userID := strconv.FormatInt(opt.Ctx.UserID, 10)
	loginName := opt.Ctx.SignedInUser.Name
	if len(loginName) == 0 {
		loginName = opt.Ctx.SignedInUser.Login
	}

	meta := t.toMeta()
	eventData := Data{
		AuditCategory:  meta.AuditCategory,
		ObjectID:       meta.ObjectName,
		ObjectCategory: meta.ObjectName,
		ObjectName:     meta.ObjectName,
		ObjectType:     meta.ObjectName,
		ObjectDetails:  meta.ObjectDetails,
		Operation:      opt.Ctx.Context.Req.Method,
		OperationType:  meta.OperationType,
		ActorUserID:    userID,
		ActorLoginID:   loginName,
		TenantID:       tenantID,
		Source:         LookUpIp(opt.Ctx.Req.Header.Get("Origin")),
	}

	if opt.Err != nil {
		eventData.OperationStatus = "FAILED"
		eventData.OperationSubType = "Failed to run operation: " + opt.Err.Error()
	} else {
		eventData.OperationStatus = "SUCCESS"
		eventData.OperationSubType = "Successfully run operation"
		eventData.ChangeValues = &ChangeValues{
			PreviousValue: simplejson.NewFromAny(opt.Prev),
			NewValue:      simplejson.NewFromAny(opt.New),
		}
	}

	if opt.AuditCategory != "" {
		eventData.AuditCategory = opt.AuditCategory
	}
	if opt.ObjectID != "" {
		eventData.ObjectID = opt.ObjectID
	}
	if opt.ObjectCategory != "" {
		eventData.ObjectCategory = opt.ObjectCategory
	}
	if opt.ObjectName != "" {
		eventData.ObjectName = opt.ObjectName
	}
	if opt.ObjectType != "" {
		eventData.ObjectType = opt.ObjectType
	}
	if opt.ObjectDetails != "" {
		eventData.ObjectDetails = opt.ObjectDetails
	}
	if opt.OperationType != "" {
		eventData.OperationType = opt.OperationType
	}
	if opt.OperationStatus != "" {
		eventData.OperationStatus = opt.OperationStatus
	}
	if opt.OperationSubType != "" {
		eventData.OperationSubType = opt.OperationSubType
	}

	instance.SendKafkaEvent(eventData)
}
