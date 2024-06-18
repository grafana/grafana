package sqltemplate

import (
	"errors"
	"testing"
)

func TestPostgreSQL_Ident(t *testing.T) {
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
			input: `unpolite_` + string([]byte{0}) + `example`,
			err:   ErrPostgreSQLUnsupportedIdent,
		},
		{
			input:  `exaggerated " ' ` + "`" + ` example`,
			output: `"exaggerated "" ' ` + "`" + ` example"`,
		},
	}

	for i, tc := range testCases {
		gotOutput, gotErr := PostgreSQL.Ident(tc.input)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != tc.output {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
	}
}
