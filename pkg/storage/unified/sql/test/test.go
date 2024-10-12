package test

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// TestDBProvider is a stub for db.ResourceDBInterface.
type TestDBProvider struct {
	Err     error
	DB      db.DB
	SQLMock sqlmock.Sqlmock
}

func (d TestDBProvider) Init(context.Context) (db.DB, error) {
	return d.DB, d.Err
}

var _ db.DBProvider = TestDBProvider{}

// NewDBProviderNopSQL returns a TestDBProvider with a sqlmock.Sqlmock that
// doesn't validates SQL. This is only meant to be used to test wrapping
// utilities where the actual SQL is not relevant to the unit tests, but rather
// how the possible derived error conditions handled.
func NewDBProviderNopSQL(t *testing.T) TestDBProvider {
	t.Helper()
	mockDB, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(
			func(string, string) error { return nil },
		)),
	)
	require.NoError(t, err)

	return TestDBProvider{
		DB:      dbimpl.NewDB(mockDB, "mysql"),
		SQLMock: mock,
	}
}

// NewDBProviderWithPing requires that database pings have a matching
// expectation, which are ignored by default. The SQL matching is the sqlmock
// default.
func NewDBProviderWithPing(t *testing.T) TestDBProvider {
	t.Helper()
	mockDB, mock, err := sqlmock.New(sqlmock.MonitorPingsOption(true))
	require.NoError(t, err)

	return TestDBProvider{
		DB:      dbimpl.NewDB(mockDB, "mysql"),
		SQLMock: mock,
	}
}

// NewDBProviderMatchWords returns a TestDBProvider with a sqlmock.Sqlmock that
// will match SQL by splitting the expected SQL string into words, and then try
// to find all of them in the actual SQL, in the given order, case
// insensitively. Prepend a word with a `!` to say that word should not be
// found.
func NewDBProviderMatchWords(t *testing.T) TestDBProvider {
	t.Helper()
	mockDB, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(
			sqlmock.QueryMatcherFunc(wordsMatcherFunc),
		),
	)
	require.NoError(t, err)

	return TestDBProvider{
		DB:      dbimpl.NewDB(mockDB, "mysql"),
		SQLMock: mock,
	}
}

func wordsMatcherFunc(expectedSQL, actualSQL string) error {
	actualSQL = strings.ToLower(sqltemplate.FormatSQL(actualSQL))
	expectedSQL = strings.ToLower(expectedSQL)

	var offset int
	for _, vv := range matchWorsRE.FindAllStringSubmatch(expectedSQL, -1) {
		v := vv[1]

		var shouldNotMatch bool
		if v != "" && v[0] == '!' {
			v = v[1:]
			shouldNotMatch = true
		}
		if v == "" {
			return fmt.Errorf("invalid expected word %q in %q", v,
				expectedSQL)
		}

		reWord, err := regexp.Compile(`\b` + regexp.QuoteMeta(v) + `\b`)
		if err != nil {
			return fmt.Errorf("compile word %q from expected SQL: %s", v,
				expectedSQL)
		}

		if shouldNotMatch {
			if reWord.MatchString(actualSQL[offset:]) {
				return fmt.Errorf("actual SQL fragent should not cont"+
					"ain %q but it does\n\tFragment: %s\n\tFull SQL: %s",
					v, actualSQL[offset:], actualSQL)
			}
		} else {
			loc := reWord.FindStringIndex(actualSQL[offset:])
			if len(loc) == 0 {
				return fmt.Errorf("actual SQL fragment should contain "+
					"%q but it doesn't\n\tFragment: %s\n\tFull SQL: %s",
					v, actualSQL[offset:], actualSQL)
			}
			offset = loc[1] // advance the offset
		}
	}

	return nil
}

var matchWorsRE = regexp.MustCompile(`(?:\W|\A)(!?\w+)\b`)
