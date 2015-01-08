package assertions

import (
	"bytes"
	"io"
	"net/http"
	"testing"
)

func TestShouldHaveSameTypeAs(t *testing.T) {
	serializer = newFakeSerializer()

	fail(t, so(1, ShouldHaveSameTypeAs), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldHaveSameTypeAs, 1, 2, 3), "This assertion requires exactly 1 comparison values (you provided 3).")

	fail(t, so(nil, ShouldHaveSameTypeAs, 0), "int|<nil>|Expected '<nil>' to be: 'int' (but was: '<nil>')!")
	fail(t, so(1, ShouldHaveSameTypeAs, "asdf"), "string|int|Expected '1' to be: 'string' (but was: 'int')!")

	pass(t, so(1, ShouldHaveSameTypeAs, 0))
	pass(t, so(nil, ShouldHaveSameTypeAs, nil))
}

func TestShouldNotHaveSameTypeAs(t *testing.T) {
	fail(t, so(1, ShouldNotHaveSameTypeAs), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldNotHaveSameTypeAs, 1, 2, 3), "This assertion requires exactly 1 comparison values (you provided 3).")

	fail(t, so(1, ShouldNotHaveSameTypeAs, 0), "Expected '1' to NOT be: 'int' (but it was)!")
	fail(t, so(nil, ShouldNotHaveSameTypeAs, nil), "Expected '<nil>' to NOT be: '<nil>' (but it was)!")

	pass(t, so(nil, ShouldNotHaveSameTypeAs, 0))
	pass(t, so(1, ShouldNotHaveSameTypeAs, "asdf"))
}

func TestShouldImplement(t *testing.T) {
	var ioReader *io.Reader = nil
	var response http.Response = http.Response{}
	var responsePtr *http.Response = new(http.Response)
	var reader = bytes.NewBufferString("")

	fail(t, so(reader, ShouldImplement), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(reader, ShouldImplement, ioReader, ioReader), "This assertion requires exactly 1 comparison values (you provided 2).")
	fail(t, so(reader, ShouldImplement, ioReader, ioReader, ioReader), "This assertion requires exactly 1 comparison values (you provided 3).")

	fail(t, so(reader, ShouldImplement, "foo"), shouldCompareWithInterfacePointer)
	fail(t, so(reader, ShouldImplement, 1), shouldCompareWithInterfacePointer)
	fail(t, so(reader, ShouldImplement, nil), shouldCompareWithInterfacePointer)

	fail(t, so(nil, ShouldImplement, ioReader), shouldNotBeNilActual)
	fail(t, so(1, ShouldImplement, ioReader), "Expected: 'io.Reader interface support'\nActual:   '*int' does not implement the interface!")

	fail(t, so(response, ShouldImplement, ioReader), "Expected: 'io.Reader interface support'\nActual:   '*http.Response' does not implement the interface!")
	fail(t, so(responsePtr, ShouldImplement, ioReader), "Expected: 'io.Reader interface support'\nActual:   '*http.Response' does not implement the interface!")
	pass(t, so(reader, ShouldImplement, ioReader))
	pass(t, so(reader, ShouldImplement, (*io.Reader)(nil)))
}

func TestShouldNotImplement(t *testing.T) {
	var ioReader *io.Reader = nil
	var response http.Response = http.Response{}
	var responsePtr *http.Response = new(http.Response)
	var reader io.Reader = bytes.NewBufferString("")

	fail(t, so(reader, ShouldNotImplement), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(reader, ShouldNotImplement, ioReader, ioReader), "This assertion requires exactly 1 comparison values (you provided 2).")
	fail(t, so(reader, ShouldNotImplement, ioReader, ioReader, ioReader), "This assertion requires exactly 1 comparison values (you provided 3).")

	fail(t, so(reader, ShouldNotImplement, "foo"), shouldCompareWithInterfacePointer)
	fail(t, so(reader, ShouldNotImplement, 1), shouldCompareWithInterfacePointer)
	fail(t, so(reader, ShouldNotImplement, nil), shouldCompareWithInterfacePointer)

	fail(t, so(reader, ShouldNotImplement, ioReader), "Expected         '*bytes.Buffer'\nto NOT implement   'io.Reader' (but it did)!")
	fail(t, so(nil, ShouldNotImplement, ioReader), shouldNotBeNilActual)
	pass(t, so(1, ShouldNotImplement, ioReader))
	pass(t, so(response, ShouldNotImplement, ioReader))
	pass(t, so(responsePtr, ShouldNotImplement, ioReader))
}
