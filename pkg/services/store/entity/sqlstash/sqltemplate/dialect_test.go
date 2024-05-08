package sqltemplate

import (
	"errors"
	"strings"
	"testing"
)

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

func TestRowLockingClauseAll_SelectFor(t *testing.T) {
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
			output: SelectForShare,
		},
	}

	for i, tc := range testCases {
		gotOutput, gotErr := rowLockingClauseAll(true).SelectFor(tc.input...)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("[true] unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != string(tc.output) {
			t.Fatalf("[true] unexpected error %v in test case %d", gotErr, i)
		}

		gotOutput, gotErr = rowLockingClauseAll(false).SelectFor(tc.input...)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("[false] unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != "" {
			t.Fatalf("[false] unexpected error %v in test case %d", gotErr, i)
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
		gotOutput, gotErr := standardIdent{}.Ident(tc.input)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != tc.output {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
	}
}
