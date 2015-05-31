package assertions

import (
	"fmt"
	"reflect"
	"testing"
)

func TestShouldEqual(t *testing.T) {
	serializer = newFakeSerializer()

	fail(t, so(1, ShouldEqual), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldEqual, 1, 2), "This assertion requires exactly 1 comparison values (you provided 2).")
	fail(t, so(1, ShouldEqual, 1, 2, 3), "This assertion requires exactly 1 comparison values (you provided 3).")

	pass(t, so(1, ShouldEqual, 1))
	fail(t, so(1, ShouldEqual, 2), "2|1|Expected: '2' Actual: '1' (Should be equal)")

	pass(t, so(true, ShouldEqual, true))
	fail(t, so(true, ShouldEqual, false), "false|true|Expected: 'false' Actual: 'true' (Should be equal)")

	pass(t, so("hi", ShouldEqual, "hi"))
	fail(t, so("hi", ShouldEqual, "bye"), "bye|hi|Expected: 'bye' Actual: 'hi' (Should be equal)")

	pass(t, so(42, ShouldEqual, uint(42)))

	fail(t, so(Thing1{"hi"}, ShouldEqual, Thing1{}), "{}|{hi}|Expected: '{}' Actual: '{hi}' (Should be equal)")
	fail(t, so(Thing1{"hi"}, ShouldEqual, Thing1{"hi"}), "{hi}|{hi}|Expected: '{hi}' Actual: '{hi}' (Should be equal)")
	fail(t, so(&Thing1{"hi"}, ShouldEqual, &Thing1{"hi"}), "&{hi}|&{hi}|Expected: '&{hi}' Actual: '&{hi}' (Should be equal)")

	fail(t, so(Thing1{}, ShouldEqual, Thing2{}), "{}|{}|Expected: '{}' Actual: '{}' (Should be equal)")
}

func TestShouldNotEqual(t *testing.T) {
	fail(t, so(1, ShouldNotEqual), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldNotEqual, 1, 2), "This assertion requires exactly 1 comparison values (you provided 2).")
	fail(t, so(1, ShouldNotEqual, 1, 2, 3), "This assertion requires exactly 1 comparison values (you provided 3).")

	pass(t, so(1, ShouldNotEqual, 2))
	fail(t, so(1, ShouldNotEqual, 1), "Expected '1' to NOT equal '1' (but it did)!")

	pass(t, so(true, ShouldNotEqual, false))
	fail(t, so(true, ShouldNotEqual, true), "Expected 'true' to NOT equal 'true' (but it did)!")

	pass(t, so("hi", ShouldNotEqual, "bye"))
	fail(t, so("hi", ShouldNotEqual, "hi"), "Expected 'hi' to NOT equal 'hi' (but it did)!")

	pass(t, so(&Thing1{"hi"}, ShouldNotEqual, &Thing1{"hi"}))
	pass(t, so(Thing1{"hi"}, ShouldNotEqual, Thing1{"hi"}))
	pass(t, so(Thing1{}, ShouldNotEqual, Thing1{}))
	pass(t, so(Thing1{}, ShouldNotEqual, Thing2{}))
}

func TestShouldAlmostEqual(t *testing.T) {
	fail(t, so(1, ShouldAlmostEqual), "This assertion requires exactly one comparison value and an optional delta (you provided neither)")
	fail(t, so(1, ShouldAlmostEqual, 1, 2, 3), "This assertion requires exactly one comparison value and an optional delta (you provided more values)")

	// with the default delta
	pass(t, so(1, ShouldAlmostEqual, .99999999999999))
	pass(t, so(1.3612499999999996, ShouldAlmostEqual, 1.36125))
	pass(t, so(0.7285312499999999, ShouldAlmostEqual, 0.72853125))
	fail(t, so(1, ShouldAlmostEqual, .99), "Expected '1' to almost equal '0.99' (but it didn't)!")

	// with a different delta
	pass(t, so(100.0, ShouldAlmostEqual, 110.0, 10.0))
	fail(t, so(100.0, ShouldAlmostEqual, 111.0, 10.5), "Expected '100' to almost equal '111' (but it didn't)!")

	// ints should work
	pass(t, so(100, ShouldAlmostEqual, 100.0))
	fail(t, so(100, ShouldAlmostEqual, 99.0), "Expected '100' to almost equal '99' (but it didn't)!")

	// float32 should work
	pass(t, so(float64(100.0), ShouldAlmostEqual, float32(100.0)))
	fail(t, so(float32(100.0), ShouldAlmostEqual, 99.0, float32(0.1)), "Expected '100' to almost equal '99' (but it didn't)!")
}

