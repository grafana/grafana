package convey

import (
	"fmt"
	"strings"
	"testing"
)

func TestMissingTopLevelGoTestReferenceCausesPanic(t *testing.T) {
	output := map[string]bool{}

	defer expectEqual(t, false, output["good"])
	defer requireGoTestReference(t)

	Convey("Hi", func() {
		output["bad"] = true // this shouldn't happen
	})
}

func requireGoTestReference(t *testing.T) {
	err := recover()
	if err == nil {
		t.Error("We should have recovered a panic here (because of a missing *testing.T reference)!")
	} else {
		expectEqual(t, missingGoTest, err)
	}
}

func TestMissingTopLevelGoTestReferenceAfterGoodExample(t *testing.T) {
	output := map[string]bool{}

	defer func() {
		expectEqual(t, true, output["good"])
		expectEqual(t, false, output["bad"])
	}()
	defer requireGoTestReference(t)

	Convey("Good example", t, func() {
		output["good"] = true
	})

	Convey("Bad example", func() {
		output["bad"] = true // shouldn't happen
	})
}

func TestExtraReferencePanics(t *testing.T) {
	output := map[string]bool{}

	defer func() {
		err := recover()
		if err == nil {
			t.Error("We should have recovered a panic here (because of an extra *testing.T reference)!")
		} else if !strings.HasPrefix(fmt.Sprintf("%v", err), extraGoTest) {
			t.Error("Should have panicked with the 'extra go test' error!")
		}
		if output["bad"] {
			t.Error("We should NOT have run the bad example!")
		}
	}()

	Convey("Good example", t, func() {
		Convey("Bad example - passing in *testing.T a second time!", t, func() {
			output["bad"] = true // shouldn't happen
		})
	})
}

func TestParseRegistrationMissingRequiredElements(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			if r != "You must provide a name (string), then a *testing.T (if in outermost scope), an optional FailureMode, and then an action (func())." {
				t.Errorf("Incorrect panic message.")
			}
		}
	}()

	Convey()

	t.Errorf("goTest should have panicked in Convey(...) and then recovered in the defer func().")
}

func TestParseRegistration_MissingNameString(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			if r != parseError {
				t.Errorf("Incorrect panic message.")
			}
		}
	}()

	action := func() {}

	Convey(action)

	t.Errorf("goTest should have panicked in Convey(...) and then recovered in the defer func().")
}

func TestParseRegistration_MissingActionFunc(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			if r != parseError {
				t.Errorf("Incorrect panic message: '%s'", r)
			}
		}
	}()

	Convey("Hi there", 12345)

	t.Errorf("goTest should have panicked in Convey(...) and then recovered in the defer func().")
}

func TestFailureModeParameterButMissing(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			if r != parseError {
				t.Errorf("Incorrect panic message.")
			}
		} else {
			t.Errorf("Expected panic")
		}
	}()

	prepare()

	Convey("Foobar", t, FailureHalts)
}

func TestFailureModeParameterWithAction(t *testing.T) {
	prepare()

	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Unexpected panic")
		}
	}()

	Convey("Foobar", t, FailureHalts, func() {})
}

func TestExtraConveyParameters(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			if r != parseError {
				t.Errorf("Incorrect panic message.")
			}
		} else {
			t.Errorf("Expected panic")
		}
	}()

	prepare()

	Convey("Foobar", t, FailureHalts, func() {}, "This is not supposed to be here")
}

func TestExtraConveyParameters2(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			if r != parseError {
				t.Errorf("Incorrect panic message.")
			}
		} else {
			t.Errorf("Expected panic")
		}
	}()

	prepare()

	Convey("Foobar", t, func() {}, "This is not supposed to be here")
}

func TestExtraConveyParameters3(t *testing.T) {
	output := prepare()

	Convey("A", t, func() {
		output += "A "

		Convey("B", func() {
			output += "B "
		}, "This is not supposed to be here")
	})

	expectEqual(t, "A ", output)
}
