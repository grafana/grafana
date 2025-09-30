package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/db"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/web"
)

type PopularResource struct {
	UID          string    `json:"uid"`
	Title        string    `json:"title"`
	URL          string    `json:"url"`
	ResourceType string    `json:"resourceType"`
	VisitCount   int       `json:"visitCount"`
	LastVisited  time.Time `json:"lastVisited"`
	FirstVisited time.Time `json:"firstVisited"`
}

type PopularResourcesResponse struct {
	Resources  []PopularResource `json:"resources"`
	TotalCount int               `json:"totalCount"`
}

// GetPopularResourcesSimple returns most visited resources for the current user
// Note: This queries the legacy dashboard table. For unified storage dashboards,
// titles may need to be fetched via the dashboard service API.
func (hs *HTTPServer) GetPopularResourcesSimple(c *contextmodel.ReqContext) response.Response {
	// Parse query parameters
	limitStr := c.Query("limit")
	limit := 10
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	period := c.Query("period")
	if period == "" {
		period = "30d"
	}

	resourceType := c.Query("type")

	// Validate period
	validPeriods := map[string]bool{"7d": true, "30d": true, "90d": true, "all": true}
	if !validPeriods[period] {
		return response.Error(http.StatusBadRequest, "Invalid period. Valid values: 7d, 30d, 90d, all", nil)
	}

	// Validate resource type
	if resourceType != "" {
		validTypes := map[string]bool{"dashboard": true, "folder": true, "alert": true}
		if !validTypes[resourceType] {
			return response.Error(http.StatusBadRequest, "Invalid resource type. Valid values: dashboard, folder, alert", nil)
		}
	}

	var resources []PopularResource

	err := hs.SQLStore.WithDbSession(c.Req.Context(), func(sess *db.Session) error {
		sql := `
			SELECT 
				urs.resource_uid as uid,
				CASE 
					WHEN urs.resource_type IN ('dashboard', 'folder') AND d.title IS NOT NULL 
					THEN d.title 
					ELSE urs.resource_uid 
				END as title,
				urs.resource_type,
				urs.visit_count,
				urs.last_visited,
				urs.first_visited
			FROM user_resources_visit_stats urs
			LEFT JOIN dashboard d ON d.uid = urs.resource_uid AND d.org_id = urs.org_id 
				AND urs.resource_type IN ('dashboard', 'folder')
				AND (d.deleted IS NULL OR d.deleted = '')
			WHERE urs.user_id = ? AND urs.org_id = ?
		`

		params := []interface{}{c.UserID, c.OrgID}

		// Add resource type filter
		if resourceType != "" {
			sql += " AND urs.resource_type = ?"
			params = append(params, resourceType)
		}

		// Add time filter
		if period != "all" {
			days := 30 // default
			switch period {
			case "7d":
				days = 7
			case "90d":
				days = 90
			}
			sql += " AND urs.last_visited >= ?"
			params = append(params, time.Now().AddDate(0, 0, -days))
		}

		// Exclude deleted resources
		sql += " AND (d.deleted IS NULL OR d.deleted = '' OR urs.resource_type NOT IN ('dashboard', 'folder'))"

		// Order and limit
		sql += " ORDER BY urs.visit_count DESC, urs.last_visited DESC LIMIT ?"
		params = append(params, limit)

		type queryResult struct {
			UID          string    `xorm:"uid"`
			Title        string    `xorm:"title"`
			ResourceType string    `xorm:"resource_type"`
			VisitCount   int       `xorm:"visit_count"`
			LastVisited  time.Time `xorm:"last_visited"`
			FirstVisited time.Time `xorm:"first_visited"`
		}

		var results []queryResult
		err := sess.SQL(sql, params...).Find(&results)
		if err != nil {
			return err
		}

		for _, row := range results {
			resource := PopularResource{
				UID:          row.UID,
				Title:        row.Title,
				ResourceType: row.ResourceType,
				VisitCount:   row.VisitCount,
				LastVisited:  row.LastVisited,
				FirstVisited: row.FirstVisited,
			}

			// Generate URL based on type
			switch row.ResourceType {
			case "dashboard":
				resource.URL = "/d/" + row.UID
			case "folder":
				resource.URL = "/dashboards/f/" + row.UID
			case "alert":
				resource.URL = "/alerting/list?search=" + row.UID
			default:
				resource.URL = "/resource/" + row.UID
			}

			resources = append(resources, resource)
		}

		return nil
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get popular resources", err)
	}

	// Fetch titles for resources where title equals UID (not found in SQL tables)
	// This handles unified storage dashboards/folders
	for i := range resources {
		// If title equals UID, it means we didn't find it in SQL tables
		if resources[i].Title == resources[i].UID {
			hs.log.Info("Fetching title for resource from service", "uid", resources[i].UID, "type", resources[i].ResourceType)
			switch resources[i].ResourceType {
			case "dashboard":
				// Fetch dashboard title via dashboard service
				dash, err := hs.DashboardService.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{
					UID:   resources[i].UID,
					OrgID: c.OrgID,
				})
				if err != nil {
					hs.log.Warn("Failed to fetch dashboard title", "uid", resources[i].UID, "error", err)
				}
				if err == nil && dash != nil {
					hs.log.Info("Successfully fetched dashboard title", "uid", resources[i].UID, "title", dash.Title)
					resources[i].Title = dash.Title
				}
			case "folder":
				// Fetch folder title via folder service
				// IMPORTANT: Must pass SignedInUser for unified storage folders
				foldr, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{
					UID:          &resources[i].UID,
					OrgID:        c.OrgID,
					SignedInUser: c.SignedInUser,
				})
				if err != nil {
					hs.log.Warn("Failed to fetch folder title", "uid", resources[i].UID, "error", err)
				}
				if err == nil && foldr != nil {
					hs.log.Info("Successfully fetched folder title", "uid", resources[i].UID, "title", foldr.Title)
					resources[i].Title = foldr.Title
				}
			}
		}
	}

	return response.JSON(http.StatusOK, PopularResourcesResponse{
		Resources:  resources,
		TotalCount: len(resources),
	})
}

