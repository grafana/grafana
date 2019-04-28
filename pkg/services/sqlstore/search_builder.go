package sqlstore

import (
	"strings"

	m "github.com/grafana/grafana/pkg/models"
)

// SearchBuilder is a builder/object mother that builds a dashboard search query
type SearchBuilder struct {
	SqlBuilder
	tags                []string
	isStarred           bool
	limit               int64
	page                int64
	signedInUser        *m.SignedInUser
	whereDashboardIdsIn []int64
	whereTitle          string
	whereTypeFolder     bool
	whereTypeDash       bool
	whereFolderIds      []int64
	permission          m.PermissionType
}

func NewSearchBuilder(signedInUser *m.SignedInUser, limit int64, page int64, permission m.PermissionType) *SearchBuilder {
	// Default to page 1
	if page < 1 {
		page = 1
	}

	// default limit
	if limit <= 0 {
		limit = 1000
	}

	searchBuilder := &SearchBuilder{
		signedInUser: signedInUser,
		limit:        limit,
		page:         page,
		permission:   permission,
	}

	return searchBuilder
}

func (sb *SearchBuilder) WithTags(tags []string) *SearchBuilder {
	if len(tags) > 0 {
		sb.tags = tags
	}

	return sb
}

func (sb *SearchBuilder) IsStarred() *SearchBuilder {
	sb.isStarred = true

	return sb
}

func (sb *SearchBuilder) WithDashboardIdsIn(ids []int64) *SearchBuilder {
	if len(ids) > 0 {
		sb.whereDashboardIdsIn = ids
	}

	return sb
}

func (sb *SearchBuilder) WithTitle(title string) *SearchBuilder {
	sb.whereTitle = title

	return sb
}

func (sb *SearchBuilder) WithType(queryType string) *SearchBuilder {
	if len(queryType) > 0 && queryType == "dash-folder" {
		sb.whereTypeFolder = true
	}

	if len(queryType) > 0 && queryType == "dash-db" {
		sb.whereTypeDash = true
	}

	return sb
}

func (sb *SearchBuilder) WithFolderIds(folderIds []int64) *SearchBuilder {
	sb.whereFolderIds = folderIds
	return sb
}

// ToSql builds the sql and returns it as a string, together with the params.
func (sb *SearchBuilder) ToSql() (string, []interface{}) {
	sb.params = make([]interface{}, 0)

	sb.buildSelect()

	if len(sb.tags) > 0 {
		sb.buildTagQuery()
	} else {
		sb.buildMainQuery()
	}

	sb.sql.WriteString(`
		ORDER BY dashboard.id ` + dialect.LimitOffset(sb.limit, (sb.page-1)*sb.limit) + `) as ids
		INNER JOIN dashboard on ids.id = dashboard.id
	`)

	sb.sql.WriteString(`
		LEFT OUTER JOIN dashboard folder on folder.id = dashboard.folder_id
		LEFT OUTER JOIN dashboard_tag on dashboard.id = dashboard_tag.dashboard_id`)

	sb.sql.WriteString(`
		LEFT OUTER JOIN `)
	sb.buildPermissionsTable()
	sb.sql.WriteString(` as permissions ON dashboard.id = permissions.d_id
		WHERE (d_count + f_count + c_count + default_count > 0) OR ` + dialect.BooleanStr(sb.signedInUser.OrgRole == m.ROLE_ADMIN) + `
	`)

	sb.sql.WriteString(" ORDER BY dashboard.title ASC" + dialect.Limit(5000))

	return sb.sql.String(), sb.params
}

func (sb *SearchBuilder) buildSelect() {
	sb.sql.WriteString(
		`SELECT
			dashboard.id,
			dashboard.uid,
			dashboard.title,
			dashboard.slug,
			dashboard_tag.term,
			dashboard.is_folder,
			dashboard.folder_id,
			folder.uid as folder_uid,
			folder.slug as folder_slug,
			folder.title as folder_title,
			(permissions.d_count > 0 OR permissions.f_count > 0 OR permissions.default_count > 0 OR ` + dialect.BooleanStr(sb.signedInUser.OrgRole == m.ROLE_ADMIN) + `) as viewable
		FROM `)
}

