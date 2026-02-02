package usagedataimpl

import (
	"context"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/usagedata"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	GetDashboardsUsingDepPlugs(context.Context, int64) (usagedata.PluginInfoResponse, error)
	GetUserDataService(ctx context.Context, orgID int64, loginId string, status string, useridentifier string) (usagedata.UserCountResponse, error)
	GetDashboardsRepoSchedule(context.Context, string, string, int64, bool, bool) (usagedata.UsageDataResponse, error)
	GetRolesAndPermissionsService(context.Context, int64, accesscontrol.DashboardPermissionsService, accesscontrol.FolderPermissionsService, string) (usagedata.RolesPermissionsResponse, error)
	GetOrgLevelDashboardStatistics(context.Context, string, string, int64) (usagedata.OrgLevelDashboardStatisticsResponse, error)
	GetIndividualDashboardStatistics(context.Context, int64, int64) (usagedata.IndividualDashboardStatisticsResponse, error)
	GetDashboardHits(context.Context, string, string, int64, int64) (usagedata.DashboardHitsResponse, error)
	GetDashboardLoadTimes(context.Context, string, string, int64, int64) (usagedata.DashboardLoadTimesResponse, error)
	GetDashboardHitsUserInfo(ctx context.Context, fromTime string, toTime string, orgID int64, user string, dashboard string) (usagedata.UsageDataResponse, error)
	GetDashboardDetails(ctx context.Context, orgID int64, folder string, title string, status string) (usagedata.DashboardDetailsResponse, error)
	GetSchedulerStaging(context.Context, int64, string, string, string, bool) (usagedata.ScheduleStagingResponse, error)
	GetNextSchedules(context.Context, int64) (usagedata.ScheduleShortInfoResponse, error)
	GetActiveDashboardsCount(ctx context.Context, orgID int64) (usagedata.ActiveDashboardsCountResponse, error)
	GetDataVolume(ctx context.Context, orgID int64, datasourceID int64, fromTime string, toTime string) (usagedata.DataVolumeResponse, error)
	GetIFValueRealization(ctx context.Context, orgID int64, userID int64, fromTime string, toTime string) (usagedata.IFValueRealizationResponse, error)
	GetIFDashboardCount(ctx context.Context, orgID int64, userID int64, fromTime string, toTime string) (usagedata.IFDashboardCountResponse, error)
}

// Query object for executing usagedata query on grafana postgres database
type pgDbQuery struct {
	// contains raw sql string
	sql string
	// any parameters required in raw sql string
	parameters []any
	// description related to query for logging
	description string
	// organization Id
	orgId int64
}

// Create default structure variable for postgres database sql query execution (constructor)
func getQueryObject() *pgDbQuery {
	query := new(pgDbQuery)
	query.sql = "SELECT 1"
	query.description = "SQL statement"
	return query
}

func (queryObj *pgDbQuery) executeQuery(ss *sqlStore, dbSess *db.Session, response any) error {
	err := dbSess.SQL(queryObj.sql, queryObj.parameters...).Find(response)
	ss.log.Info("Params ", queryObj.parameters)
	if err != nil {
		ss.log.Error("Error while running SQL query to fetch "+queryObj.description, "tenant id", queryObj.orgId, "Parameters", queryObj.parameters)
	}
	// check if response array contains any data or not
	v := reflect.ValueOf(response)
	if v.Kind() == reflect.Ptr && v.Elem().Kind() == reflect.Slice {
		if v.Elem().Len() == 0 {
			ss.log.Warn("No Data fetched for "+queryObj.description, "tenant id", queryObj.orgId, "Parameters", queryObj.parameters)
		}
	}
	return err
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	log     log.Logger
	cfg     *setting.Cfg
}

// tkumthek change

