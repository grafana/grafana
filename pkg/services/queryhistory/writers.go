package queryhistory

import (
	"bytes"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
)

func writeStarredSQL(query SearchInQueryHistoryQuery, sqlStore db.DB, builder *db.SQLBuilder, isCount bool) {
	var sql bytes.Buffer
	if isCount {
		sql.WriteString(`COUNT(`)
	}
	if query.OnlyStarred {
		sql.WriteString(sqlStore.GetDialect().BooleanStr(true))
	} else {
		sql.WriteString(`CASE WHEN query_history_star.query_uid IS NULL THEN ` + sqlStore.GetDialect().BooleanStr(false) + ` ELSE ` + sqlStore.GetDialect().BooleanStr(true) + ` END`)
	}
	if isCount {
		sql.WriteString(`)`)
	}
	sql.WriteString(` AS starred FROM query_history `)

	if query.OnlyStarred {
		sql.WriteString(`INNER`)
	} else {
		sql.WriteString(`LEFT`)
	}

	sql.WriteString(` JOIN query_history_star ON query_history_star.query_uid = query_history.uid `)
	builder.Write(sql.String())
}

func writeFiltersSQL(query SearchInQueryHistoryQuery, user *user.SignedInUser, sqlStore db.DB, builder *db.SQLBuilder) {
	queriesSQL, queriesParam := sqlStore.GetDialect().LikeOperator("query_history.queries", true, query.SearchString, true)
	commentSQL, commentParam := sqlStore.GetDialect().LikeOperator("query_history.comment", true, query.SearchString, true)
	params := []any{user.OrgID, user.UserID, query.From, query.To, queriesParam, commentParam}
	var sql bytes.Buffer
	sql.WriteString(" WHERE query_history.org_id = ? AND query_history.created_by = ? AND query_history.created_at >= ? AND query_history.created_at <= ? AND (")
	sql.WriteString(queriesSQL)
	sql.WriteString(" OR ")
	sql.WriteString(commentSQL)
	sql.WriteString(") ")

	if len(query.DatasourceUIDs) > 0 {
		q := "?" + strings.Repeat(",?", len(query.DatasourceUIDs)-1)
		for _, uid := range query.DatasourceUIDs {
			params = append(params, uid)
		}
		for _, uid := range query.DatasourceUIDs {
			params = append(params, uid)
		}
		sql.WriteString(" AND (")
		sql.WriteString("(query_history.datasource_uid IN (" + q + "))")
		sql.WriteString(" OR ")
		sql.WriteString("(query_history.uid IN (SELECT i.query_history_item_uid from query_history_details i WHERE i.datasource_uid IN (" + q + ")))")
		sql.WriteString(")")
	}
	builder.Write(sql.String(), params...)
}

func writeSortSQL(query SearchInQueryHistoryQuery, sqlStore db.DB, builder *db.SQLBuilder) {
	if query.Sort == "time-asc" {
		builder.Write(" ORDER BY created_at ASC ")
	} else {
		builder.Write(" ORDER BY created_at DESC ")
	}
}

func writeLimitSQL(query SearchInQueryHistoryQuery, sqlStore db.DB, builder *db.SQLBuilder) {
	builder.Write(" LIMIT ? ", query.Limit)
}

func writeOffsetSQL(query SearchInQueryHistoryQuery, sqlStore db.DB, builder *db.SQLBuilder) {
	builder.Write(" OFFSET ? ", query.Limit*(query.Page-1))
}