func TestShouldNotAlmostEqual(t *testing.T) {
	fail(t, so(1, ShouldNotAlmostEqual), "This assertion requires exactly one comparison value and an optional delta (you provided neither)")
	fail(t, so(1, ShouldNotAlmostEqual, 1, 2, 3), "This assertion requires exactly one comparison value and an optional delta (you provided more values)")

	// with the default delta
	fail(t, so(1, ShouldNotAlmostEqual, .99999999999999), "Expected '1' to NOT almost equal '0.99999999999999' (but it did)!")
	fail(t, so(1.3612499999999996, ShouldNotAlmostEqual, 1.36125), "Expected '1.3612499999999996' to NOT almost equal '1.36125' (but it did)!")
	pass(t, so(1, ShouldNotAlmostEqual, .99))

	// with a different delta
	fail(t, so(100.0, ShouldNotAlmostEqual, 110.0, 10.0), "Expected '100' to NOT almost equal '110' (but it did)!")
	pass(t, so(100.0, ShouldNotAlmostEqual, 111.0, 10.5))

	// ints should work
	fail(t, so(100, ShouldNotAlmostEqual, 100.0), "Expected '100' to NOT almost equal '100' (but it did)!")
	pass(t, so(100, ShouldNotAlmostEqual, 99.0))

	// float32 should work
	fail(t, so(float64(100.0), ShouldNotAlmostEqual, float32(100.0)), "Expected '100' to NOT almost equal '100' (but it did)!")
	pass(t, so(float32(100.0), ShouldNotAlmostEqual, 99.0, float32(0.1)))
}

func TestShouldResemble(t *testing.T) {
	serializer = newFakeSerializer()

	fail(t, so(Thing1{"hi"}, ShouldResemble), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(Thing1{"hi"}, ShouldResemble, Thing1{"hi"}, Thing1{"hi"}), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(Thing1{"hi"}, ShouldResemble, Thing1{"hi"}))
	fail(t, so(Thing1{"hi"}, ShouldResemble, Thing1{"bye"}), "{bye}|{hi}|Expected: 'assertions.Thing1{a:\"bye\"}' Actual: 'assertions.Thing1{a:\"hi\"}' (Should resemble)!")

	var (
		a []int
		b []int = []int{}
	)

	fail(t, so(a, ShouldResemble, b), "[]|[]|Expected: '[]int{}' Actual: '[]int(nil)' (Should resemble)!")
	fail(t, so(2, ShouldResemble, 1), "1|2|Expected: '1' Actual: '2' (Should resemble)!")

	fail(t, so(StringStringMapAlias{"hi": "bye"}, ShouldResemble, map[string]string{"hi": "bye"}),
		"map[hi:bye]|map[hi:bye]|Expected: 'map[string]string{\"hi\":\"bye\"}' Actual: 'assertions.StringStringMapAlias{\"hi\":\"bye\"}' (Should resemble)!")
	fail(t, so(StringSliceAlias{"hi", "bye"}, ShouldResemble, []string{"hi", "bye"}),
		"[hi bye]|[hi bye]|Expected: '[]string{\"hi\", \"bye\"}' Actual: 'assertions.StringSliceAlias{\"hi\", \"bye\"}' (Should resemble)!")

	// some types come out looking the same when represented with "%#v" so we show type mismatch info:
	fail(t, so(StringAlias("hi"), ShouldResemble, "hi"), "hi|hi|Expected: '\"hi\"' Actual: '\"hi\"' (Type mismatch: 'string' vs 'assertions.StringAlias')!")
	fail(t, so(IntAlias(42), ShouldResemble, 42), "42|42|Expected: '42' Actual: '42' (Type mismatch: 'int' vs 'assertions.IntAlias')!")
}

