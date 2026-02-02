// variable_dashboard.go
package bmc

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.bmc.com/DSOM-ADE/authz-go"
	model "github.com/grafana/grafana/pkg/api/bmc/bhd_external"
	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/bhd_role"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	dbstore "github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
)

func (p *PluginsAPI) getAllDashboards(c *contextmodel.ReqContext) response.Response {
	model.Log.Info("From get all Dashboards", "info")

	usrObj, resp := authorizeUser(c)
	if resp != nil {
		return resp
	}

	userId, _ := strconv.ParseInt(usrObj.UserID, 10, 64)
	orgId, _ := strconv.ParseInt(usrObj.Tenant_Id, 10, 64)
	if !ContainsLower(usrObj.Permissions, "*") {
		allowed, err := p.service.HasRequiredPermissions(c.Req.Context(), orgId, userId, "Editor", []string{})
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Error checking permissions", err)
		}
		if !allowed {
			model.Log.Error("User doesn't have required permissions", "error")
			return response.Error(http.StatusUnauthorized, "User doesn't have enough permissions.", nil)
		}
	}
	model.Log.Debug("User with tenantID " + usrObj.Tenant_Id + " is authenticated and authorized!!!")

	// Fetch user assigned role name
	assignedRole, err := getRoleNameByUserID(c.Req.Context(), p, userId)
	if err != nil {
		model.Log.Error("Error fetching roles from the database.", "UserId", userId, "Error", err)
		return response.Error(http.StatusInternalServerError, "Failed to retrieve roles.", err)
	}

	if len(assignedRole) == 0 {
		model.Log.Warn("No roles found for the user.", "UserId", userId)
		return response.Error(http.StatusForbidden, "No roles assigned to the user.", nil)
	}

	var request model.DashboardBodyParams
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		model.Log.Error("TenantId: "+usrObj.Tenant_Id+"Error reading request body:", err)
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	err = json.Unmarshal(body, &request)
	if err != nil {
		model.Log.Error("TenantId: "+usrObj.Tenant_Id+" Error parsing JSON body", "error", err)
		return response.Error(http.StatusBadRequest, "Invalid JSON format", err)
	}

	model.Log.Info("TenantId: "+usrObj.Tenant_Id+" Fetching dashboard details",
		"info", map[string]interface{}{
			"FolderName": request.FolderName,
			"Tags":       request.Tags,
		},
	)

	// Build SQL query based on role
	var sqlBuilder strings.Builder
	var params []interface{}

	switch assignedRole {
	case org.RoleAdmin:
		if err := buildAdminDashboardQuery(&sqlBuilder, &params, orgId, request); err != nil {
			model.Log.Error("Error building query for admin role", "error", err)
			return response.Error(http.StatusInternalServerError, "Error building dashboard query for admin", err)
		}
	case org.RoleEditor, org.RoleViewer:
		if err := p.buildEditorViewerDashboardQuery(c.Req.Context(), &sqlBuilder, &params, orgId, userId, assignedRole, request); err != nil {
			model.Log.Error("Error building query for editor/viewer role", "error", err)
			return response.Error(http.StatusInternalServerError, "Error building dashboard query", err)
		}
	default:
		return response.Error(http.StatusForbidden, "Role not allowed to fetch dashboards.", nil)
	}
	// model.Log.Info("Final SQL Queryyyyyyy", "query", sqlBuilder.String(), "params", params)

	var dashboards []model.Dashboard
	err = p.store.WithDbSession(c.Req.Context(), func(sess *dbstore.DBSession) error {
		return sess.SQL(sqlBuilder.String(), params...).Find(&dashboards)
	})

	if err != nil {
		model.Log.Debug("TenantId: "+usrObj.Tenant_Id+" Error occured while querying datatbase ", "debug")
		return response.Error(http.StatusInternalServerError, "Internal Server Error", err)
	}

	model.Log.Info("Number of dashboards retrieved:", "info", len(dashboards))

	responseData := map[string]interface{}{
		"statusCode":    200,
		"statusMessage": "Success",
		"response": map[string]interface{}{
			"dashboardList": dashboards,
		},
	}
	model.Log.Info("TenantId: " + usrObj.Tenant_Id + " About to return success response for getalldashboards")
	return response.JSON(http.StatusOK, responseData)
}

