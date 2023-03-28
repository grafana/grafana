package export

import (
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
)

func isTableNotExistsError(err error) bool {
	txt := err.Error()
	return strings.HasPrefix(txt, "no such table") || // SQLite
		strings.HasSuffix(txt, " does not exist") || // PostgreSQL
		strings.HasSuffix(txt, " doesn't exist") // MySQL
}

func removeQuotesFromQuery(query string, remove bool) string {
	if remove {
		return strings.ReplaceAll(query, `"`, "")
	}
	return query
}

func isMySQLEngine(sql db.DB) bool {
	return sql.GetDBType() == "mysql"
}

func isPostgreSQL(sql db.DB) bool {
	return sql.GetDBType() == "postgres"
}
