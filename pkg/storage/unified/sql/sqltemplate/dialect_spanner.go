package sqltemplate

// Spanner is an implementation of Dialect for the Google Spanner database.
var Spanner = spanner{}

var _ Dialect = Spanner

type spanner struct{}

func (s spanner) DialectName() string {
	return "spanner"
}

func (s spanner) Ident(a string) (string, error) {
	return backtickIdent{}.Ident(a)
}

func (s spanner) ArgPlaceholder(argNum int) string {
	return argFmtSQL92.ArgPlaceholder(argNum)
}

func (s spanner) SelectFor(a ...string) (string, error) {
	return rowLockingClauseSpanner.SelectFor(a...)
}

func (spanner) CurrentEpoch() string {
	return "UNIX_MICROS(CURRENT_TIMESTAMP())"
}

var rowLockingClauseSpanner = rowLockingClauseMap{
	SelectForUpdate: SelectForUpdate,
}
