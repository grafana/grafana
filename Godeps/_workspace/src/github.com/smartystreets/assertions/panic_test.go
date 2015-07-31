package assertions

import (
	"fmt"
	"testing"
)

func TestShouldPanic(t *testing.T) {
	fail(t, so(func() {}, ShouldPanic, 1), "This assertion requires exactly 0 comparison values (you provided 1).")
	fail(t, so(func() {}, ShouldPanic, 1, 2, 3), "This assertion requires exactly 0 comparison values (you provided 3).")

	fail(t, so(1, ShouldPanic), shouldUseVoidNiladicFunction)
	fail(t, so(func(i int) {}, ShouldPanic), shouldUseVoidNiladicFunction)
	fail(t, so(func() int { panic("hi") }, ShouldPanic), shouldUseVoidNiladicFunction)

	fail(t, so(func() {}, ShouldPanic), shouldHavePanicked)
	pass(t, so(func() { panic("hi") }, ShouldPanic))
}

func TestShouldNotPanic(t *testing.T) {
	fail(t, so(func() {}, ShouldNotPanic, 1), "This assertion requires exactly 0 comparison values (you provided 1).")
	fail(t, so(func() {}, ShouldNotPanic, 1, 2, 3), "This assertion requires exactly 0 comparison values (you provided 3).")

	fail(t, so(1, ShouldNotPanic), shouldUseVoidNiladicFunction)
	fail(t, so(func(i int) {}, ShouldNotPanic), shouldUseVoidNiladicFunction)

	fail(t, so(func() { panic("hi") }, ShouldNotPanic), fmt.Sprintf(shouldNotHavePanicked, "hi"))
	pass(t, so(func() {}, ShouldNotPanic))
}

func TestShouldPanicWith(t *testing.T) {
	fail(t, so(func() {}, ShouldPanicWith), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(func() {}, ShouldPanicWith, 1, 2, 3), "This assertion requires exactly 1 comparison values (you provided 3).")

	fail(t, so(1, ShouldPanicWith, 1), shouldUseVoidNiladicFunction)
	fail(t, so(func(i int) {}, ShouldPanicWith, "hi"), shouldUseVoidNiladicFunction)
	fail(t, so(func() {}, ShouldPanicWith, "bye"), shouldHavePanicked)
	fail(t, so(func() { panic("hi") }, ShouldPanicWith, "bye"), "bye|hi|Expected func() to panic with 'bye' (but it panicked with 'hi')!")

	pass(t, so(func() { panic("hi") }, ShouldPanicWith, "hi"))
}

func TestShouldNotPanicWith(t *testing.T) {
	fail(t, so(func() {}, ShouldNotPanicWith), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(func() {}, ShouldNotPanicWith, 1, 2, 3), "This assertion requires exactly 1 comparison values (you provided 3).")

	fail(t, so(1, ShouldNotPanicWith, 1), shouldUseVoidNiladicFunction)
	fail(t, so(func(i int) {}, ShouldNotPanicWith, "hi"), shouldUseVoidNiladicFunction)
	fail(t, so(func() { panic("hi") }, ShouldNotPanicWith, "hi"), "Expected func() NOT to panic with 'hi' (but it did)!")

	pass(t, so(func() {}, ShouldNotPanicWith, "bye"))
	pass(t, so(func() { panic("hi") }, ShouldNotPanicWith, "bye"))
}
