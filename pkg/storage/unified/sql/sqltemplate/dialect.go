package sqltemplate

import (
	"bytes"
	"errors"
	"strings"
)

// Dialect-agnostic errors.
var (
	ErrEmptyIdent              = errors.New("empty identifier")
	ErrInvalidIdentInput       = errors.New("identifier contains invalid characters")
	ErrInvalidRowLockingClause = errors.New("invalid row-locking clause")
)

// DialectForDriver returns a predefined Dialect for the given driver name, or
// nil if no Dialect is known for that driver.
func DialectForDriver(driverName string) Dialect {
	switch strings.ToLower(driverName) {
	case "mysql":
		return MySQL
	case "postgres", "pgx":
		return PostgreSQL
	case "sqlite", "sqlite3":
		return SQLite
	case "ydb":
		return YDB
	default:
		return nil
	}
}

// Dialect should be added to the data types passed to SQL templates to
// provide methods that deal with SQL implementation-specific traits. It can be
// embedded for ease of use, or with a named struct field if any of its methods
// would clash with other struct field names.
type Dialect interface {
	// Name identifies the Dialect. Note that a Dialect may be common to more
	// than one DBMS (e.g. "postgres" is common to PostgreSQL and to
	// CockroachDB), while we can maintain different Dialects for the same DBMS
	// but different versions (e.g. "mysql5" and "mysql8").
	DialectName() string

	// Ident returns the given string quoted in a way that is suitable to be
	// used as an identifier. Database names, schema names, table names, column
	// names are all examples of identifiers.  When the value includes a "."
	// each part side of the separator will be escaped: (eg: `db`.`table`)
	Ident(string) (string, error)

	// ArgPlaceholder returns a safe argument suitable to be used in a SQL
	// prepared statement for the argNum-eth argument passed in execution
	// (starting at 1). The SQL92 Standard specifies the question mark ('?')
	// should be used in all cases, but some implementations differ.
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

	// CurrentEpoch returns the current epoch value for the database in microseconds.
	CurrentEpoch() string
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

const (
	SelectForShare            RowLockingClause = "SHARE"
	SelectForShareNoWait      RowLockingClause = "SHARE NOWAIT"
	SelectForShareSkipLocked  RowLockingClause = "SHARE SKIP LOCKED"
	SelectForUpdate           RowLockingClause = "UPDATE"
	SelectForUpdateNoWait     RowLockingClause = "UPDATE NOWAIT"
	SelectForUpdateSkipLocked RowLockingClause = "UPDATE SKIP LOCKED"
)

type rowLockingClauseMap map[RowLockingClause]RowLockingClause

func (rlc rowLockingClauseMap) SelectFor(s ...string) (string, error) {
	// all implementations should err on invalid input, otherwise we would just
	// be hiding the error until we change the dialect
	o, err := ParseRowLockingClause(s...)
	if err != nil {
		return "", err
	}

	var ret string
	if len(rlc) > 0 {
		ret = "FOR " + string(rlc[o])
	}

	return ret, nil
}

var rowLockingClauseAll = rowLockingClauseMap{
	SelectForShare:            SelectForShare,
	SelectForShareNoWait:      SelectForShareNoWait,
	SelectForShareSkipLocked:  SelectForShareSkipLocked,
	SelectForUpdate:           SelectForUpdate,
	SelectForUpdateNoWait:     SelectForUpdateNoWait,
	SelectForUpdateSkipLocked: SelectForUpdateSkipLocked,
}

func escapeIdentity(s string, quote rune, clean func(string) string) (string, error) {
	if s == "" {
		return "", ErrEmptyIdent
	}
	var buffer bytes.Buffer
	for i, part := range strings.Split(s, ".") {
		// We may want to check that the identifier is simple alphanumeric
		// var alphanumeric = regexp.MustCompile("^[a-zA-Z0-9_]*$")

		if i > 1 {
			return "", ErrInvalidIdentInput
		}
		if i > 0 {
			_, _ = buffer.WriteRune('.')
		}
		_, _ = buffer.WriteRune(quote)
		_, _ = buffer.WriteString(clean(part))
		_, _ = buffer.WriteRune(quote)
	}
	return buffer.String(), nil
}

// standardIdent provides standard SQL escaping of identifiers.
func standardIdent(s string) (string, error) {
	return escapeIdentity(s, '"', func(s string) string {
		// not sure we should support escaping quotes in table/column names,
		// but it is valid so we will support it for now
		return strings.ReplaceAll(s, `"`, `""`)
	})
}