func (ss *sqlStore) GetRolesAndPermissionsService(ctx context.Context, orgID int64, dashboardPermissionsService accesscontrol.DashboardPermissionsService, folderPermissionService accesscontrol.FolderPermissionsService, user_id string) (usagedata.RolesPermissionsResponse, error) {
	var result usagedata.RolesPermissionsResponse
	if user_id == "" {
		ss.log.Error(usagedata.ErrUserIdNotFound.Error(), "orgID", orgID)
		return result, usagedata.ErrUserIdNotFound
	}

	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		ss.log.Info("Running SQL query to fetch roles and permissions")
		rawSQL := `

WITH all_user_roles AS (
    SELECT ur.user_id, ur.role_id, ur.org_id 
    FROM user_role ur
    UNION
    SELECT tm.user_id, tr.role_id, tr.org_id 
    FROM team_member tm 
    JOIN team_role tr ON tm.team_id = tr.team_id AND tm.org_id = tr.org_id
    UNION
    SELECT ubr.user_id, br.role_id, br.org_id 
    FROM user_bhd_role ubr 
    JOIN bhd_role brh ON ubr.bhd_role_id = brh.bhd_role_id 
    JOIN builtin_role br ON br.role = brh.name AND br.org_id = ubr.org_id
    UNION
    SELECT tm.user_id, br.role_id, br.org_id 
    FROM team_member tm 
    JOIN team_bhd_role tbr ON tm.team_id = tbr.team_id AND tm.org_id = tbr.org_id 
    JOIN bhd_role brh ON tbr.bhd_role_id = brh.bhd_role_id 
    JOIN builtin_role br ON br.role = brh.name AND br.org_id = tbr.org_id
),
user_dashboard_permissions AS (
    SELECT
        aur.user_id,
        aur.org_id,
        u.name AS user_name,
        d.title AS dashboard_title,
        d.is_folder,
        d.folder_uid,
        f.title AS folder_title,
        d.uid AS dashboard_uid,
        p.action,
        uc.login AS created_by,
        uu.login AS updated_by
    FROM all_user_roles aur
    JOIN permission p ON aur.role_id = p.role_id
    JOIN dashboard d ON p.identifier = d.uid AND d.org_id = aur.org_id
    JOIN public.user u ON u.id = aur.user_id
    LEFT JOIN folder f ON d.folder_uid = f.uid AND f.org_id = aur.org_id
    LEFT JOIN public.user uc ON uc.id = d.created_by
    LEFT JOIN public.user uu ON uu.id = d.updated_by
    WHERE 
	aur.org_id = %d
    AND
	aur.user_id = %s
    GROUP BY aur.user_id, aur.org_id, u.name, d.title, d.uid, p.action, d.is_folder, d.folder_uid, f.title, uc.login, uu.login
)
SELECT
    user_id,
    org_id,
    user_name,
    CASE 
        WHEN is_folder = true THEN NULL 
        ELSE dashboard_title 
    END AS dashboard_title,
    CASE 
        WHEN is_folder = true THEN NULL 
        ELSE dashboard_uid 
    END AS dashboard_uid,
    is_folder,
    CASE 
        WHEN is_folder = true THEN dashboard_title 
        ELSE folder_title 
    END AS folder_title,
    CASE 
        WHEN is_folder = true THEN dashboard_uid 
        ELSE folder_uid 
    END AS folder_uid,
    STRING_AGG(action, ',') AS actions,
	created_by, updated_by
FROM user_dashboard_permissions
GROUP BY user_id, 
    org_id, 
    user_name, 
    CASE WHEN is_folder = true THEN NULL ELSE dashboard_title END,
    CASE WHEN is_folder = true THEN NULL ELSE dashboard_uid END,
    is_folder,
    CASE WHEN is_folder = true THEN dashboard_title ELSE folder_title END,
    CASE WHEN is_folder = true THEN dashboard_uid ELSE folder_uid END,
    created_by, 
    updated_by;
	        `

		// Format the SQL with the values
		formattedSQL := fmt.Sprintf(rawSQL, orgID, user_id)

		rawResults, err := dbSess.Query(formattedSQL)
		if err != nil {
			ss.log.Error("Error executing roles and permissions query", "error", err)
			return err
		}
		mapActionsToPermission := func(actions []string) string {
			permissionsToActions := dashboardPermissionsService.GetPermissionsToActions()
			// Convert actions list to a map for faster lookup
			actionMap := make(map[string]bool)
			for _, action := range actions {
				actionMap[action] = true
			}
			// Check each permission in priority order
			permissions := dashboardPermissionsService.GetPermissionsList()
			for _, permission := range permissions {
				requiredActions := permissionsToActions[permission]
				hasAllRequired := true
				// Check if all required actions for this permission are present
				for _, requiredAction := range requiredActions {
					if !actionMap[requiredAction] {
						hasAllRequired = false
						break
					}
				}
				if hasAllRequired {
					return permission
				}
			}
			// If no permission matches, return a default value
			return "None"
		}
		// Process each row manually
		for _, row := range rawResults {
			var perm usagedata.RolesPermissions
			// Safely extract numeric values
			if userID, err := strconv.ParseInt(string(row["user_id"]), 10, 64); err == nil {
				perm.UserID = userID
			}
			if orgID, err := strconv.ParseInt(string(row["org_id"]), 10, 64); err == nil {
				perm.OrgID = orgID
			}

			// Extract string values
			perm.UserName = string(row["user_name"])
			perm.DashboardTitle = string(row["dashboard_title"])
			perm.FolderUID = string(row["folder_uid"])
			perm.FolderTitle = string(row["folder_title"])
			perm.DashboardUID = string(row["dashboard_uid"])
			perm.DashboardCreatedBy = string(row["created_by"])
			perm.DashboardUpdatedBy = string(row["updated_by"])
			if val, ok := row["is_folder"]; ok {
				perm.Is_Folder, _ = strconv.ParseBool(string(val))
			}
			// Handle actions list
			actionsStr := string(row["actions"])
			if actionsStr != "" {
				perm.ActionIDList = strings.Split(actionsStr, ",")
				// Use our helper function with values from the service
				perm.Permission = mapActionsToPermission(perm.ActionIDList)
			} else {
				perm.ActionIDList = []string{}
			}
			result.Data = append(result.Data, perm)
		}
		return err
	})

	ss.log.Info("ran all queries to get roles and permissions", "orgId", orgID)

	if err != nil {
		ss.log.Error("error when fetching roles and permissions", err, "orgID", orgID)
	}

	if result.Len() == 0 {
		ss.log.Error("No roles and permissions found", err, "orgID", orgID)
	}

	return result, err
}

func (ss *sqlStore) GetDashboardsUsingDepPlugs(ctx context.Context, orgID int64) (usagedata.PluginInfoResponse, error) {
	var result usagedata.PluginInfoResponse

	ss.log.Info("Running SQL query to fetch all panels")
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		// Raw SQL to run on the DB to fetch list of dashboards using deprecated plugins.
		rawSQL := `
		SELECT 
			title AS DashboardTitle,
			uid AS DashboardUID,			 
			(SELECT login FROM PUBLIC.user WHERE id=d.created_by) AS DashboardCreator,
			created as CreateDate,
			updated as UpdateDate,	
			CASE
				WHEN panel_element->>'type' IS NULL
				THEN (SELECT TYPE FROM library_element WHERE uid=(panel_element->'libraryPanel'->>'uid') limit 1)
				ELSE panel_element->>'type'
				END
				AS PluginType, 
			panel_element->>'title' AS PanelTitle,
			(SELECT COUNT(id) FROM report_data WHERE dashboard_id=d.id) AS NoOfReportSchedules
		FROM dashboard d,
		LATERAL jsonb_array_elements(data::jsonb->'panels') AS panel_element
		WHERE
			jsonb_typeof(data::jsonb->'panels') = 'array'	
			AND is_folder=false
			AND org_id=?
		LIMIT 25000;
		`

		err := dbSess.SQL(rawSQL, orgID).Find(&result.Data)
		return err
	})

	ss.log.Info("Ran SQL query to fetch all panels", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch all panels", "orgID", orgID)
	}
	if result.Len() == 0 {
		ss.log.Error("No panels exist for the org", "orgId", orgID)
	}

	return result, err
}

