package sqltemplate

import (
	"errors"
	"reflect"
	"testing"
)

func TestArgs_Arg(t *testing.T) {
	t.Parallel()

	shouldBeQuestionMark := func(t *testing.T, s string) {
		t.Helper()
		if s != "?" {
			t.Fatalf("expecting question mark, got %q", s)
		}
	}

	a := NewArgs(MySQL)

	shouldBeQuestionMark(t, a.Arg(0))
	shouldBeQuestionMark(t, a.Arg(1))
	shouldBeQuestionMark(t, a.Arg(2))
	shouldBeQuestionMark(t, a.Arg(3))
	shouldBeQuestionMark(t, a.Arg(4))

	for i, arg := range a.GetArgs() {
		v, ok := arg.(int)
		if !ok {
			t.Fatalf("unexpected value: %T(%v)", arg, arg)
		}
		if v != i {
			t.Fatalf("unexpected int value: %v", v)
		}
	}
}

func TestArg_ArgList(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		input  reflect.Value
		added  []any
		output string
		err    error
	}{
		{err: ErrInvalidArgList},
		{input: reflect.ValueOf(1), err: ErrInvalidArgList},
		{input: reflect.ValueOf(nil), err: ErrInvalidArgList},
		{input: reflect.ValueOf(any(nil)), err: ErrInvalidArgList},
		{input: reflect.ValueOf("asd"), err: ErrInvalidArgList},
		{input: reflect.ValueOf([]any{})},

		{
			input:  reflect.ValueOf([]any{true}),
			added:  []any{true},
			output: "?",
		},

		{
			input:  reflect.ValueOf([]any{1, true}),
			added:  []any{1, true},
			output: "?, ?",
		},

		{
			input:  reflect.ValueOf([]any{1, "asd", true}),
			added:  []any{1, "asd", true},
			output: "?, ?, ?",
		},
	}

	var a args
	a.d = MySQL
	for i, tc := range testCases {
		a.Reset()

		gotOutput, gotErr := a.ArgList(tc.input)
		if !errors.Is(gotErr, tc.err) {
			t.Fatalf("[test #%d] Unexpected error. Expected: %v, actual: %v",
				i, gotErr, tc.err)
		}

		if tc.output != gotOutput {
			t.Fatalf("[test #%d] Unexpected output. Expected: %v, actual: %v",
				i, gotOutput, tc.output)
		}

		if len(tc.added) != len(a.values) {
			t.Fatalf("[test #%d] Unexpected added items.\n\tExpected: %#v\n\t"+
				"Actual: %#v", i, tc.added, a.values)
		}

		for j := range tc.added {
			if !reflect.DeepEqual(tc.added[j], a.values[j]) {
				t.Fatalf("[test #%d] Unexpected %d-eth item.\n\tExpected:"+
					" %#v\n\tActual: %#v", i, j, tc.added[j], a.values[j])
			}
		}
	}
}
