package sqltemplate

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

// standardIdent provides standard SQL escaping of identifiers.
type backtickIdent struct{}

var standardFallback = standardIdent{}

func (backtickIdent) Ident(s string) (string, error) {
	switch s {
	// Internal identifiers require backticks to work properly
	case "user":
		return "`" + s + "`", nil
	case "":
		return "", ErrEmptyIdent
	}
	// standard
	return standardFallback.Ident(s)
}
