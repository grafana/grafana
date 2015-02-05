package convey

import "testing"

func TestFocusOnlyAtTopLevel(t *testing.T) {
	output := prepare()

	FocusConvey("hi", t, func() {
		output += "done"
	})

	expectEqual(t, "done", output)
}

func TestFocus(t *testing.T) {
	output := prepare()

	FocusConvey("hi", t, func() {
		output += "1"

		Convey("bye", func() {
			output += "2"
		})
	})

	expectEqual(t, "1", output)
}

func TestNestedFocus(t *testing.T) {
	output := prepare()

	FocusConvey("hi", t, func() {
		output += "1"

		Convey("This shouldn't run", func() {
			output += "boink!"
		})

		FocusConvey("This should run", func() {
			output += "2"

			FocusConvey("The should run too", func() {
				output += "3"

			})

			Convey("The should NOT run", func() {
				output += "blah blah blah!"
			})
		})
	})

	expectEqual(t, "123", output)
}

func TestForgotTopLevelFocus(t *testing.T) {
	output := prepare()

	Convey("1", t, func() {
		output += "1"

		FocusConvey("This will be run because the top-level lacks Focus", func() {
			output += "2"
		})

		Convey("3", func() {
			output += "3"
		})
	})

	expectEqual(t, "1213", output)
}