// surghosh change
func (ss *sqlStore) GetUserDataService(ctx context.Context, orgID int64, loginId string, status string, useridentifier string) (usagedata.UserCountResponse, error) {
	var result usagedata.UserCountResponse
	ss.log.Info("Running SQL query to fetch user counts")

	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `
SELECT
    COUNT(u.id) OVER () AS TotalUsers,
    COUNT(u.id) FILTER (WHERE u.last_seen_at >= NOW() - INTERVAL '30 days') OVER () AS ActiveUsers,
    EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') As reference_epoch,
    u.id,
    u.login,
    u.email,
    u.name,
    u.created,
	STRING_AGG(DISTINCT br.name, ', ' ORDER BY br.name) AS bhd_roles,
    EXTRACT(EPOCH FROM u.last_seen_at) AS last_seen_at_epoch,
    u.last_seen_at,
    STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) AS team_names,
	u.login || ' (' || u.name || ')' AS useridentifier
FROM
    public."user" u
    LEFT JOIN public.team_member as tm on u.id = tm.user_id 
    LEFT JOIN public.team as t on t.id = tm.team_id
	LEFT JOIN public.user_bhd_role as ubr on u.id=ubr.user_id
	LEFT JOIN public.bhd_role as br on ubr.bhd_role_id=br.bhd_role_id
WHERE
    %s
    %s
	%s
    u.org_id = ?
GROUP BY
    u.id,
    u.login,
    u.email,
    u.name,
    u.created,
    u.last_seen_at;
					`
		condition := ""
		activeCondition := ""
		useridentifier_condition := ""
		// preparing login filter
		if loginId != "" {
			condition = fmt.Sprintf("u.login = '%s' AND", loginId)
		}
		// preparing active user filter
		if strings.EqualFold(status, "active") {
			activeCondition = "u.last_seen_at >= NOW() - INTERVAL '30 days' AND"
		}
		// preparing login with name condition
		if useridentifier != "" {
			useridentifier_condition = fmt.Sprintf("u.login || ' (' || u.name || ')' = '%s' AND", useridentifier)
		}
		rawSQL = fmt.Sprintf(rawSQL, condition, activeCondition, useridentifier_condition)
		err := dbSess.SQL(rawSQL, orgID).Find(&result.Data)
		return err
	})
	ss.log.Info("Ran all queries in user data service", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch user counts")
	}
	if result.Len() == 0 {
		ss.log.Error("No user count found", "orgID", orgID)
	}

	return result, err
}

// purva change
func (ss *sqlStore) GetDashboardsRepoSchedule(ctx context.Context, fromTime string, toTime string, orgID int64, lastDayScheduleDetails bool, allScheduleInfo bool) (usagedata.UsageDataResponse, error) {
	var result usagedata.UsageDataResponse

	ss.log.Info("Running SQL query to fetch reports schedule info", "lastDayScheduleDetails", lastDayScheduleDetails, "allScheduleInfo", allScheduleInfo, "orgID", orgID)

	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		var response usagedata.ScheduleResponse
		var allScheduleInfoResponse usagedata.ScheduleLongInfoResponse
		var subQuery string
		var queryArgs []interface{}
		var joinType string
		var reportSelectColumns string
		var err error

		reportSelectColumns = `r.id AS Report_Id,
				r.enabled AS Is_Active,
				r.name AS Schedule_Name,
				u.login AS Creator,
				d.title AS Dashboard_Name,
				d.uid AS Dashboard_Uid,
				created_at AS Created,
				updated_at AS Last_Updated,
				report_type AS Report_Type,
				schedule_type AS Schedule_Type,
				CASE
						WHEN Status = -1 THEN 'Fail'
						WHEN Status = -2 THEN 'Skipped'
						WHEN js.Description LIKE '3.%' THEN 'Success'
						WHEN js.Description IS NOT NULL AND js.started_at + '1h' < NOW() THEN 'Fail'
						ELSE 'Unknown' END as Last_Run_Status,
				js.Description,
				js.started_at AS Last_Run_At`

		//Default Usecase for Active and Inactive Schedules
		if !lastDayScheduleDetails && !allScheduleInfo {
			joinType = "LEFT"
			subQuery = getQueryForSchedule()
			queryArgs = []interface{}{fromTime, toTime}
		}
		//To get the Schedule Details for Last 24 hours
		if lastDayScheduleDetails {
			joinType = "RIGHT"
			subQuery = getQuerylastDayScheduleDetails()
			queryArgs = []interface{}{}
		}
		//To get the all the Schedule Details
		if allScheduleInfo {
			reportSelectColumns = reportSelectColumns + `, (SELECT COUNT(*) FROM job_queue jq WHERE jq.report_data_id = r.id) AS Total_Runs,
			r.recipients`
			joinType = "RIGHT"
			subQuery = getQueryTotalInfoSchedule()
			queryArgs = []interface{}{fromTime, toTime}
		}

		query := dbSess.Table("report_data").Alias("r").
			Select(reportSelectColumns).
			Join("LEFT", "\"user\" u", "u.id = r.user_id").
			Join("LEFT", "dashboard d", "d.id = r.dashboard_id").
			Join(joinType, subQuery, "r.id=js.Schedule_Id", queryArgs...).
			Where("r.org_id = ?", orgID).Limit(1000)

		if allScheduleInfo {
			err = query.Find(&allScheduleInfoResponse.Data)
			result = allScheduleInfoResponse
		} else {
			err = query.Find(&response.Data)
			result = response
		}
		return err
	})
	ss.log.Info("Ran SQL queries to fetch scheduler info", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to schedule statistics", "orgID", orgID)
	}
	if result.Len() == 0 {
		ss.log.Error("No dashboards found with usage data", "orgID", orgID)
	}

	return result, err
}

