package sqltemplate

import (
	"errors"
	"strconv"
	"strings"
)

// Dialect-agnostic errors.
var (
	ErrEmptyIdent              = errors.New("empty identifier")
	ErrInvalidRowLockingClause = errors.New("invalid row-locking clause")
)

// Dialect should be added to the data types passed to SQL templates to
// provide methods that deal with SQL implementation-specific traits. It can be
// embedded for ease of use, or with a named struct field if any of its methods
// would clash with other struct field names.
type Dialect interface {
	// Ident returns the given string quoted in a way that is suitable to be
	// used as an identifier. Database names, schema names, table names, column
	// names are all examples of identifiers.
	Ident(string) (string, error)

	// ArgPlaceholder returns a safe argument suitable to be used in a SQL
	// prepared statement for the argNum-eth argument passed in execution. The
	// SQL92 Standard specifies the question mark ('?') should be used in all
	// cases, but some implementations differ.
	ArgPlaceholder(argNum int) string

	// SelectFor parses and returns the given row-locking clause for a SELECT
	// statement. If the clause is invalid it returns an error. Implementations
	// of this method should use ParseRowLockingClause.
	// Example:
	//
	//	SELECT *
	//		FROM mytab
	//		WHERE id = ?
	//		{{ .SelectFor "Update NoWait" }}; -- will be uppercased
	SelectFor(...string) (string, error)
}

// RowLockingClause represents a row-locking clause in a SELECT statement.
type RowLockingClause string

// Valid returns whether the given option is valid.
func (o RowLockingClause) Valid() bool {
	switch o {
	case SelectForShare, SelectForShareNoWait, SelectForShareSkipLocked,
		SelectForUpdate, SelectForUpdateNoWait, SelectForUpdateSkipLocked:
		return true
	}
	return false
}

// ParseRowLockingClause parses a RowLockingClause from the given strings. This
// should be used by implementations of Dialect to parse the input of the
// SelectFor method.
func ParseRowLockingClause(s ...string) (RowLockingClause, error) {
	opt := RowLockingClause(strings.ToUpper(strings.Join(s, " ")))
	if !opt.Valid() {
		return "", ErrInvalidRowLockingClause
	}

	return opt, nil
}

// Row-locking clause options.
const (
	SelectForShare            RowLockingClause = "SHARE"
	SelectForShareNoWait      RowLockingClause = "SHARE NOWAIT"
	SelectForShareSkipLocked  RowLockingClause = "SHARE SKIP LOCKED"
	SelectForUpdate           RowLockingClause = "UPDATE"
	SelectForUpdateNoWait     RowLockingClause = "UPDATE NOWAIT"
	SelectForUpdateSkipLocked RowLockingClause = "UPDATE SKIP LOCKED"
)

// rowLockingClauseAll aids implementations that either support all the
// row-locking clause options or none. If it's true, it returns the clause,
// otherwise it returns an empty string.
type rowLockingClauseAll bool

func (rlc rowLockingClauseAll) SelectFor(s ...string) (string, error) {
	// all implementations should err on invalid input, otherwise we would just
	// be hiding the error until we change the dialect
	o, err := ParseRowLockingClause(s...)
	if err != nil {
		return "", err
	}

	if !rlc {
		return "", nil
	}

	return "FOR " + string(o), nil
}

// standardIdent provides standard SQL escaping of identifiers.
type standardIdent struct{}

func (standardIdent) Ident(s string) (string, error) {
	if s == "" {
		return "", ErrEmptyIdent
	}
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`, nil
}

type argPlaceholderFunc func(int) string

func (f argPlaceholderFunc) ArgPlaceholder(argNum int) string {
	return f(argNum)
}

var (
	argFmtSQL92 = argPlaceholderFunc(func(int) string {
		return "?"
	})
	argFmtPositional = argPlaceholderFunc(func(argNum int) string {
		return "$" + strconv.Itoa(argNum)
	})
)
