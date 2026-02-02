package usagedata

import (
	"errors"
	"fmt"
)

// Typed errors
var (
	ErrNoDashboardsWithUsageDataFound = errors.New("usage data does not exist or has not been collected for any dashboard")
	ErrUserIdNotFound                 = errors.New("user id not provided")
	ErrNoData                         = errors.New("No data found")
)

type UsageDataResponse interface {
	Len() int
}

type Panel struct {
	ID                  string `xorm:"DashboardUID"`
	Title               string `xorm:"DashboardTitle"`
	PluginType          string `xorm:"plugintype"`
	PanelTitle          string `xorm:"paneltitle"`
	Creator             string `xorm:"DashboardCreator"`
	CreatedTime         string `xorm:"CreateDate"`
	LastUpdatedTime     string `xorm:"UpdateDate"`
	NumReportsScheduled int    `xorm:"NoOfReportSchedules"`
	Deprecated          bool
}

func (d Panel) String() string {
	return fmt.Sprintf("%v - %v using \"%v\" plugin on  \"%v\" panel", d.Title, d.ID, d.PluginType, d.PanelTitle)
}

type PluginInfoResponse struct {
	Data []Panel
}

func (r PluginInfoResponse) Len() int {
	return len(r.Data)
}

type RolesPermissions struct {
	UserID             int64    `json:"user_id"`
	OrgID              int64    `json:"org_id"`
	UserName           string   `json:"user_name"`
	DashboardTitle     string   `json:"dashboard_title"`
	FolderUID          string   `json:"folder_uid"`
	FolderTitle        string   `json:"folder_title"`
	Is_Folder          bool     `json:"is_folder"`
	DashboardUID       string   `json:"dashboard_uid"`
	DashboardCreatedBy string   `json:"created_by"`
	DashboardUpdatedBy string   `json:"updated_by"`
	ActionIDList       []string `json:"action_id_list"`
	Permission         string   `json:"permission"`
}
type RolesPermissionsResponse struct {
	Data []RolesPermissions
}

func (r RolesPermissionsResponse) Len() int {
	return len(r.Data)
}

type UserCounts struct {
	TotalUsers           int64   `xorm:"TotalUsers"`
	ActiveUsers          int64   `xorm:"ActiveUsers"`
	ReferenceEpoch30Days float64 `xorm:"reference_epoch"`
	Id_User              int64   `xorm:"id"`
	Login_User           string  `xorm:"login"`
	Email_User           string  `xorm:"email"`
	Name_User            string  `xorm:"name"`
	Created              string  `xorm:"created"`
	Last_seen_At_Epoch   float64 `xorm:"last_seen_at_epoch"`
	Last_Seen_At         string  `xorm:"last_seen_at"`
	Team_Names           string  `xorm:"team_names"`
	BHD_Roles            string  `xorm:"bhd_roles"`
	UserIdentifier       string  `xorm:"useridentifier"`
}

type UserCountResponse struct {
	Data []UserCounts
}

func (u UserCountResponse) Len() int {
	return len(u.Data)
}

type Schedule struct {
	ReportId      int    `xorm:"report_id"`
	IsActive      bool   `xorm:"is_active"`
	ScheduleName  string `xorm:"schedule_name"`
	Creator       string `xorm:"creator"`
	DashboardName string `xorm:"dashboard_name"`
	DashboardUID  string `xorm:"dashboard_uid"`
	Created       string `xorm:"created"`
	LastUpdated   string `xorm:"last_updated"`
	ReportType    string `xorm:"report_type"`
	ScheduleType  string `xorm:"schedule_type"`
	LastRunStatus string `xorm:"last_run_status"`
	Description   string `xorm:"description"`
	LastRunAt     string `xorm:"last_run_at"`
}

type ScheduleResponse struct {
	Data      []Schedule
	StartTime string
	EndTime   string
}

func (r ScheduleResponse) Len() int {
	return len(r.Data)
}

type OrgLevelDashboardStatistics struct {
	DashboardID      string  `xorm:"dashboard_id"`
	DashboardUID     string  `xorm:"dashboard_uid"`
	DashboardTitle   string  `xorm:"dashboard_title"`
	FolderName       string  `xorm:"folder_name"`
	TotalViews       int64   `xorm:"total_views"`
	ViewsInRange     int64   `xorm:"views_in_range"`
	AvgLoadTime      float64 `xorm:"avg_load_time"`
	LastAccessedTime string  `xorm:"last_accessed_time"`
}

