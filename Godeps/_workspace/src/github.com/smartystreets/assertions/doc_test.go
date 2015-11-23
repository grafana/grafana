package assertions

import (
	"bytes"
	"fmt"
	"testing"
)

func TestPassingAssertion(t *testing.T) {
	fake := &FakeT{buffer: new(bytes.Buffer)}
	assertion := New(fake)
	passed := assertion.So(1, ShouldEqual, 1)

	if !passed {
		t.Error("Assertion failed when it should have passed.")
	}
	if fake.buffer.Len() > 0 {
		t.Error("Unexpected error message was printed.")
	}
}

func TestFailingAssertion(t *testing.T) {
	fake := &FakeT{buffer: new(bytes.Buffer)}
	assertion := New(fake)
	passed := assertion.So(1, ShouldEqual, 2)

	if passed {
		t.Error("Assertion passed when it should have failed.")
	}
	if fake.buffer.Len() == 0 {
		t.Error("Expected error message not printed.")
	}
}

type FakeT struct {
	buffer *bytes.Buffer
}

func (this *FakeT) Error(args ...interface{}) {
	fmt.Fprint(this.buffer, args...)
}
