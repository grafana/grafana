package assertions

import "testing"

func TestShouldBeGreaterThan(t *testing.T) {
	fail(t, so(1, ShouldBeGreaterThan), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldBeGreaterThan, 0, 0), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(1, ShouldBeGreaterThan, 0))
	pass(t, so(1.1, ShouldBeGreaterThan, 1))
	pass(t, so(1, ShouldBeGreaterThan, uint(0)))
	pass(t, so("b", ShouldBeGreaterThan, "a"))

	fail(t, so(0, ShouldBeGreaterThan, 1), "Expected '0' to be greater than '1' (but it wasn't)!")
	fail(t, so(1, ShouldBeGreaterThan, 1.1), "Expected '1' to be greater than '1.1' (but it wasn't)!")
	fail(t, so(uint(0), ShouldBeGreaterThan, 1.1), "Expected '0' to be greater than '1.1' (but it wasn't)!")
	fail(t, so("a", ShouldBeGreaterThan, "b"), "Expected 'a' to be greater than 'b' (but it wasn't)!")
}

func TestShouldBeGreaterThanOrEqual(t *testing.T) {
	fail(t, so(1, ShouldBeGreaterThanOrEqualTo), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldBeGreaterThanOrEqualTo, 0, 0), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(1, ShouldBeGreaterThanOrEqualTo, 1))
	pass(t, so(1.1, ShouldBeGreaterThanOrEqualTo, 1.1))
	pass(t, so(1, ShouldBeGreaterThanOrEqualTo, uint(1)))
	pass(t, so("b", ShouldBeGreaterThanOrEqualTo, "b"))

	pass(t, so(1, ShouldBeGreaterThanOrEqualTo, 0))
	pass(t, so(1.1, ShouldBeGreaterThanOrEqualTo, 1))
	pass(t, so(1, ShouldBeGreaterThanOrEqualTo, uint(0)))
	pass(t, so("b", ShouldBeGreaterThanOrEqualTo, "a"))

	fail(t, so(0, ShouldBeGreaterThanOrEqualTo, 1), "Expected '0' to be greater than or equal to '1' (but it wasn't)!")
	fail(t, so(1, ShouldBeGreaterThanOrEqualTo, 1.1), "Expected '1' to be greater than or equal to '1.1' (but it wasn't)!")
	fail(t, so(uint(0), ShouldBeGreaterThanOrEqualTo, 1.1), "Expected '0' to be greater than or equal to '1.1' (but it wasn't)!")
	fail(t, so("a", ShouldBeGreaterThanOrEqualTo, "b"), "Expected 'a' to be greater than or equal to 'b' (but it wasn't)!")
}

func TestShouldBeLessThan(t *testing.T) {
	fail(t, so(1, ShouldBeLessThan), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldBeLessThan, 0, 0), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(0, ShouldBeLessThan, 1))
	pass(t, so(1, ShouldBeLessThan, 1.1))
	pass(t, so(uint(0), ShouldBeLessThan, 1))
	pass(t, so("a", ShouldBeLessThan, "b"))

	fail(t, so(1, ShouldBeLessThan, 0), "Expected '1' to be less than '0' (but it wasn't)!")
	fail(t, so(1.1, ShouldBeLessThan, 1), "Expected '1.1' to be less than '1' (but it wasn't)!")
	fail(t, so(1.1, ShouldBeLessThan, uint(0)), "Expected '1.1' to be less than '0' (but it wasn't)!")
	fail(t, so("b", ShouldBeLessThan, "a"), "Expected 'b' to be less than 'a' (but it wasn't)!")
}

func TestShouldBeLessThanOrEqualTo(t *testing.T) {
	fail(t, so(1, ShouldBeLessThanOrEqualTo), "This assertion requires exactly 1 comparison values (you provided 0).")
	fail(t, so(1, ShouldBeLessThanOrEqualTo, 0, 0), "This assertion requires exactly 1 comparison values (you provided 2).")

	pass(t, so(1, ShouldBeLessThanOrEqualTo, 1))
	pass(t, so(1.1, ShouldBeLessThanOrEqualTo, 1.1))
	pass(t, so(uint(1), ShouldBeLessThanOrEqualTo, 1))
	pass(t, so("b", ShouldBeLessThanOrEqualTo, "b"))

	pass(t, so(0, ShouldBeLessThanOrEqualTo, 1))
	pass(t, so(1, ShouldBeLessThanOrEqualTo, 1.1))
	pass(t, so(uint(0), ShouldBeLessThanOrEqualTo, 1))
	pass(t, so("a", ShouldBeLessThanOrEqualTo, "b"))

	fail(t, so(1, ShouldBeLessThanOrEqualTo, 0), "Expected '1' to be less than '0' (but it wasn't)!")
	fail(t, so(1.1, ShouldBeLessThanOrEqualTo, 1), "Expected '1.1' to be less than '1' (but it wasn't)!")
	fail(t, so(1.1, ShouldBeLessThanOrEqualTo, uint(0)), "Expected '1.1' to be less than '0' (but it wasn't)!")
	fail(t, so("b", ShouldBeLessThanOrEqualTo, "a"), "Expected 'b' to be less than 'a' (but it wasn't)!")
}