func getQueryTotalInfoSchedule() string {
	return `(
		SELECT DISTINCT ON (j.id)
			COALESCE(j.description,max(s.description)) AS Description,
			COALESCE(j.value, min(s.value)) AS Status,
			j.Id As Execution_Id,
			j.report_data_id AS Schedule_Id,
			j.started_at
		FROM job_queue j 
		LEFT JOIN job_status s ON j.id=s.job_queue_id
		WHERE
		j.started_at >= ? AND j.started_at <= ? GROUP BY j.id) js`
}

func getQuerylastDayScheduleDetails() string {
	return `( 
	SELECT
		COALESCE(j.description,max(s.description)) AS Description,
		COALESCE(j.value, min(s.value)) AS Status,
		j.id As Execution_Id,
		j.report_data_id AS Schedule_Id,
		j.started_at
	FROM job_queue j 
	LEFT JOIN job_status s ON j.id=s.job_queue_id
	WHERE j.started_at >= NOW() - INTERVAL '24 hours' GROUP BY j.id) js`
}

func getQueryForSchedule() string {
	return `(
	SELECT DISTINCT ON(j.report_data_id)
		COALESCE(j.description,max(s.description)) AS Description,
		COALESCE(j.value, min(s.value)) AS Status,
		j.Id As Execution_Id,
		j.report_data_id AS Schedule_Id,
		j.started_at
	FROM job_queue j
	LEFT JOIN job_status s ON j.id=s.job_queue_id
	WHERE j.started_at >=? and j.started_at <= ? GROUP BY j.id ORDER BY j.report_data_id, j.id desc) js`
}

func (ss *sqlStore) GetOrgLevelDashboardStatistics(ctx context.Context, fromTime string, toTime string, orgID int64) (usagedata.OrgLevelDashboardStatisticsResponse, error) {
	var result usagedata.OrgLevelDashboardStatisticsResponse
	ss.log.Info("Running SQL query to fetch org level dashboard statistics", "orgID", orgID, "fromTime", fromTime, "toTime", toTime)

	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `
		SELECT
			t4.id as dashboard_id,
			t4.uid dashboard_uid,
			t4.title dashboard_title,
			t4.folder_name,
			COALESCE(t11.avg_load_time, 0) as avg_load_time,
			COALESCE(t5.data_aggregate, 0) as total_views,
			t13.views_in_range as views_in_range,
			t9.collected_time as last_accessed_time
		FROM
			(
				SELECT
					t1.id as d_hit_metric,
					t2.id as d_loadtime_metric,
					COALESCE(t1.dashboard_id, t2.dashboard_id) as dashboard_id,
					COALESCE(t1.tenant_id, t2.tenant_id) as tenant_id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels t1
					FULL OUTER JOIN metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_labels t2 ON t1.dashboard_id = t2.dashboard_id
					AND t1.tenant_id = t2.tenant_id
			) as t3
			RIGHT JOIN (select d1.title ,  d1.id,  d1.uid,  d1.is_folder,  d1.folder_id , d2.title as folder_name,  d1.org_id from dashboard as d1 left join dashboard as d2 on d1.folder_id = d2.id 
where d1.is_folder=false and d1.org_id = ?) as t4
			ON t4.id = t3.dashboard_id
			AND t4.org_id = t3.tenant_id
			-- We have list of all available dashboards with their metric labels at this point. Right joining with dashboards table takes care of deleted dashboards.
			LEFT JOIN metric_schema.grafana_bmc_hdb_api_dashboard_hit_aggregate t5 ON t5.metric_id = t3.d_hit_metric
			-- Have dashboards with their total views now
			LEFT JOIN (
				SELECT DISTINCT
					ON (t6.metric_id) t6.metric_id,
					t6.collected_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t6
				ORDER BY
					t6.metric_id,
					t6.collected_time DESC
			) t9 ON t9.metric_id = t3.d_hit_metric
			-- Have dashboards with their last accessed time and their time filtered views at this point
			---
			LEFT JOIN (
				SELECT 
					t12.metric_id as metric_id,
					sum(t12.data_delta) as views_in_range
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t12
				WHERE t12.collected_time BETWEEN ? AND ?
                GROUP BY t12.metric_id				
				
			) t13 ON t13.metric_id = t3.d_hit_metric
			-- Have dashboards with their last accessed time and their time filtered views at this point
			LEFT JOIN (
				SELECT
					t10.metric_id,
					AVG(t10.data_delta) as avg_load_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_data t10
				WHERE t10.collected_time BETWEEN ? AND ?	
				GROUP BY
					metric_id
			) t11 ON t11.metric_id = t3.d_loadtime_metric
			
			-- Have dashboards with their average load times at this point
			WHERE t4.org_id = ?
			AND t4.is_folder = false
		`

		err := dbSess.SQL(rawSQL, orgID, fromTime, toTime, fromTime, toTime, orgID).Find(&result.Data)
		return err
	})

	ss.log.Info("Ran SQL query to fetch org level dashboard stats", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch org level dashboard statistics", "orgID", orgID)
	}

	if result.Len() == 0 {
		ss.log.Error("No dashboards found with usage data", "orgID", orgID)
	}

	return result, err
}