type OrgLevelDashboardStatisticsResponse struct {
	Data      []OrgLevelDashboardStatistics
	StartTime string
	EndTime   string
}

func (o OrgLevelDashboardStatisticsResponse) Len() int {
	return len(o.Data)
}

type IndividualDashboardStatistics struct {
	DashboardUID     string  `xorm:"dashboard_uid"`
	DashboardTitle   string  `xorm:"dashboard_title"`
	TotalViews       int64   `xorm:"total_views"`
	AvgLoadTime      float64 `xorm:"avg_load_time"`
	LastAccessedTime string  `xorm:"last_accessed_time"`
}

type IndividualDashboardStatisticsResponse struct {
	Data []IndividualDashboardStatistics
}

func (i IndividualDashboardStatisticsResponse) Len() int {
	return len(i.Data)
}

type DashboardHits struct {
	Hits          int64  `xorm:"hits"`
	CollectedTime string `xorm:"collected_time"`
}

type DashboardHitsResponse struct {
	Data []DashboardHits
}

func (d DashboardHitsResponse) Len() int {
	return len(d.Data)
}

type DashboardLoadTimes struct {
	LoadTime      float64 `xorm:"load_time"`
	CollectedTime string  `xorm:"collected_time"`
}

type DashboardLoadTimesResponse struct {
	Data []DashboardLoadTimes
}

func (d DashboardLoadTimesResponse) Len() int {
	return len(d.Data)
}

type DashboardHitCountWithUserInfoLong struct {
	Id            int64   `xorm:"id"`
	DataDelta     float32 `xorm:"data_delta"`
	CollectedTime string  `xorm:"collected_time"`
	Name          string  `xorm:"name"`
	UserId        int64   `xorm:"user_id"`
	UName         string  `xorm:"username"`
}
type DashboardHitCountWithUserInfoLongResponse struct {
	Data []DashboardHitCountWithUserInfoLong
}

func (d DashboardHitCountWithUserInfoLongResponse) Len() int {
	return len(d.Data)
}

type DashboardHitCountWithUserInfoShort struct {
	Id            int64   `xorm:"id"`
	DataDelta     float32 `xorm:"data_delta"`
	CollectedTime string  `xorm:"collected_time"`
	Name          string  `xorm:"name"`
}
type DashboardHitCountWithUserInfoShortResponse struct {
	Data []DashboardHitCountWithUserInfoShort
}

func (d DashboardHitCountWithUserInfoShortResponse) Len() int {
	return len(d.Data)
}

type DashboardDetails struct {
	Id         int64  `xorm:"d_id"`
	Title      string `xorm:"d_title"`
	FolderName string `xorm:"foldername"`
}

type DashboardDetailsResponse struct {
	Data []DashboardDetails
}

func (d DashboardDetailsResponse) Len() int {
	return len(d.Data)
}

type ScheduleStaging struct {
	Description   string `xorm:"description"`
	ErrLog        string `xorm:"errors"`
	StartedAt     string `xorm:"started_at"`
	ReportId      int64  `xorm:"report_id"`
	ScheduleName  string `xorm:"schedule_name"`
	Creator       string `xorm:"creator"`
	DashboardName string `xorm:"dashboard_name"`
	DashboardUID  string `xorm:"dashboard_uid"`
	ReportType    string `xorm:"report_type"`
	ScheduleType  string `xorm:"schedule_type"`
}

type ScheduleStagingResponse struct {
	Data []ScheduleStaging
}

func (ss ScheduleStagingResponse) Len() int {
	return len(ss.Data)
}

type ScheduleLongInfo struct {
	ReportId      int    `xorm:"report_id"`
	IsActive      bool   `xorm:"is_active"`
	ScheduleName  string `xorm:"schedule_name"`
	Creator       string `xorm:"creator"`
	DashboardName string `xorm:"dashboard_name"`
	DashboardUID  string `xorm:"dashboard_uid"`
	Created       string `xorm:"created"`
	LastUpdated   string `xorm:"last_updated"`
	ReportType    string `xorm:"report_type"`
	ScheduleType  string `xorm:"schedule_type"`
	LastRunStatus string `xorm:"last_run_status"`
	Description   string `xorm:"description"`
	LastRunAt     string `xorm:"last_run_at"`
	TotalRuns     int    `xorm:"total_runs"`
	Recipients    string `xorm:"recipients"`
}

