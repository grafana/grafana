package sqltemplate

import (
	"errors"
	"strings"
	"testing"
)

var _ Dialect = MySQL
var _ Dialect = SQLite
var _ Dialect = PostgreSQL

func TestSelectForOption_Valid(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		input    RowLockingClause
		expected bool
	}{
		{input: "", expected: false},
		{input: "share", expected: false},
		{input: SelectForShare, expected: true},
		{input: SelectForShareNoWait, expected: true},
		{input: SelectForShareSkipLocked, expected: true},
		{input: SelectForUpdate, expected: true},
		{input: SelectForUpdateNoWait, expected: true},
		{input: SelectForUpdateSkipLocked, expected: true},
	}

	for i, tc := range testCases {
		got := tc.input.Valid()
		if got != tc.expected {
			t.Fatalf("unexpected %v in test case %d", got, i)
		}
	}
}

func TestParseRowLockingClause(t *testing.T) {
	t.Parallel()

	splitSpace := func(s string) []string {
		return strings.Split(s, " ")
	}

	testCases := []struct {
		input  []string
		output RowLockingClause
		err    error
	}{
		{err: ErrInvalidRowLockingClause},
		{
			input: []string{" " + string(SelectForShare)},
			err:   ErrInvalidRowLockingClause,
		},
		{
			input:  splitSpace(string(SelectForShareNoWait)),
			output: SelectForShareNoWait,
		},
		{
			input:  splitSpace(strings.ToLower(string(SelectForShareNoWait))),
			output: SelectForShareNoWait,
		},
		{
			input:  splitSpace(strings.ToTitle(string(SelectForShareNoWait))),
			output: SelectForShareNoWait,
		},
	}

	for i, tc := range testCases {
		gotOutput, gotErr := ParseRowLockingClause(tc.input...)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != (tc.output) {
			t.Fatalf("unexpected output %q in test case %d", gotOutput, i)
		}
	}
}

func TestRowLockingClauseMap_SelectFor(t *testing.T) {
	t.Parallel()

	splitSpace := func(s string) []string {
		return strings.Split(s, " ")
	}

	testCases := []struct {
		input  []string
		output RowLockingClause
		err    error
	}{
		{err: ErrInvalidRowLockingClause},
		{input: []string{"invalid"}, err: ErrInvalidRowLockingClause},
		{input: []string{" share"}, err: ErrInvalidRowLockingClause},

		{
			input:  splitSpace(string(SelectForShare)),
			output: "FOR " + SelectForShare,
		},
	}

	var nilRLC rowLockingClauseMap
	for i, tc := range testCases {
		gotOutput, gotErr := nilRLC.SelectFor(tc.input...)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("[nil] unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != "" {
			t.Fatalf("[nil] unexpected output %v in test case %d", gotOutput, i)
		}

		gotOutput, gotErr = rowLockingClauseAll.SelectFor(tc.input...)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("[all] unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != string(tc.output) {
			t.Fatalf("[all] unexpected output %v in test case %d", gotOutput, i)
		}
	}
}

func TestStandardIdent_Ident(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		input  string
		output string
		err    error
	}{
		{input: ``, err: ErrEmptyIdent},
		{input: `polite_example`, output: `"polite_example"`},
		{input: `Juan Carlos`, output: `"Juan Carlos"`},
		{
			input:  `exaggerated " ' ` + "`" + ` example`,
			output: `"exaggerated "" ' ` + "`" + ` example"`,
		},
	}

	for i, tc := range testCases {
		gotOutput, gotErr := standardIdent(tc.input)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != tc.output {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
	}
}