func (ss *sqlStore) GetIndividualDashboardStatistics(ctx context.Context, dashboardID int64, orgID int64) (usagedata.IndividualDashboardStatisticsResponse, error) {
	var result usagedata.IndividualDashboardStatisticsResponse
	ss.log.Info("Running SQL query to fetch stats", "dashboardID", dashboardID, "orgID", orgID)

	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `
		SELECT
			t4.id as dashboard_id,
			t4.uid dashboard_uid,
			t4.title dashboard_title,
			COALESCE(t11.avg_load_time, 0) as avg_load_time,
			COALESCE(t5.data_aggregate, 0) as total_views,
			t9.collected_time as last_accessed_time
		FROM
			(
				SELECT
					t1.id as d_hit_metric,
					t2.id as d_loadtime_metric,
					COALESCE(t1.dashboard_id, t2.dashboard_id) as dashboard_id,
					COALESCE(t1.tenant_id, t2.tenant_id) as tenant_id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels t1
					FULL OUTER JOIN metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_labels t2 ON t1.dashboard_id = t2.dashboard_id
					AND t1.tenant_id = t2.tenant_id
			) as t3
			RIGHT JOIN dashboard t4
			ON t4.id = t3.dashboard_id
			AND t4.org_id = t3.tenant_id
			-- We have list of all available dashboards with their metric labels at this point. Inner joining with dashboards table takes care of deleted dashboards.
			LEFT JOIN metric_schema.grafana_bmc_hdb_api_dashboard_hit_aggregate t5 ON t5.metric_id = t3.d_hit_metric
			-- Have dashboards with their total views now
			LEFT JOIN (
				SELECT DISTINCT
					ON (t6.metric_id) t6.metric_id,
					t6.collected_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t6
				ORDER BY
					t6.metric_id,
					t6.collected_time DESC
			) t9 ON t9.metric_id = t3.d_hit_metric
			-- Have dashboards with their last accessed time and their time filtered views at this point
			LEFT JOIN (
				SELECT
					t10.metric_id,
					AVG(t10.data_delta) as avg_load_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_data t10
				GROUP BY
					metric_id
			) t11 ON t11.metric_id = t3.d_loadtime_metric
			-- Have dashboards with their average load times at this point
			WHERE t4.id = ?
			AND t4.org_id = ?
			LIMIT 1
		`

		err := dbSess.SQL(rawSQL, dashboardID, orgID).Find(&result.Data)
		return err
	})
	ss.log.Info("Ran query to fetch individual dashboard stats", "dashboardID", dashboardID, "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch stats", "dashboardID", dashboardID, "orgID", orgID)
	}
	if result.Len() == 0 {
		ss.log.Error("no stats found for dashboard", "dashboardID", dashboardID, "orgID", orgID)
	}

	return result, err
}

func (ss *sqlStore) GetDashboardHits(ctx context.Context, fromTime string, toTime string, dashboardID int64, orgID int64) (usagedata.DashboardHitsResponse, error) {
	var result usagedata.DashboardHitsResponse

	ss.log.Info("Running SQL query to fetch hit count", "dashboardID", dashboardID, "orgID", orgID)
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `
		SELECT
			t2.data_delta as hits,
			t2.collected_time as collected_time
		FROM
			metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t2
		WHERE
			t2.metric_id = (
				SELECT
					t1.id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels t1
				WHERE
					t1.dashboard_id = ?
					AND t1.tenant_id = ?
				LIMIT 1
			)
			AND t2.collected_time BETWEEN ? AND ?
			`

		err := dbSess.SQL(rawSQL, dashboardID, orgID, fromTime, toTime).Find(&result.Data)
		return err
	})
	ss.log.Info("Ran query to fetch hit count", "dashboardID", dashboardID, "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch hit count", "dashboardID", dashboardID, "orgID", orgID)
	}
	if result.Len() == 0 {
		ss.log.Error("no dashboard hits found", "dashboardID", dashboardID, "orgID", orgID)
	}

	return result, err
}

func (ss *sqlStore) GetDashboardLoadTimes(ctx context.Context, fromTime string, toTime string, dashboardID int64, orgID int64) (usagedata.DashboardLoadTimesResponse, error) {
	var result usagedata.DashboardLoadTimesResponse
	ss.log.Info("Running SQL query to fetch load time", "dashboardID", dashboardID, "orgID", orgID)

	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `
		SELECT
			t2.data_delta as load_time,
			t2.collected_time as collected_time
		FROM
			metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_data t2
		WHERE
			t2.metric_id = (
				SELECT
					t1.id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_labels t1
				WHERE
					t1.dashboard_id = ?
					AND t1.tenant_id = ?
				LIMIT 1
			)
			AND t2.collected_time BETWEEN ? AND ?
			`

		err := dbSess.SQL(rawSQL, dashboardID, orgID, fromTime, toTime).Find(&result.Data)
		return err
	})
	ss.log.Info("Ran query to fetch load time", "dashboardID", dashboardID, "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch load time", "dashboardID", dashboardID, "orgID", orgID)
	}
	if result.Len() == 0 {
		ss.log.Error("no dashboard load times found", "dashboardID", dashboardID, "orgID", orgID)
	}

	return result, err
}