func (sb *SearchBuilder) buildTagQuery() {
	sb.sql.WriteString(
		`(
	SELECT
		dashboard.id FROM dashboard
		LEFT OUTER JOIN dashboard_tag ON dashboard_tag.dashboard_id = dashboard.id
	`)

	if sb.isStarred {
		sb.sql.WriteString(" INNER JOIN star on star.dashboard_id = dashboard.id")
	}

	sb.sql.WriteString(` WHERE dashboard_tag.term IN (?` + strings.Repeat(",?", len(sb.tags)-1) + `) AND `)
	for _, tag := range sb.tags {
		sb.params = append(sb.params, tag)
	}

	sb.buildSearchWhereClause()

	// this ends the inner select (tag filtered part)
	sb.sql.WriteString(` GROUP BY dashboard.id HAVING COUNT(dashboard.id) >= ? `)
	sb.params = append(sb.params, len(sb.tags))
}

func (sb *SearchBuilder) buildMainQuery() {
	sb.sql.WriteString(`( SELECT dashboard.id FROM dashboard `)

	if sb.isStarred {
		sb.sql.WriteString(" INNER JOIN star on star.dashboard_id = dashboard.id")
	}

	sb.sql.WriteString(` WHERE `)
	sb.buildSearchWhereClause()

}

func (sb *SearchBuilder) buildSearchWhereClause() {
	sb.sql.WriteString(` dashboard.org_id=?`)
	sb.params = append(sb.params, sb.signedInUser.OrgId)

	if sb.isStarred {
		sb.sql.WriteString(` AND star.user_id=?`)
		sb.params = append(sb.params, sb.signedInUser.UserId)
	}

	if len(sb.whereDashboardIdsIn) > 0 {
		sb.sql.WriteString(` AND dashboard.id IN (?` + strings.Repeat(",?", len(sb.whereDashboardIdsIn)-1) + `)`)
		for _, dashboardId := range sb.whereDashboardIdsIn {
			sb.params = append(sb.params, dashboardId)
		}
	}

	if len(sb.whereTitle) > 0 {
		sb.sql.WriteString(" AND dashboard.title " + dialect.LikeStr() + " ?")
		sb.params = append(sb.params, "%"+sb.whereTitle+"%")
	}

	if sb.whereTypeFolder {
		sb.sql.WriteString(" AND dashboard.is_folder = " + dialect.BooleanStr(true))
	}

	if sb.whereTypeDash {
		sb.sql.WriteString(" AND dashboard.is_folder = " + dialect.BooleanStr(false))
	}

	if len(sb.whereFolderIds) > 0 {
		sb.sql.WriteString(` AND dashboard.folder_id IN (?` + strings.Repeat(",?", len(sb.whereFolderIds)-1) + `) `)
		for _, id := range sb.whereFolderIds {
			sb.params = append(sb.params, id)
		}
	}
}

func (sb *SearchBuilder) buildPermissionsTable() {
	falseStr := dialect.BooleanStr(false)
	okRoles := []interface{}{sb.signedInUser.OrgRole}

	sb.sql.WriteString(`
		(
			SELECT d_id, SUM(CASE WHEN da_did=d_id THEN 1 ELSE 0 END) as d_count,SUM(CASE WHEN da_did=f_id THEN 1 ELSE 0 END) as f_count,
				SUM(CASE WHEN da_did=child_id THEN 1 ELSE  0 END) as c_count, SUM(CASE WHEN da_did = -1 THEN 1 ELSE 0 END) as default_count
			FROM (
			  SELECT d.id as d_id, folder.id as f_id, child_dashboard.id as child_id, da.dashboard_id as da_did
			  FROM dashboard AS d
			  LEFT JOIN dashboard folder on folder.id = d.folder_id
			  LEFT JOIN dashboard child_dashboard on child_dashboard.folder_id = d.id
			  LEFT JOIN dashboard_acl AS da ON
	 			  da.dashboard_id = d.id OR
	 			  da.dashboard_id = d.folder_id OR
				  da.dashboard_id = child_dashboard.id OR
	 			  (
	 				  -- include default permissions -->
					  da.org_id = -1 AND (
					    (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					    (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					  )
	 			  )
			  LEFT JOIN team_member as ugm on ugm.team_id = da.team_id
			  WHERE
				  d.org_id = ? AND
				  da.permission >= ? AND
				  (
					  da.user_id = ? OR
					  ugm.user_id = ? OR
					  da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
				  )
      		)
      		GROUP BY d_id
		) 
	`)

	sb.params = append(sb.params, sb.signedInUser.OrgId, sb.permission, sb.signedInUser.UserId, sb.signedInUser.UserId)
	sb.params = append(sb.params, okRoles...)
}
