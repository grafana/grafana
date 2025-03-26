package sqltemplate

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

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

func (spanner) IsRowAlreadyExistsError(err error) bool {
	// This is the implementation of the `ErrCode` function from the spanner driver.
	// We've inlined it here to avoid adding a dependency on the driver, as we don't want the dependency in OSS (though it'd be fine in Pro/Enterprise).
	s, ok := status.FromError(err)
	return ok && s.Code() == codes.AlreadyExists
}

var rowLockingClauseSpanner = rowLockingClauseMap{
	SelectForUpdate: SelectForUpdate,
}