func (p *PluginsAPI) getVariablesMetadata(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	model.Log.Info("From get dashboards metadata", "info")

	usrObj, resp := authorizeUser(c)
	if resp != nil {
		return resp
	}
	userId, _ := strconv.ParseInt(usrObj.UserID, 10, 64)
	orgId, _ := strconv.ParseInt(usrObj.Tenant_Id, 10, 64)
	if !ContainsLower(usrObj.Permissions, "*") {
		allowed, err := p.service.HasRequiredPermissions(c.Req.Context(), orgId, userId, "Editor", []string{})
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Error checking permissions", err)
		}
		if !allowed {
			model.Log.Error("User doesn't have required permissions", "error")
			return response.Error(http.StatusUnauthorized, "User doesn't have enough permissions.", nil)
		}
	}

	model.Log.Debug("User with tenantID " + usrObj.Tenant_Id + " is authenticated and authorized!!!")

	model.Log.Info("Fetching variables for dashboard with ",
		"info", map[string]interface{}{
			"TenantID": orgId,
			"uid":      uid,
		},
	)

	sqlBuilder := strings.Builder{}
	sqlBuilder.WriteString(`
	SELECT
	dashboard.uid,
	dashboard.title,
	dashboard.data
	FROM
	dashboard
	LEFT OUTER JOIN
	dashboard AS folder ON folder.id = dashboard.folder_id
		WHERE
	NOT dashboard.is_folder
	AND dashboard.is_folder = false
	`)
	paramsList := make([]interface{}, 0)
	if uid != "" {
		sqlBuilder.WriteString(" AND dashboard.uid = ?")
		paramsList = append(paramsList, uid)
	}
	if orgId != 0 {
		sqlBuilder.WriteString(" AND dashboard.org_id = ?")
		paramsList = append(paramsList, orgId)
	}

	var dashboard model.DashboardById
	var responseErr *response.NormalResponse
	var err error
	err = p.store.WithDbSession(c.Req.Context(), func(sess *dbstore.DBSession) error {
		isRecordFound, sqlErr := sess.SQL(sqlBuilder.String(), paramsList...).Get(&dashboard)

		if sqlErr != nil {
			model.Log.Debug("TenantId: "+usrObj.Tenant_Id+" Error occured while querying datatbase ", "debug")
			responseErr = response.Error(http.StatusInternalServerError, "Internal Server Error", sqlErr)
			return sqlErr
		} else if !isRecordFound {
			responseErr = response.Error(http.StatusNotFound, "Record not found", nil)
			return nil
		}

		return nil
	})

	if responseErr != nil {
		return responseErr
	}

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Internal Server Error", err)
	}
	// Continue with the rest of the code, assuming the record was found
	templatingArray, err := getTemplatingArray(&dashboard)

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Internal Server Error", err)
	}
	title, err := getTitle(&dashboard)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Internal Server Error", err)
	}

	var variables []model.Variable
	variableCount := 0
	for _, item := range templatingArray {
		metadata := processTemplatingItem(item)

		variables = append(variables, metadata)
		variableCount++
	}

	variableData := model.DashboardbyId{
		Title:         title,
		UID:           uid,
		VariableList:  variables,
		VariableCount: variableCount,
	}

	responseData := model.Result{
		StatusCode:    200,
		StatusMessage: "Success",
		Response:      variableData,
	}
	// Log the number of dashboards retrieved
	model.Log.Debug("Number of variables retrieved:", "info", len(variables))

	model.Log.Info("TenantId: " + usrObj.Tenant_Id + " About to return success response for getalldashboards")
	return response.JSON(http.StatusOK, responseData)
}

func getTemplatingArray(dash *model.DashboardById) ([]interface{}, error) {
	return dash.Data.Get("templating").Get("list").Array()
}

func getTitle(dash *model.DashboardById) (string, error) {
	return dash.Data.Get("title").String()
}

func getDataSource(itemMap map[string]interface{}) string {
	if datasource, ok := itemMap["datasource"].(map[string]interface{}); ok {
		// "datasource" key exists, now check for "type"
		if typeValue, ok := datasource["type"].(string); ok {
			return typeValue
		}
	}

	if datasource, ok := itemMap["datasource"].(string); ok {
		return datasource
	}
	return ""
}

