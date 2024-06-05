package sqltemplate

// MySQL is an implementation of Dialect for the MySQL DMBS. It relies on having
// ANSI_QUOTES SQL Mode enabled. For more information about ANSI_QUOTES and SQL
// Modes see:
//
//	https://dev.mysql.com/doc/refman/8.4/en/sql-mode.html#sqlmode_ansi_quotes
var MySQL = mysql{
	rowLockingClauseAll: true,
	argPlaceholderFunc:  argFmtSQL92,
}

var _ Dialect = MySQL

type mysql struct {
	standardIdent
	rowLockingClauseAll
	argPlaceholderFunc
}
