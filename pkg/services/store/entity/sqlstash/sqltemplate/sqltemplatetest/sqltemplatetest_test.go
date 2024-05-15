package sqltemplatetest

import "testing"

func TestSQLEq(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		a, b  string
		fails bool
	}{}

	for i, tc := range testCases {
	}
}

func TestStripSQLLike(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		input    string
		expected string
		fails    bool
	}{
		{},
		{
			input:    `Select 1,2;`,
			expected: `Select 1 , 2 ;`,
		},
		{
			input:    ` Select 1 , 2 ; `,
			expected: `Select 1 , 2 ;`,
		},
		{
			input:    ` Select 'a b '' c d ' ;   `,
			expected: `Select 'a b '' c d ' ;`,
		},
		{
			input: ` Select 'a b '' c d  ;   `,
			fails: true,
		},
		{
			input:    ` Select 'a b '' c d '`,
			expected: `Select 'a b '' c d '`,
		},
		{
			input: ` Sele"ct 'a b '' c d '`,
			fails: true,
		},
		{
			input: ` "Sele"ct 'a b '' c d '`,
			fails: true,
		},
		{
			input:    `select *, t.x from table as t`,
			expected: `select * , t . x from table as t`,
		},
	}

	for i, tc := range testCases {
		got, err := StripSQLLike(tc.input)
		if tc.fails {
			if err == nil {
				t.Errorf("[test #%d] unexpected success, output: %s", i, got)
			}

		} else {
			if err != nil {
				t.Errorf("[test #%d] unexpected error: %v", i, err)
			}
			if got != tc.expected {
				t.Errorf("[test #%d] unexpected output\n\texpected: %s\n\tgot:      %s", i,
					tc.expected, got)
			}
		}
	}
}
