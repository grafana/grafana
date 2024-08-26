package sqltemplate

import (
	"bytes"
	"regexp"
	"strings"
)

// MySQL is the default implementation of Dialect for the MySQL DMBS, currently
// supporting MySQL-8.x. It relies on having ANSI_QUOTES SQL Mode enabled. For
// more information about ANSI_QUOTES and SQL Modes see:
//
//	https://dev.mysql.com/doc/refman/8.4/en/sql-mode.html#sqlmode_ansi_quotes
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

var alphanumeric = regexp.MustCompile("^[a-zA-Z0-9_]*$")

func (backtickIdent) Ident(s string) (string, error) {
	if s == "" {
		return "", ErrEmptyIdent
	}
	var buffer bytes.Buffer
	for i, part := range strings.Split(s, ".") {
		if !alphanumeric.MatchString(part) {
			return "", ErrInvalidIdentInput
		}
		if i > 1 {
			return "", ErrInvalidIdentInput
		}
		if i > 0 {
			_, _ = buffer.WriteRune('.')
		}
		_, _ = buffer.WriteRune('`')
		_, _ = buffer.WriteString(part)
		_, _ = buffer.WriteRune('`')
	}
	return buffer.String(), nil
}