// GetRecentResourcesSimple returns most recently visited resources for the current user
// Supports multiple resource types via query parameter
func (hs *HTTPServer) GetRecentResourcesSimple(c *contextmodel.ReqContext) response.Response {
	// Parse query parameters
	limitStr := c.Query("limit")
	limit := 10
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	period := c.Query("period")
	if period == "" {
		period = "30d"
	}

	// Get resource types from query parameter (comma-separated or multiple params)
	typesParam := c.QueryStrings("types[]")
	if len(typesParam) == 0 {
		// Fallback to single 'type' parameter for backward compatibility
		if singleType := c.Query("type"); singleType != "" {
			typesParam = []string{singleType}
		}
	}

	// Validate period
	validPeriods := map[string]bool{"7d": true, "30d": true, "90d": true, "all": true}
	if !validPeriods[period] {
		return response.Error(http.StatusBadRequest, "Invalid period. Valid values: 7d, 30d, 90d, all", nil)
	}

	// Validate and filter resource types
	validTypes := map[string]bool{"dashboard": true, "folder": true, "alert": true}
	resourceTypes := []string{}
	if len(typesParam) > 0 {
		for _, t := range typesParam {
			if validTypes[t] {
				resourceTypes = append(resourceTypes, t)
			} else {
				return response.Error(http.StatusBadRequest, "Invalid resource type: "+t+". Valid values: dashboard, folder, alert", nil)
			}
		}
	}

	var resources []PopularResource

	err := hs.SQLStore.WithDbSession(c.Req.Context(), func(sess *db.Session) error {
		sql := `
			SELECT 
				urs.resource_uid as uid,
				CASE 
					WHEN urs.resource_type IN ('dashboard', 'folder') AND d.title IS NOT NULL 
					THEN d.title 
					ELSE urs.resource_uid 
				END as title,
				urs.resource_type,
				urs.visit_count,
				urs.last_visited,
				urs.first_visited
			FROM user_resources_visit_stats urs
			LEFT JOIN dashboard d ON d.uid = urs.resource_uid AND d.org_id = urs.org_id 
				AND urs.resource_type IN ('dashboard', 'folder')
				AND (d.deleted IS NULL OR d.deleted = '')
			WHERE urs.user_id = ? AND urs.org_id = ?
		`

		params := []interface{}{c.UserID, c.OrgID}

		// Add resource types filter if specified
		if len(resourceTypes) > 0 {
			placeholders := make([]string, len(resourceTypes))
			for i, rt := range resourceTypes {
				placeholders[i] = "?"
				params = append(params, rt)
			}
			sql += " AND urs.resource_type IN (" + strings.Join(placeholders, ",") + ")"
		}

		// Add time filter
		if period != "all" {
			days := 30 // default
			switch period {
			case "7d":
				days = 7
			case "90d":
				days = 90
			}
			sql += " AND urs.last_visited >= ?"
			params = append(params, time.Now().AddDate(0, 0, -days))
		}

		// Exclude deleted resources
		sql += " AND (d.deleted IS NULL OR d.deleted = '' OR urs.resource_type NOT IN ('dashboard', 'folder'))"

		// Order by most recent visit and limit
		sql += " ORDER BY urs.last_visited DESC LIMIT ?"
		params = append(params, limit)

		type queryResult struct {
			UID          string    `xorm:"uid"`
			Title        string    `xorm:"title"`
			ResourceType string    `xorm:"resource_type"`
			VisitCount   int       `xorm:"visit_count"`
			LastVisited  time.Time `xorm:"last_visited"`
			FirstVisited time.Time `xorm:"first_visited"`
		}

		var results []queryResult
		err := sess.SQL(sql, params...).Find(&results)
		if err != nil {
			return err
		}

		for _, row := range results {
			resource := PopularResource{
				UID:          row.UID,
				Title:        row.Title,
				ResourceType: row.ResourceType,
				VisitCount:   row.VisitCount,
				LastVisited:  row.LastVisited,
				FirstVisited: row.FirstVisited,
			}

			// Generate URL based on type
			switch row.ResourceType {
			case "dashboard":
				resource.URL = "/d/" + row.UID
			case "folder":
				resource.URL = "/dashboards/f/" + row.UID
			case "alert":
				resource.URL = "/alerting/list?search=" + row.UID
			default:
				resource.URL = "/resource/" + row.UID
			}

			resources = append(resources, resource)
		}

		return nil
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get recent resources", err)
	}

	// Fetch titles for resources where title equals UID (not found in SQL tables)
	// This handles unified storage dashboards/folders
	for i := range resources {
		// If title equals UID, it means we didn't find it in SQL tables
		if resources[i].Title == resources[i].UID {
			hs.log.Info("Fetching title for resource from service", "uid", resources[i].UID, "type", resources[i].ResourceType)
			switch resources[i].ResourceType {
			case "dashboard":
				// Fetch dashboard title via dashboard service
				dash, err := hs.DashboardService.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{
					UID:   resources[i].UID,
					OrgID: c.OrgID,
				})
				if err != nil {
					hs.log.Warn("Failed to fetch dashboard title", "uid", resources[i].UID, "error", err)
				}
				if err == nil && dash != nil {
					hs.log.Info("Successfully fetched dashboard title", "uid", resources[i].UID, "title", dash.Title)
					resources[i].Title = dash.Title
				}
			case "folder":
				// Fetch folder title via folder service
				// IMPORTANT: Must pass SignedInUser for unified storage folders
				foldr, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{
					UID:          &resources[i].UID,
					OrgID:        c.OrgID,
					SignedInUser: c.SignedInUser,
				})
				if err != nil {
					hs.log.Warn("Failed to fetch folder title", "uid", resources[i].UID, "error", err)
				}
				if err == nil && foldr != nil {
					hs.log.Info("Successfully fetched folder title", "uid", resources[i].UID, "title", foldr.Title)
					resources[i].Title = foldr.Title
				}
			}
		}
	}

	return response.JSON(http.StatusOK, PopularResourcesResponse{
		Resources:  resources,
		TotalCount: len(resources),
	})
}