func TestShouldNotResemble(t *testing.T) {
	fail(t, so(Thing1{"hi"}, ShouldNotResemble), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(Thing1{"hi"}, ShouldNotResemble, Thing1{"hi"}, Thing1{"hi"}), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(Thing1{"hi"}, ShouldNotResemble, Thing1{"bye"}))
	fail(t, so(Thing1{"hi"}, ShouldNotResemble, Thing1{"hi"}),
		"Expected 'assertions.Thing1{a:\"hi\"}' to NOT resemble 'assertions.Thing1{a:\"hi\"}' (but it did)!")

	pass(t, so(map[string]string{"hi": "bye"}, ShouldResemble, map[string]string{"hi": "bye"}))
	pass(t, so(IntAlias(42), ShouldNotResemble, 42))

	pass(t, so(StringSliceAlias{"hi", "bye"}, ShouldNotResemble, []string{"hi", "bye"}))
}

func TestShouldPointTo(t *testing.T) {
	serializer = newFakeSerializer()

	t1 := &Thing1{}
	t2 := t1
	t3 := &Thing1{}

	pointer1 := reflect.ValueOf(t1).Pointer()
	pointer3 := reflect.ValueOf(t3).Pointer()

	fail(t, so(t1, ShouldPointTo), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(t1, ShouldPointTo, t2, t3), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(t1, ShouldPointTo, t2))
	fail(t, so(t1, ShouldPointTo, t3), fmt.Sprintf(
		"%v|%v|Expected '&{a:}' (address: '%v') and '&{a:}' (address: '%v') to be the same address (but their weren't)!",
		pointer3, pointer1, pointer1, pointer3))

	t4 := Thing1{}
	t5 := t4

	fail(t, so(t4, ShouldPointTo, t5), "Both arguments should be pointers (the first was not)!")
	fail(t, so(&t4, ShouldPointTo, t5), "Both arguments should be pointers (the second was not)!")
	fail(t, so(nil, ShouldPointTo, nil), "Both arguments should be pointers (the first was nil)!")
	fail(t, so(&t4, ShouldPointTo, nil), "Both arguments should be pointers (the second was nil)!")
}

func TestShouldNotPointTo(t *testing.T) {
	t1 := &Thing1{}
	t2 := t1
	t3 := &Thing1{}

	pointer1 := reflect.ValueOf(t1).Pointer()

	fail(t, so(t1, ShouldNotPointTo), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(t1, ShouldNotPointTo, t2, t3), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(t1, ShouldNotPointTo, t3))
	fail(t, so(t1, ShouldNotPointTo, t2), fmt.Sprintf("Expected '&{a:}' and '&{a:}' to be different references (but they matched: '%v')!", pointer1))

	t4 := Thing1{}
	t5 := t4

	fail(t, so(t4, ShouldNotPointTo, t5), "Both arguments should be pointers (the first was not)!")
	fail(t, so(&t4, ShouldNotPointTo, t5), "Both arguments should be pointers (the second was not)!")
	fail(t, so(nil, ShouldNotPointTo, nil), "Both arguments should be pointers (the first was nil)!")
	fail(t, so(&t4, ShouldNotPointTo, nil), "Both arguments should be pointers (the second was nil)!")
}

