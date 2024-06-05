package sqltemplate

import "testing"

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
