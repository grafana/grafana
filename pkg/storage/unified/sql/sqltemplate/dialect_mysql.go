package sqltemplate

import (
	"strings"
)

// MySQL is the default implementation of Dialect for the MySQL DMBS,
// currently supporting MySQL-8.x.
var MySQL = mysql{}

type mysql struct{}

func (m mysql) DialectName() string {
	return "mysql"
}

func (m mysql) Ident(s string) (string, error) {
	// MySQL always supports backticks for identifiers
	// https://dev.mysql.com/doc/refman/8.4/en/identifiers.html
	if strings.ContainsRune(s, '`') {
		return "", ErrInvalidIdentInput
	}
	return escapeIdentity(s, '`', func(s string) string {
		return s
	})
}

func (m mysql) ArgPlaceholder(argNum int) string {
	return "?"
}

func (m mysql) SelectFor(s ...string) (string, error) {
	return rowLockingClauseAll.SelectFor(s...)
}

func (mysql) CurrentEpoch() string {
	return "CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED)"
}
