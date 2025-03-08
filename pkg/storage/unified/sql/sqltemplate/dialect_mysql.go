package sqltemplate

import (
	"strings"
)

// MySQL is the default implementation of Dialect for the MySQL DMBS,
// currently supporting MySQL-8.x.
var MySQL = mysql{
	rowLockingClauseMap: rowLockingClauseAll,
	argPlaceholderFunc:  argFmtSQL92,
	name:                "mysql",
}

var _ Dialect = MySQL

type mysql struct {
	backtickIdent
	rowLockingClauseMap
	argPlaceholderFunc
	name
}

// MySQL always supports backticks for identifiers
// https://dev.mysql.com/doc/refman/8.4/en/identifiers.html
type backtickIdent struct{}

func (backtickIdent) Ident(s string) (string, error) {
	return escapeIdentity(s, '`', func(s string) string {
		return strings.ReplaceAll(s, "`", "``")
	})
}

// CurrentEpoch returns the epoch time in microseconds (current_timestamp(6) * 1000000)
func (mysql) CurrentEpoch() string {
	return "CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED)"
}

// JsonExtract returns the SQL expression to extract a value from a JSON column in MySQL.
func (mysql) JsonExtract(tableAlias string, column string, fieldKey string) string {
	columnRef := column
	if tableAlias != "" {
		columnRef = tableAlias + "." + column
	}
	// Use JSON_UNQUOTE to ensure string conversion
	return "JSON_UNQUOTE(JSON_EXTRACT(" + columnRef + ", '$." + fieldKey + "'))"
}
