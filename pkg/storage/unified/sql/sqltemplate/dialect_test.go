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
		gotOutput, gotErr := standardIdent{}.Ident(tc.input)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != tc.output {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
	}
}

func TestArgPlaceholderFunc(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		input           int
		valuePositional string
	}{
		{
			input:           1,
			valuePositional: "$1",
		},
		{
			input:           16,
			valuePositional: "$16",
		},
	}

	for i, tc := range testCases {
		got := argFmtSQL92(tc.input)
		if got != "?" {
			t.Fatalf("[argFmtSQL92] unexpected value %q in test case %d", got, i)
		}

		got = argFmtPositional(tc.input)
		if got != tc.valuePositional {
			t.Fatalf("[argFmtPositional] unexpected value %q in test case %d", got, i)
		}
	}
}

func TestName_Name(t *testing.T) {
	t.Parallel()

	const v = "some dialect name"
	n := name(v)
	if n.DialectName() != v {
		t.Fatalf("unexpected dialect name %q", n.DialectName())
	}
}

func TestReturning(t *testing.T) {
	t.Parallel()

	t.Run("noopReturningClause", func(t *testing.T) {
		t.Parallel()

		testCases := []struct {
			name  string
			input []string
		}{
			{"empty slice", []string{}},
			{"valid string slice", []string{"id", "name"}},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				t.Parallel()

				got, err := noopReturningClause{}.Returning(tc.input...)
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got != "" {
					t.Fatalf("expected empty string, got: %q", got)
				}
			})
		}
	})

	t.Run("returningClause", func(t *testing.T) {
		testCases := []struct {
			name   string
			input  []string
			output string
			isErr  bool
		}{
			{
				name:   "empty slice",
				input:  []string{},
				output: "",
			},
			{
				name:  "multiple columns with empty values",
				input: []string{"id", "name", ""},
				isErr: true,
			},
			{
				name:   "single column",
				input:  []string{"id"},
				output: "RETURNING id",
			},
			{
				name:   "multiple columns",
				input:  []string{"id", "name", "created_at"},
				output: "RETURNING id, name, created_at",
			},
			{
				name:   "column with asterisk",
				input:  []string{"*"},
				output: "RETURNING *",
			},
			{
				name:   "complex expressions",
				input:  []string{"id", "name AS user_name", "UPPER(email) AS email_upper"},
				output: "RETURNING id, name AS user_name, UPPER(email) AS email_upper",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				got, err := returningClause{}.Returning(tc.input...)

				if err != nil && !tc.isErr {
					t.Fatalf("unexpected error: %v", err)
				} else if err == nil && tc.isErr {
					t.Fatalf("expected error but got none")
				}

				if got != tc.output {
					t.Fatalf("expected %q, got %q", tc.output, got)
				}
			})
		}
	})
}