func (ss *sqlStore) GetDashboardHitsUserInfo(ctx context.Context, fromTime string, toTime string, orgID int64, user string, dashboard string) (usagedata.UsageDataResponse, error) {
	var result usagedata.UsageDataResponse

	ss.log.Info("Running SQL query to fetch dashboard hit user info", "dashboard", dashboard, "orgID", orgID, "user", user)
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		rawSQL := `
		SELECT
			%s,
			a.data_delta,
			a.collected_time,
			%s
			%s
		FROM
			metric_schema.grafana_bmc_hdb_api_dashboard_hit_with_user_info_data a
		JOIN 
			metric_schema.grafana_bmc_hdb_api_dashboard_hit_with_user_info_labels b on a.metric_id = b.id
		LEFT OUTER JOIN 
			public."user" u on b.user_id = u.id
		LEFT OUTER JOIN 
			public."dashboard" d on b.dashboard_id = d.id
		where
			b.tenant_id = ? AND
			%s
			a.collected_time BETWEEN ? AND ?;
		`
		userCondition := "u.id = %s AND"
		dashboardCondition := "d.id = %s AND"

		// by default set to userView hit info
		idQuery := "b.dashboard_id as id"
		nameQuery := "d.title as name"
		condition := ""

		// Extra column for long response type
		extraColumns := ", b.user_id as user_id, u.name as username"

		// user is given preference if both dashboard and user is given
		if user != "" {
			// it brings dashboard details (user specific)
			condition = fmt.Sprintf(userCondition, user)
			extraColumns = ""
		} else if dashboard != "" {
			// if user not given then add dashboard condition
			// it brings user details (dashboard specific)
			idQuery = "b.user_id as id"
			nameQuery = "u.name as name"
			condition = fmt.Sprintf(dashboardCondition, dashboard)
			extraColumns = ""
		}
		rawSQL = fmt.Sprintf(rawSQL, idQuery, nameQuery, extraColumns, condition)

		// Setting up query object
		sqlQueryParameters := [3]any{orgID, fromTime, toTime}
		queryObj := getQueryObject()
		queryObj.sql = rawSQL
		queryObj.parameters = sqlQueryParameters[:]
		queryObj.description = "Dashboard Hit With User Info"
		queryObj.orgId = orgID
		var queryError error
		if extraColumns == "" {
			var response usagedata.DashboardHitCountWithUserInfoShortResponse
			queryError = queryObj.executeQuery(ss, dbSess, &response.Data)
			result = response

		} else {
			var response usagedata.DashboardHitCountWithUserInfoLongResponse
			queryError = queryObj.executeQuery(ss, dbSess, &response.Data)
			result = response
		}
		return queryError
	})
	ss.log.Info("ran query to fetch dashboard hit user info", "dashboard", dashboard, "orgID", orgID, "user", user)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch dashboard hits user info", "dashboard", dashboard, "orgID", orgID, "user", user)
	}
	if result.Len() == 0 {
		ss.log.Error("no dashboard load times found", "dashboard", dashboard, "orgID", orgID, "user", user)
	}

	return result, err

}

func (ss *sqlStore) GetDashboardDetails(ctx context.Context, orgID int64, folder string, title string, status string) (usagedata.DashboardDetailsResponse, error) {
	var response usagedata.DashboardDetailsResponse

	ss.log.Info("Running SQL query to fetch all dashboard details", "orgID", orgID)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := `SELECT a.id as d_id,
						a.title as d_title,
						case when b.title is null then 'Dashboards'
						else b.title end foldername
					FROM   public.dashboard a
					LEFT JOIN   public.dashboard b
					on a.folder_id = b.id
					%s
					WHERE  a.is_folder = 'false' AND
					%s
					%s
					%s
					a.org_id = ?`
		titleCondition := ""
		folderCondition := ""
		activeConditionQuery := ""
		activeCondition := ""
		// preparing folder condition
		if strings.EqualFold(folder, "Dashboards") {
			folderCondition = "b.title is null AND"
		} else if folder != "" {
			if strings.Contains(folder, "-1") {
				folderCondition = ""
			} else {
				// Remove curly braces only if both first and last exist
				if len(folder) >= 2 && folder[0] == '{' && folder[len(folder)-1] == '}' {
					folder = folder[1 : len(folder)-1]
				}
				folders := strings.Split(folder, ",")
				for i, f := range folders {
					f = strings.TrimSpace(f)
					// Escape single quotes by doubling them for SQL
					f = strings.ReplaceAll(f, "'", "''")
					folders[i] = fmt.Sprintf("'%s'", f)
				}
				folderCondition = fmt.Sprintf("b.title in (%s) AND", strings.Join(folders, ","))
			}
		}
		// preparing title condition
		if title != "" {
			titleCondition = fmt.Sprintf("a.title = '%s' AND", title)
		}

		if strings.EqualFold(status, "active") {
			activeConditionQuery = `LEFT JOIN 
					(SELECT
						id as metric_id,
						dashboard_id
					FROM
						metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels) t1
					on t1.dashboard_id = a.id
					LEFT JOIN (
						SELECT DISTINCT
							ON (t2.metric_id) t2.metric_id,
							t2.collected_time
						FROM
							metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t2
						ORDER BY
							t2.metric_id,
							t2.collected_time DESC
					) t3 ON t3.metric_id = t1.metric_id`
			activeCondition = "t3.collected_time >= NOW() - INTERVAL '30 days' AND"
		}
		rawSQL = fmt.Sprintf(rawSQL, activeConditionQuery, folderCondition, titleCondition, activeCondition)
		err := sess.SQL(rawSQL, orgID).Find(&response.Data)
		return err
	})
	ss.log.Info("Ran SQL query to fetch all dashboard details", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to fetch dashboard details")
	}
	if response.Len() == 0 {
		ss.log.Warn("No dashboards exist", "orgID", orgID)
	}

	return response, err
}

func (ss *sqlStore) GetActiveDashboardsCount(ctx context.Context, orgID int64) (usagedata.ActiveDashboardsCountResponse, error) {
	var response usagedata.ActiveDashboardsCountResponse

	ss.log.Info("Running SQL query to fetch active dashbaords count", "orgID", orgID)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := `select count (dashboard_id) as act_dash_count from metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels
		           where tenant_id = ?`
		err := sess.SQL(rawSQL, orgID).Find(&response.Data)
		return err
	})
	ss.log.Info("Ran SQL query to fetch active dashbaords", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to active dashbaords count", "orgID", orgID)
	}

	return response, err
}