func TestShouldBeNil(t *testing.T) {
	fail(t, so(nil, ShouldBeNil, nil, nil, nil), "This assertion requires exactly 0 comparison values (you provided 3).")
	fail(t, so(nil, ShouldBeNil, nil), "This assertion requires exactly 0 comparison values (you provided 1).")

	pass(t, so(nil, ShouldBeNil))
	fail(t, so(1, ShouldBeNil), "Expected: nil Actual: '1'")

	var thing Thinger
	pass(t, so(thing, ShouldBeNil))
	thing = &Thing{}
	fail(t, so(thing, ShouldBeNil), "Expected: nil Actual: '&{}'")

	var thingOne *Thing1
	pass(t, so(thingOne, ShouldBeNil))

	var nilSlice []int = nil
	pass(t, so(nilSlice, ShouldBeNil))

	var nilMap map[string]string = nil
	pass(t, so(nilMap, ShouldBeNil))

	var nilChannel chan int = nil
	pass(t, so(nilChannel, ShouldBeNil))

	var nilFunc func() = nil
	pass(t, so(nilFunc, ShouldBeNil))

	var nilInterface interface{} = nil
	pass(t, so(nilInterface, ShouldBeNil))
}

func TestShouldNotBeNil(t *testing.T) {
	fail(t, so(nil, ShouldNotBeNil, nil, nil, nil), "This assertion requires exactly 0 comparison values (you provided 3).")
	fail(t, so(nil, ShouldNotBeNil, nil), "This assertion requires exactly 0 comparison values (you provided 1).")

	fail(t, so(nil, ShouldNotBeNil), "Expected '<nil>' to NOT be nil (but it was)!")
	pass(t, so(1, ShouldNotBeNil))

	var thing Thinger
	fail(t, so(thing, ShouldNotBeNil), "Expected '<nil>' to NOT be nil (but it was)!")
	thing = &Thing{}
	pass(t, so(thing, ShouldNotBeNil))
}

func TestShouldBeTrue(t *testing.T) {
	fail(t, so(true, ShouldBeTrue, 1, 2, 3), "This assertion requires exactly 0 comparison values (you provided 3).")
	fail(t, so(true, ShouldBeTrue, 1), "This assertion requires exactly 0 comparison values (you provided 1).")

	fail(t, so(false, ShouldBeTrue), "Expected: true Actual: false")
	fail(t, so(1, ShouldBeTrue), "Expected: true Actual: 1")
	pass(t, so(true, ShouldBeTrue))
}

func TestShouldBeFalse(t *testing.T) {
	fail(t, so(false, ShouldBeFalse, 1, 2, 3), "This assertion requires exactly 0 comparison values (you provided 3).")
	fail(t, so(false, ShouldBeFalse, 1), "This assertion requires exactly 0 comparison values (you provided 1).")

	fail(t, so(true, ShouldBeFalse), "Expected: false Actual: true")
	fail(t, so(1, ShouldBeFalse), "Expected: false Actual: 1")
	pass(t, so(false, ShouldBeFalse))
}

func TestShouldBeZeroValue(t *testing.T) {
	serializer = newFakeSerializer()

	fail(t, so(0, ShouldBeZeroValue, 1, 2, 3), "This assertion requires exactly 0 comparison values (you provided 3).")
	fail(t, so(false, ShouldBeZeroValue, true), "This assertion requires exactly 0 comparison values (you provided 1).")

	fail(t, so(1, ShouldBeZeroValue), "0|1|'1' should have been the zero value")                                       //"Expected: (zero value) Actual: 1")
	fail(t, so(true, ShouldBeZeroValue), "false|true|'true' should have been the zero value")                          //"Expected: (zero value) Actual: true")
	fail(t, so("123", ShouldBeZeroValue), "|123|'123' should have been the zero value")                                //"Expected: (zero value) Actual: 123")
	fail(t, so(" ", ShouldBeZeroValue), "| |' ' should have been the zero value")                                      //"Expected: (zero value) Actual:  ")
	fail(t, so([]string{"Nonempty"}, ShouldBeZeroValue), "[]|[Nonempty]|'[Nonempty]' should have been the zero value") //"Expected: (zero value) Actual: [Nonempty]")
	fail(t, so(struct{ a string }{a: "asdf"}, ShouldBeZeroValue), "{}|{asdf}|'{a:asdf}' should have been the zero value")
	pass(t, so(0, ShouldBeZeroValue))
	pass(t, so(false, ShouldBeZeroValue))
	pass(t, so("", ShouldBeZeroValue))
	pass(t, so(struct{}{}, ShouldBeZeroValue))
}