func TestShouldBeBetween(t *testing.T) {
	fail(t, so(1, ShouldBeBetween), "This assertion requires exactly 2 comparison values (you provided 0).")
	fail(t, so(1, ShouldBeBetween, 1, 2, 3), "This assertion requires exactly 2 comparison values (you provided 3).")

	fail(t, so(4, ShouldBeBetween, 1, 1), "The lower and upper bounds must be different values (they were both '1').")

	fail(t, so(7, ShouldBeBetween, 8, 12), "Expected '7' to be between '8' and '12' (but it wasn't)!")
	fail(t, so(8, ShouldBeBetween, 8, 12), "Expected '8' to be between '8' and '12' (but it wasn't)!")
	pass(t, so(9, ShouldBeBetween, 8, 12))
	pass(t, so(10, ShouldBeBetween, 8, 12))
	pass(t, so(11, ShouldBeBetween, 8, 12))
	fail(t, so(12, ShouldBeBetween, 8, 12), "Expected '12' to be between '8' and '12' (but it wasn't)!")
	fail(t, so(13, ShouldBeBetween, 8, 12), "Expected '13' to be between '8' and '12' (but it wasn't)!")

	pass(t, so(1, ShouldBeBetween, 2, 0))
	fail(t, so(-1, ShouldBeBetween, 2, 0), "Expected '-1' to be between '0' and '2' (but it wasn't)!")
}

func TestShouldNotBeBetween(t *testing.T) {
	fail(t, so(1, ShouldNotBeBetween), "This assertion requires exactly 2 comparison values (you provided 0).")
	fail(t, so(1, ShouldNotBeBetween, 1, 2, 3), "This assertion requires exactly 2 comparison values (you provided 3).")

	fail(t, so(4, ShouldNotBeBetween, 1, 1), "The lower and upper bounds must be different values (they were both '1').")

	pass(t, so(7, ShouldNotBeBetween, 8, 12))
	pass(t, so(8, ShouldNotBeBetween, 8, 12))
	fail(t, so(9, ShouldNotBeBetween, 8, 12), "Expected '9' NOT to be between '8' and '12' (but it was)!")
	fail(t, so(10, ShouldNotBeBetween, 8, 12), "Expected '10' NOT to be between '8' and '12' (but it was)!")
	fail(t, so(11, ShouldNotBeBetween, 8, 12), "Expected '11' NOT to be between '8' and '12' (but it was)!")
	pass(t, so(12, ShouldNotBeBetween, 8, 12))
	pass(t, so(13, ShouldNotBeBetween, 8, 12))

	pass(t, so(-1, ShouldNotBeBetween, 2, 0))
	fail(t, so(1, ShouldNotBeBetween, 2, 0), "Expected '1' NOT to be between '0' and '2' (but it was)!")
}

func TestShouldBeBetweenOrEqual(t *testing.T) {
	fail(t, so(1, ShouldBeBetweenOrEqual), "This assertion requires exactly 2 comparison values (you provided 0).")
	fail(t, so(1, ShouldBeBetweenOrEqual, 1, 2, 3), "This assertion requires exactly 2 comparison values (you provided 3).")

	fail(t, so(4, ShouldBeBetweenOrEqual, 1, 1), "The lower and upper bounds must be different values (they were both '1').")

	fail(t, so(7, ShouldBeBetweenOrEqual, 8, 12), "Expected '7' to be between '8' and '12' or equal to one of them (but it wasn't)!")
	pass(t, so(8, ShouldBeBetweenOrEqual, 8, 12))
	pass(t, so(9, ShouldBeBetweenOrEqual, 8, 12))
	pass(t, so(10, ShouldBeBetweenOrEqual, 8, 12))
	pass(t, so(11, ShouldBeBetweenOrEqual, 8, 12))
	pass(t, so(12, ShouldBeBetweenOrEqual, 8, 12))
	fail(t, so(13, ShouldBeBetweenOrEqual, 8, 12), "Expected '13' to be between '8' and '12' or equal to one of them (but it wasn't)!")

	pass(t, so(1, ShouldBeBetweenOrEqual, 2, 0))
	fail(t, so(-1, ShouldBeBetweenOrEqual, 2, 0), "Expected '-1' to be between '0' and '2' or equal to one of them (but it wasn't)!")
}

func TestShouldNotBeBetweenOrEqual(t *testing.T) {
	fail(t, so(1, ShouldNotBeBetweenOrEqual), "This assertion requires exactly 2 comparison values (you provided 0).")
	fail(t, so(1, ShouldNotBeBetweenOrEqual, 1, 2, 3), "This assertion requires exactly 2 comparison values (you provided 3).")

	fail(t, so(4, ShouldNotBeBetweenOrEqual, 1, 1), "The lower and upper bounds must be different values (they were both '1').")

	pass(t, so(7, ShouldNotBeBetweenOrEqual, 8, 12))
	fail(t, so(8, ShouldNotBeBetweenOrEqual, 8, 12), "Expected '8' NOT to be between '8' and '12' or equal to one of them (but it was)!")
	fail(t, so(9, ShouldNotBeBetweenOrEqual, 8, 12), "Expected '9' NOT to be between '8' and '12' or equal to one of them (but it was)!")
	fail(t, so(10, ShouldNotBeBetweenOrEqual, 8, 12), "Expected '10' NOT to be between '8' and '12' or equal to one of them (but it was)!")
	fail(t, so(11, ShouldNotBeBetweenOrEqual, 8, 12), "Expected '11' NOT to be between '8' and '12' or equal to one of them (but it was)!")
	fail(t, so(12, ShouldNotBeBetweenOrEqual, 8, 12), "Expected '12' NOT to be between '8' and '12' or equal to one of them (but it was)!")
	pass(t, so(13, ShouldNotBeBetweenOrEqual, 8, 12))

	pass(t, so(-1, ShouldNotBeBetweenOrEqual, 2, 0))
	fail(t, so(1, ShouldNotBeBetweenOrEqual, 2, 0), "Expected '1' NOT to be between '0' and '2' or equal to one of them (but it was)!")
}