type ScheduleLongInfoResponse struct {
	Data      []ScheduleLongInfo
	StartTime string
	EndTime   string
}

func (r ScheduleLongInfoResponse) Len() int {
	return len(r.Data)
}

type ScheduleShortInfo struct {
	ReportId      int    `xorm:"report_id"`
	IsActive      bool   `xorm:"is_active"`
	ScheduleName  string `xorm:"schedule_name"`
	Creator       string `xorm:"creator"`
	Created       string `xorm:"created"`
	LastUpdated   string `xorm:"last_updated"`
	DashboardName string `xorm:"dashboard_name"`
	DashboardUID  string `xorm:"dashboard_uid"`
	ReportType    string `xorm:"report_type"`
	ScheduleType  string `xorm:"schedule_type"`
	Recipients    string `xorm:"recipients"`
}

type ScheduleShortInfoResponse struct {
	Data      []ScheduleShortInfo
	StartTime string
	EndTime   string
}

func (r ScheduleShortInfoResponse) Len() int {
	return len(r.Data)
}

type ActiveDashboardsCount struct {
	Active_Dashboards_Count int64 `xorm:"act_dash_count"`
}

type ActiveDashboardsCountResponse struct {
	Data []ActiveDashboardsCount
}

type DataVolume struct {
	Id             int64   `xorm:"metric_id"`
	DatasourceID   int64   `xorm:"datasource_id"`
	DataDelta      int64   `xorm:"data_delta"`
	DatasourceName string  `xorm:"datasource_name"`
	DatasourceType string  `xorm:"datasource_type"`
	DashboardName  string  `xorm:"dashboard_name"`
	DashboardUID   string  `xorm:"dashboard_uid"`
	UserEmail      string  `xorm:"user_email"`
	UserName       string  `xorm:"user_name"`
	CollectedTime  string  `xorm:"collected_time"`
	UserId         string  `xorm:"user_id"`
}

type DataVolumeResponse struct {
	Data []DataVolume
}

func (r DataVolumeResponse) Len() int {
	return len(r.Data)
}

type IFValueRealization struct {
	Id                        int64  `xorm:"metric_id"`
	DatasourceID              string `xorm:"datasource_id"`
	PromptCountDelta          int64  `xorm:"prompt_count_delta"`
	ConversationCountDelta    int64  `xorm:"conversation_count_delta"`
	PanelsGeneratedCountDelta int64  `xorm:"panels_generated_count_delta"`
	PromptCountRaw            int64  `xorm:"prompt_count_raw"`
	ConversationCountRaw      int64  `xorm:"conversation_count_raw"`
	PanelsGeneratedCountRaw   int64  `xorm:"panels_generated_count_raw"`
	ResponseTime              int64 `xorm:"response_time_ms_delta"`
	AgentId                   string `xorm:"agent_id"`
	UserEmail                 string `xorm:"user_email"`
	UserName                  string `xorm:"user_name"`
	CollectedTime             string `xorm:"collected_time"`
	UserId                    int64  `xorm:"user_id"`
	UserLogin                 string `xorm:"user_login"`
	DatasourceName            string `xorm:"datasource_name"`	
}

type IFValueRealizationResponse struct {
	Data []IFValueRealization
}

func (r IFValueRealizationResponse) Len() int {
	return len(r.Data)
}

type IFDashboardCount struct {
    UserLogin            string `xorm:"user_login"`
    UserId               int64  `xorm:"user_id"`
    RoleID               int64  `xorm:"role_id"`
    IFDashboards         int64  `xorm:"if_dashboards"`
    NonIFDashboards      int64  `xorm:"nonif_dashboards"`
    CreatedDate          string `xorm:"created_date"`
    CreatedAt            string `xorm:"created_at"`
    DashboardTitle       string `xorm:"title"`
}

type IFDashboardCountResponse struct {
	Data []IFDashboardCount
}

func (r IFDashboardCountResponse) Len() int {
	return len(r.Data)
}