// RecordResourceVisitSimple records a visit to a resource
func (hs *HTTPServer) RecordResourceVisitSimple(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	resourceType := web.Params(c.Req)[":type"]

	if uid == "" || resourceType == "" {
		return response.Error(http.StatusBadRequest, "Resource UID and type are required", nil)
	}

	// Validate resource type
	validTypes := map[string]bool{"dashboard": true, "folder": true, "alert": true}
	if !validTypes[resourceType] {
		return response.Error(http.StatusBadRequest, "Invalid resource type", nil)
	}

	err := hs.SQLStore.WithTransactionalDbSession(c.Req.Context(), func(sess *db.Session) error {
		now := time.Now()

		// Try to update existing record
		result, err := sess.Exec(`
			UPDATE user_resources_visit_stats 
			SET visit_count = visit_count + 1, last_visited = ?, updated = ?
			WHERE user_id = ? AND resource_uid = ? AND resource_type = ? AND org_id = ?
		`, now, now, c.UserID, uid, resourceType, c.OrgID)

		if err != nil {
			return err
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			// Insert new record
			_, err = sess.Exec(`
				INSERT INTO user_resources_visit_stats 
				(user_id, resource_uid, resource_type, org_id, visit_count, last_visited, first_visited, created, updated)
				VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
			`, c.UserID, uid, resourceType, c.OrgID, now, now, now, now)
		}

		return err
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to record visit", err)
	}

	return response.JSON(http.StatusOK, map[string]string{"message": "Visit recorded"})
}
