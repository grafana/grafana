package sqltemplate

import (
	"errors"
	"strings"

	driver "github.com/go-sql-driver/mysql"
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
	if strings.ContainsRune(s, '`') {
		return "", ErrInvalidIdentInput
	}
	return escapeIdentity(s, '`', func(s string) string {
		return s
	})
}

func (mysql) CurrentEpoch() string {
	return "CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED)"
}

func (mysql) IsRowAlreadyExistsError(err error) bool {
	var mysqlerr *driver.MySQLError
	return errors.As(err, &mysqlerr) &&
		// https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
		mysqlerr.Number == 1062 // ER_DUP_ENTRY
}