func processTemplatingItem(item interface{}) model.Variable {

	itemMap := item.(map[string]interface{})
	metadata := model.Variable{}
	var dataSourceType string

	variableType, ok := itemMap["type"].(string)
	if !ok || variableType == "" {
		model.Log.Error("Missing or empty 'type' field", "error")
	} else {
		metadata.Type = variableType
	}

	includeAll, ok := itemMap["includeAll"].(bool)
	if !ok {
		model.Log.Error("Missing or invalid 'includeAll' field", "error")
	} else {
		metadata.IncludeAll = includeAll
	}

	multi, ok := itemMap["multi"].(bool)
	if !ok {
		model.Log.Error("Missing or invalid 'multi' field", "error")
	} else {
		metadata.Multi = multi
	}

	var sqlQuery, queryField, queryType, queryStr string
	switch variableType {
	case "query":
		dataSourceType = getDataSource(itemMap)
		metadata.Datasource = dataSourceType
		if dataSourceType == "bmchelix-ade-datasource" {
			queryField, ok = itemMap["query"].(string)
			if ok && queryField != "" {
				// Split the query string into parts
				parts := strings.SplitN(queryField, ",", 2)
				if len(parts) == 2 {
					queryType, queryStr = parts[0], parts[1]
					metadata.QueryType = queryType
					metadata.StatusCode = 200
					sqlQuery = queryStr
				} else {
					model.Log.Error("Invalid or unknown 'query' provided", "error")
					// queryType = "default"
					metadata.QueryType = ""
					metadata.StatusCode = 206
					sqlQuery = queryStr
				}
			} else {
				model.Log.Error("Empty 'query' provided", "error")
				// queryType = "default"
				metadata.QueryType = ""
				metadata.StatusCode = 206
			}

			// switch queryType {
			// case "remedy":
			// 	var queryContent map[string]string
			// 	queryStr = strings.ReplaceAll(queryStr, "\\", "")
			// 	if err := json.Unmarshal([]byte(queryStr), &queryContent); err != nil {
			// 		sqlQuery = queryField
			// 	}
			// 	sqlQuery = queryContent["sql"]
			// case "event":
			// 	sqlQuery = queryStr
			// case "metric":
			// 	sqlQuery = queryStr
			// case "optimize":
			// 	sqlQuery = queryStr

			// default:
			// 	model.Log.Error("Unknown query type", "error")
			// 	sqlQuery = queryField
			// 	metadata.StatusCode = 206
			// }
		} else if dataSourceType == "json-datasource" {
			// Code for handling BMC helix API json
			metadata.QueryType = "API-JSON"
			queryField, ok := itemMap["query"].(map[string]interface{})
			if !ok || queryField == nil {
				// Handle missing or empty 'query' field
				model.Log.Error("Missing or empty 'type' field", "error")
				sqlQuery = ""
				metadata.StatusCode = 206
			} else {
				//converting the map to JSON string
				jsonQuery, err := json.Marshal(queryField)
				if err != nil {
					model.Log.Error("Error converting map query to JSON", "error", err)
				} else {
					sqlQuery = string(jsonQuery)
					metadata.StatusCode = 200
				}
			}
		} else {
			model.Log.Error("Datasource is invalid, empty or not supported", "error")
		}
	case "optimizepicker":
		queryField, ok := itemMap["query"].([]string)
		if ok && len(queryField) > 0 {
			queryStr := strings.Join(queryField, ",")
			sqlQuery = queryStr
		} else {
			sqlQuery = ""
		}
		metadata.Datasource = "DomainPicker"
		metadata.QueryType = "DomainPicker"
		metadata.StatusCode = 200
	default:
		// Code for the invalid case
		model.Log.Error("Variable type: ", variableType, "not supported", "error")
	}

	if name, ok := itemMap["name"].(string); ok {
		metadata.Name = name
	}

	if label, ok := itemMap["label"].(string); ok {
		metadata.Label = label
	}
	metadata.Query = sqlQuery

	return metadata
}

func authorizeUser(c *contextmodel.ReqContext) (*authz.UserInfo, response.Response) {
	// Retrieve the IMS-JWT token from the request header
	imsJWTToken := c.Req.Header.Get("IMS-JWT")
	if imsJWTToken == "" {
		model.Log.Error("Missing or Empty Authorization Header", "error")
		return nil, response.Error(http.StatusUnauthorized, "Missing or Empty Authorization Header", nil)
	}

	permissions := []string{"*", "reporting.dashboards_permissions.viewer"}

	// Check for permissions
	allowed, err := authz.AuthorizePermissions(imsJWTToken, permissions, "")
	if err != nil {
		model.Log.Error("IMS_JWT is invalid", "error")
		return nil, response.Error(http.StatusUnauthorized, "IMS_JWT is invalid", err)
	}
	if !allowed {
		model.Log.Error("User doesn't have required permissions", "error")
		return nil, response.Error(http.StatusUnauthorized, "User doesn't have enough permissions", nil)
	}

	// Fetch the user object
	usrObj, err := authz.Authorize(imsJWTToken)
	if err != nil {
		model.Log.Error("IMS_JWT is invalid or incorrect", "error")
		return nil, response.Error(http.StatusUnauthorized, "IMS_JWT is invalid or incorrect", err)
	}

	return usrObj, nil
}

