package sqlstore

import (
	"bytes"
	"strings"

	m "github.com/grafana/grafana/pkg/models"
)

// SearchBuilder is a builder/object mother that builds a dashboard search query
type SearchBuilder struct {
	tags                []string
	isStarred           bool
	limit               int
	signedInUser        *m.SignedInUser
	whereDashboardIdsIn []int64
	whereTitle          string
	whereTypeFolder     bool
	whereTypeDash       bool
	whereFolderIds      []int64
	sql                 bytes.Buffer
	params              []interface{}
}

func NewSearchBuilder(signedInUser *m.SignedInUser, limit int) *SearchBuilder {
	searchBuilder := &SearchBuilder{
		signedInUser: signedInUser,
		limit:        limit,
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
		LEFT OUTER JOIN dashboard folder on folder.id = dashboard.folder_id
		LEFT OUTER JOIN dashboard_tag on dashboard.id = dashboard_tag.dashboard_id`)

	sb.sql.WriteString(" ORDER BY dashboard.title ASC LIMIT 5000")

	return sb.sql.String(), sb.params
}

func (sb *SearchBuilder) buildSelect() {
	sb.sql.WriteString(
		`SELECT
			dashboard.id,
			dashboard.title,
			dashboard.slug,
			dashboard_tag.term,
			dashboard.is_folder,
			dashboard.folder_id,
			folder.slug as folder_slug,
			folder.title as folder_title
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
	sb.sql.WriteString(`
		GROUP BY dashboard.id HAVING COUNT(dashboard.id) >= ?
		LIMIT ?) as ids
		INNER JOIN dashboard on ids.id = dashboard.id
	`)

	sb.params = append(sb.params, len(sb.tags))
	sb.params = append(sb.params, sb.limit)
}

func (sb *SearchBuilder) buildMainQuery() {
	sb.sql.WriteString(`( SELECT dashboard.id FROM dashboard `)

	if sb.isStarred {
		sb.sql.WriteString(" INNER JOIN star on star.dashboard_id = dashboard.id")
	}

	sb.sql.WriteString(` WHERE `)
	sb.buildSearchWhereClause()

	sb.sql.WriteString(`
		LIMIT ?) as ids
	INNER JOIN dashboard on ids.id = dashboard.id
	`)
	sb.params = append(sb.params, sb.limit)
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

	if sb.signedInUser.OrgRole != m.ROLE_ADMIN {
		allowedDashboardsSubQuery := ` AND (dashboard.has_acl = ` + dialect.BooleanStr(false) + ` OR dashboard.id in (
			SELECT distinct d.id AS DashboardId
			FROM dashboard AS d
	      		LEFT JOIN dashboard_acl as da on d.folder_id = da.dashboard_id or d.id = da.dashboard_id
	      		LEFT JOIN team_member as ugm on ugm.team_id =  da.team_id
	      		LEFT JOIN org_user ou on ou.role = da.role
			WHERE
			  d.has_acl = ` + dialect.BooleanStr(true) + ` and
				(da.user_id = ? or ugm.user_id = ? or ou.id is not null)
			  and d.org_id = ?
			)
		)`

		sb.sql.WriteString(allowedDashboardsSubQuery)
		sb.params = append(sb.params, sb.signedInUser.UserId, sb.signedInUser.UserId, sb.signedInUser.OrgId)
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
