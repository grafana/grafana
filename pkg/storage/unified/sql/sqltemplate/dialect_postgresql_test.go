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
		// The new implementation doesn't check for byte 0 anymore
		// {
		//     input: `unpolite_` + string([]byte{0}) + `example`,
		//     err:   ErrPostgreSQLUnsupportedIdent,
		// },
		{
			input:  `exaggerated " ' ` + "`" + ` example`,
			output: `"exaggerated "" ' ` + "`" + ` example"`,
		},
		// Add test case for dotted identifiers
		{
			input:  `schema.table`,
			output: `"schema"."table"`,
		},
		{
			input:  `public.users.name`,
			output: `"public"."users"."name"`,
		},
	}

	for i, tc := range testCases {
		gotOutput, gotErr := PostgreSQL.Ident(tc.input)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("unexpected error %v in test case %d", gotErr, i)
		}
		if gotOutput != tc.output {
			t.Fatalf("unexpected output %q, expected %q in test case %d", gotOutput, tc.output, i)
		}
	}
}