func (ss *sqlStore) GetSchedulerStaging(ctx context.Context, orgID int64, scheduleName string, fromTime string, toTime string, isDev bool) (usagedata.ScheduleStagingResponse, error) {
	var result usagedata.ScheduleStagingResponse
	var stagingColumnsSelect string

	ss.log.Info("Running SQL query to fetch report scheduler staging info", "isDev", isDev, "orgID", orgID, "scheduleName", scheduleName)
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		if scheduleName == "" {
			stagingColumnsSelect = "DISTINCT ON (j.report_data_id) "
		}
		stagingColumnsSelect = stagingColumnsSelect +
			` COALESCE(j.description, s.description) AS Description,
			  	j.Started_At,
			  	r.id as Report_ID,
				r.name AS Schedule_Name,
				u.login AS Creator,
				d.title AS Dashboard_Name,
				d.uid AS Dashboard_Uid,
				r.report_type AS Report_Type,
				r.schedule_type AS Schedule_Type`

		subQueryJobStatus := getDescriptionJobStatus()

		if isDev {
			stagingColumnsSelect = stagingColumnsSelect + ",j.err_log AS Errors"
		}

		query := dbSess.Table("job_queue").Alias("j").
			Select(stagingColumnsSelect).
			Join("LEFT", "report_data r", "r.id = j.report_data_id").
			Join("LEFT", "\"user\" u", "u.id = r.user_id").
			Join("LEFT", "dashboard d", "d.id = r.dashboard_id").
			Join("LEFT", subQueryJobStatus, "s.job_queue_id = j.id").
			Where("j.started_at >= ?", fromTime).
			And("j.started_at <= ?", toTime).
			And("r.org_id = ?", orgID).
			And("r.name ILIKE ?", "%"+scheduleName+"%").
			OrderBy(`j.report_data_id,j.id DESC`).
			Limit(500)

		err := query.Find(&result.Data)
		return err
	})
	ss.log.Info("ran SQL query to fetch scheduler info", "isDev", isDev, "orgID", orgID, "scheduleName", scheduleName)

	if err != nil {
		ss.log.Error("Error while Running SQL query to fetch report scheduler staging info", "isDev", isDev, "orgID", orgID, "scheduleName", scheduleName)
	}

	if result.Len() == 0 {
		ss.log.Info("No scheduled staging found, returning empty response", "isDev", isDev, "orgID", orgID, "scheduleName", scheduleName)
		result = usagedata.ScheduleStagingResponse{
			Data: make([]usagedata.ScheduleStaging, 0),
		}
	}
	return result, err
}

func getDescriptionJobStatus() string {
	return `(
	SELECT job_queue_id, min(value) as value, max(description) as description
	FROM job_status
	GROUP BY job_queue_id) s`
}

func (ss *sqlStore) GetNextSchedules(ctx context.Context, orgID int64) (usagedata.ScheduleShortInfoResponse, error) {
	var result usagedata.ScheduleShortInfoResponse

	ss.log.Info("Running SQL query to fetch reports info for last 24 hours", orgID, "orgID")
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		nextScheduleColumns := `r.id AS Report_Id, 
		r.enabled AS Is_Active, 
		r.name AS Schedule_Name, 
		r.recipients, 
		r.report_type AS Report_Type, 
		r.schedule_type AS Schedule_Type, 
		u.login AS Creator,
		d.title AS Dashboard_Name, 
		d.uid AS Dashboard_Uid, 
		r.created_at AS Created, 
		r.updated_at AS Last_Updated`

		err := dbSess.Table("report_data").Alias("r").
			Select(nextScheduleColumns).
			Join("LEFT", "\"user\" u", "u.id = r.user_id").
			Join("LEFT", "dashboard d", "d.id = r.dashboard_id").
			Where("to_timestamp(r.next_at) BETWEEN NOW() AND NOW() + INTERVAL '24 hours'").
			And("r.org_id = ?", orgID).
			OrderBy("r.id ASC").
			Find(&result.Data)
		return err
	})
	ss.log.Info("ran SQL query to fetch scheduler info for next 24 hours", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error fetching scheduled reports for next 24 hours", err)
	}

	return result, err
}

func (ss *sqlStore) GetDataVolume(ctx context.Context, orgID int64, datasourceID int64, fromTime string, toTime string) (usagedata.DataVolumeResponse, error) {
	var response usagedata.DataVolumeResponse

	ss.log.Info("Running SQL query to fetch data volume", "orgID", orgID)

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		q := sess.Table("metric_schema.grafana_bmc_hdb_api_dataproxy_response_data_size_labels").Alias("m").
			Join("INNER",
				"metric_schema.grafana_bmc_hdb_api_dataproxy_response_data_size_data d",
				"d.metric_id = m.id",
			).
			Join("LEFT",
				"data_source ds",
				"ds.id = m.data_source_id",
			).
			Join("LEFT",
				"dashboard dsh",
				"dsh.uid = m.dashboard_uid",
			).
			Join("LEFT",
				`"user" usr`,
				"usr.id = m.user_id",
			).
			Select(`
			m.data_source_id AS datasource_id,
			d.metric_id,
			d.data_delta,
			m.dashboard_uid,
			m.user_id,
			ds.name AS datasource_name,
			ds.type AS datasource_type,
			COALESCE(dsh.title, 'Deleted Dashboard') AS dashboard_name,
			COALESCE(usr.name, 'Deleted User') AS user_name,
			COALESCE(usr.email, 'Deleted User') AS user_email,
			d.collected_time
		`).
			Where("m.tenant_id = ?", orgID).
			And("d.collected_time BETWEEN ? AND ?", fromTime, toTime).
			OrderBy("d.collected_time DESC")

		if datasourceID > 0 {
			q = q.And("m.data_source_id = ?", datasourceID)
		}

		return q.Find(&response.Data)
	})
	ss.log.Info("Ran SQL query to fetch data volume", "orgID", orgID)

	if err != nil {
		ss.log.Error("Error while running SQL query to data volume", "orgID", orgID)
	}

	return response, err
}