func (p *PluginsAPI) FetchTeamIDsByUserID(ctx context.Context, userID int64) ([]int64, error) {
	teamIDs := []int64{}

	query := `SELECT team_id FROM public.team_member WHERE user_id = ?`
	params := []interface{}{userID}

	err := p.store.WithDbSession(ctx, func(sess *dbstore.DBSession) error {
		result, err := sess.SQL(query, params...).Query()
		if err != nil {
			return fmt.Errorf("failed to execute query to fetch team id: %w", err)
		}

		for _, row := range result {
			if teamID, ok := row["team_id"]; ok {
				teamIDInt, err := strconv.ParseInt(string(teamID), 10, 64)
				if err != nil {
					return fmt.Errorf("failed to parse team_id: %w", err)
				}
				teamIDs = append(teamIDs, teamIDInt)
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return teamIDs, nil
}

func getRoleNameByUserID(ctx context.Context, p *PluginsAPI, userID int64) (org.RoleType, error) {
	roles, err := bhd_role.GetBHDRoleIdByUserId(ctx, p.store.WithDbSession, userID)
	if err != nil {
		model.Log.Error("Error fetching roles from the database.", "UserId", userID, "Error", err)
		return "", fmt.Errorf("failed to retrieve roles for user ID %d: %w", userID, err)
	}

	var assignedRole org.RoleType
	switch {
	case ContainsInt(roles, 1):
		assignedRole = org.RoleAdmin
	case ContainsInt(roles, 2):
		assignedRole = org.RoleEditor
	default:
		assignedRole = org.RoleViewer
	}

	model.Log.Info("User role assigned successfully.", "UserId", userID, "Role", assignedRole)

	return assignedRole, nil
}

func buildAdminDashboardQuery(sqlBuilder *strings.Builder, params *[]interface{}, orgID int64, request model.DashboardBodyParams) error {
	sqlBuilder.WriteString(`
		SELECT
			dashboard.uid,
			dashboard.title,
			dashboard.data::json->>'tags' AS tags,
			dashboard.folder_id,
			folder.title AS folder_title,
			dashboard.created,
			dashboard.updated,
			dashboard.created_by,
			dashboard.updated_by
		FROM (
			SELECT dashboard.id
			FROM dashboard
			WHERE NOT dashboard.is_folder
				AND dashboard.org_id = ?
	`)
	*params = append(*params, orgID)

	// Add Tags filter if provided
	if len(request.Tags) > 0 {
		if err := buildTagConditions(request.Tags, sqlBuilder, params); err != nil {
			return err
		}
	}

	sqlBuilder.WriteString(`
		ORDER BY dashboard.title ASC NULLS FIRST
	) AS ids
	INNER JOIN dashboard ON ids.id = dashboard.id
	LEFT OUTER JOIN dashboard AS folder ON folder.id = dashboard.folder_id
	`)

	if request.FolderName != "" {
		sqlBuilder.WriteString(`WHERE folder.title COLLATE "C" ILIKE ? `)
		*params = append(*params, "%"+request.FolderName+"%")
	}

	sqlBuilder.WriteString(`
	ORDER BY dashboard.title ASC;
	`)

	model.Log.Info("Admin SQL Query", "query", sqlBuilder.String(), "params", *params)
	return nil
}

func (p *PluginsAPI) buildEditorViewerDashboardQuery(ctx context.Context, sqlBuilder *strings.Builder, params *[]interface{}, orgID int64, userID int64, assignedRole org.RoleType, request model.DashboardBodyParams) error {
	// Fetch the team IDs for the user
	teamIDs, err := p.FetchTeamIDsByUserID(ctx, userID)
	if err != nil {
		model.Log.Error("Error occurred while fetching team_ids", "error", err)
		return fmt.Errorf("Failed to fetch team IDs: %w", err)
	}

	// Handle empty teamIDs with NULL
	teamCondition := "NULL"
	if len(teamIDs) > 0 {
		teamPlaceholders := make([]string, len(teamIDs))
		for i := range teamIDs {
			teamPlaceholders[i] = "?"
		}
		teamCondition = strings.Join(teamPlaceholders, ",")
	}

	sqlBuilder.WriteString(`
		SELECT
			dashboard.uid,
			dashboard.title,
			dashboard.data::json->>'tags' AS tags,
			dashboard.folder_id,
			folder.title AS folder_title,
			dashboard.created,
			dashboard.updated,
			dashboard.created_by,
			dashboard.updated_by
		FROM (
			SELECT dashboard.id
			FROM dashboard
			WHERE (
				(
					dashboard.uid IN (
						SELECT substr(scope, 16)
						FROM permission
						WHERE scope LIKE 'dashboards:uid:%'
							AND role_id IN (
								SELECT id
								FROM role
								INNER JOIN (
									SELECT ur.role_id
									FROM user_role AS ur
									WHERE ur.user_id = ?
										AND (ur.org_id = ? OR ur.org_id = 0)
									UNION
									SELECT tr.role_id
									FROM team_role AS tr
									WHERE tr.team_id IN (` + teamCondition + `)  -- Dynamically inserted
										AND tr.org_id = ?
									UNION
									SELECT br.role_id
									FROM builtin_role AS br
									WHERE br.role IN(?)
										AND (br.org_id = ? OR br.org_id = 0)
								) AS all_role ON role.id = all_role.role_id
							)
							AND action = 'dashboards:read'
					)
					AND NOT dashboard.is_folder
				)
				OR (
					dashboard.folder_id IN (
						SELECT d.id
						FROM dashboard AS d
						WHERE d.org_id = ?
							AND d.uid IN (
								SELECT substr(scope, 13)
								FROM permission
								WHERE scope LIKE 'folders:uid:%'
									AND role_id IN (
										SELECT id
										FROM role
										INNER JOIN (
											SELECT ur.role_id
											FROM user_role AS ur
											WHERE ur.user_id = ?
												AND (ur.org_id = ? OR ur.org_id = 0)
											UNION
											SELECT tr.role_id
											FROM team_role AS tr
											WHERE tr.team_id IN (` + teamCondition + `)  -- Dynamically inserted
												AND tr.org_id = ?
											UNION
											SELECT br.role_id
											FROM builtin_role AS br
											WHERE br.role IN(?)
												AND (br.org_id = ? OR br.org_id = 0)
										) AS all_role ON role.id = all_role.role_id
									)
									AND action = 'dashboards:read'
							)
					)
					AND NOT dashboard.is_folder
				)
			)
			AND dashboard.org_id = ?
			AND dashboard.is_folder = false
	`)

	// Append team and other params
	*params = append(*params, userID, orgID)
	for _, teamID := range teamIDs {
		*params = append(*params, teamID)
	}
	*params = append(*params, orgID)
	*params = append(*params, assignedRole)
	*params = append(*params, orgID)
	*params = append(*params, orgID)
	*params = append(*params, userID)
	*params = append(*params, orgID)
	for _, teamID := range teamIDs {
		*params = append(*params, teamID)
	}
	*params = append(*params, orgID)
	*params = append(*params, assignedRole)
	*params = append(*params, orgID)
	*params = append(*params, orgID)

	// Add Tags filter if provided
	if len(request.Tags) > 0 {
		if err := buildTagConditions(request.Tags, sqlBuilder, params); err != nil {
			return err
		}
	}

	sqlBuilder.WriteString(`
		) AS ids
		INNER JOIN dashboard ON ids.id = dashboard.id
		LEFT OUTER JOIN dashboard AS folder ON folder.id = dashboard.folder_id
	`)
	//Add folder names if provided
	if request.FolderName != "" {
		sqlBuilder.WriteString(" WHERE folder.title COLLATE \"C\" ILIKE ?")
		*params = append(*params, "%"+request.FolderName+"%")
	}

	sqlBuilder.WriteString(`
		ORDER BY dashboard.title ASC;
	`)

	return nil
}

func buildTagConditions(tags []string, sqlBuilder *strings.Builder, params *[]interface{}) error {
	tagConditions := []string{}
	for _, tag := range tags {
		escapedTag, err := json.Marshal([]string{tag})
		if err != nil {
			model.Log.Error("Error marshalling tag to JSON", "error", err)
			return fmt.Errorf("Error processing tags: %w", err)
		}
		tagConditions = append(tagConditions, "dashboard.data::jsonb->'tags' @> ?::jsonb")
		*params = append(*params, string(escapedTag))
	}
	if len(tagConditions) > 0 {
		sqlBuilder.WriteString(" AND (" + strings.Join(tagConditions, " OR ") + ")")
	}
	return nil
}