func (ss *sqlStore) GetIFValueRealization(ctx context.Context, orgID int64, userID int64, fromTime string, toTime string) (usagedata.IFValueRealizationResponse, error) {
    var response usagedata.IFValueRealizationResponse
 
    ss.log.Info("Running SQL query to fetch data volume", "orgID", orgID)
 
    err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
        q := sess.Table("metric_schema.grafana_bmc_hdb_api_insightfinder_value_realization_labels").Alias("m").
            Join("INNER",
                "metric_schema.grafana_bmc_hdb_api_insightfinder_value_realization_data d",
                "d.metric_id = m.id",
            ).
            Join("LEFT",
                `"user" usr`,
                "usr.id = m.user_id",
            ).
			Join("LEFT",
				"data_source ds",
				"ds.uid = m.datasource_id",
			).
            Select(`
            m.datasource_id,
			ds.name AS datasource_name,
            d.metric_id,
            d.prompt_count_delta,
            d.conversation_count_delta,
            d.panels_generated_count_delta,
            d.prompt_count_raw,
            d.conversation_count_raw,
            d.panels_generated_count_raw,
            d.response_time_ms_delta,
            m.user_id,
            m.agent_id,
            COALESCE(usr.name, 'User not found') AS user_name,
            COALESCE(usr.email, 'User not found') AS user_email,
			COALESCE(usr.login, 'User not found') AS user_login,
            d.collected_time
        `).
            Where("m.tenant_id = ?", orgID).
            And("d.collected_time BETWEEN ? AND ?", fromTime, toTime)
        if userID > 0 {
            q = q.And("m.user_id = ?", userID)
        }
        q = q.OrderBy("d.collected_time DESC")
 
        return q.Find(&response.Data)
    })
 
    if err != nil {
        ss.log.Error("Error while running SQL query to fetch insight finder metric data orgID= ", orgID)
    } else{
		ss.log.Info("Ran SQL query to fetch insight finder metric data orgID=", orgID)
	}
 
    return response, err
}
 
func (ss *sqlStore) GetIFDashboardCount(
    ctx context.Context,
    orgID int64,
    userID int64,
    fromTime string,
    toTime string,
) (usagedata.IFDashboardCountResponse, error) {
 
    var response usagedata.IFDashboardCountResponse

    // Optional user filter
    userFilter := ""
    var args []interface{}

    if userID > 0 {
        userFilter = "AND au.id = ?"
        args = append(args, userID)
    }

    rawSQL := `
			WITH all_users AS (
				SELECT u.id, u.login
				FROM public."user" u
				WHERE u.org_id = ?

				UNION

				SELECT DISTINCT d.created_by AS id, 'User Not Found' AS login
				FROM public.dashboard d
				WHERE d.org_id = ?
				AND d.is_folder = false
				AND NOT EXISTS (
					SELECT 1 FROM public."user" WHERE id = d.created_by
				)
			),
			user_roles AS (
				SELECT user_id, MIN(bhd_role_id) AS role_id
				FROM (
					SELECT ubr.user_id, ubr.bhd_role_id
					FROM user_bhd_role ubr
					WHERE ubr.bhd_role_id IN (1,2,3) AND ubr.org_id = ?

					UNION ALL

					SELECT tm.user_id, tbr.bhd_role_id
					FROM team_member tm
					JOIN team_bhd_role tbr ON tbr.team_id = tm.team_id
					WHERE tbr.bhd_role_id IN (1,2,3) AND tbr.org_id = ?
				) role_sources
				GROUP BY user_id
			)
			SELECT
				au.id AS user_id,
				au.login AS user_login,
				COALESCE(ur.role_id, 3) AS role_id,
				d.created::date AS created_date,
				d.title,
				d.created AS created_at,
				SUM(CASE WHEN dt.dashboard_id IS NOT NULL THEN 1 ELSE 0 END) AS if_dashboards,
				SUM(CASE WHEN d.id IS NOT NULL AND dt.dashboard_id IS NULL THEN 1 ELSE 0 END) AS nonif_dashboards
			FROM all_users au
			LEFT JOIN public.dashboard d
				ON d.created_by = au.id
				AND d.org_id = ?
				AND d.is_folder = false
				AND d.created BETWEEN ? AND ?
			LEFT JOIN public.dashboard_tag dt
				ON dt.dashboard_id = d.id AND dt.term = 'Insight Finder'
			LEFT JOIN user_roles ur
				ON ur.user_id = au.id
			WHERE 1=1
			` + userFilter + `
			GROUP BY
				au.id,
				au.login,
				COALESCE(ur.role_id, 3),
				d.created::date,
				d.title,
				d.created
			ORDER BY au.id, d.created
			`

    // Base args in order of placeholders
    finalArgs := []interface{}{
        orgID, 
        orgID, 
        orgID, 
        orgID, 
        orgID,
        fromTime,
        toTime,
    }

    // Append optional userID if present
    finalArgs = append(finalArgs, args...)

    err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
        return sess.SQL(rawSQL, finalArgs...).Find(&response.Data)
    })

    if err != nil {
        ss.log.Error("Error while running SQL query to fetch insight finder data orgID=", orgID, " err=", err)
    } else {
        ss.log.Info("Ran SQL query to fetch insight finder data orgID=", orgID)
    }

    return response, err
}
