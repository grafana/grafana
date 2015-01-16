package convey

type actionSpecifier uint8

const (
	noSpecifier actionSpecifier = iota
	skipConvey
	focusConvey
)

type suite struct {
	Situation string
	Test      t
	Focus     bool
	Func      func(C) // nil means skipped
	FailMode  FailureMode
}

func newSuite(situation string, failureMode FailureMode, f func(C), test t, specifier actionSpecifier) *suite {
	ret := &suite{
		Situation: situation,
		Test:      test,
		Func:      f,
		FailMode:  failureMode,
	}
	switch specifier {
	case skipConvey:
		ret.Func = nil
	case focusConvey:
		ret.Focus = true
	}
	return ret
}

func discover(items []interface{}) *suite {
	name, items := parseName(items)
	test, items := parseGoTest(items)
	failure, items := parseFailureMode(items)
	action, items := parseAction(items)
	specifier, items := parseSpecifier(items)

	if len(items) != 0 {
		conveyPanic(parseError)
	}

	return newSuite(name, failure, action, test, specifier)
}
func item(items []interface{}) interface{} {
	if len(items) == 0 {
		conveyPanic(parseError)
	}
	return items[0]
}
func parseName(items []interface{}) (string, []interface{}) {
	if name, parsed := item(items).(string); parsed {
		return name, items[1:]
	}
	conveyPanic(parseError)
	panic("never get here")
}
func parseGoTest(items []interface{}) (t, []interface{}) {
	if test, parsed := item(items).(t); parsed {
		return test, items[1:]
	}
	return nil, items
}
func parseFailureMode(items []interface{}) (FailureMode, []interface{}) {
	if mode, parsed := item(items).(FailureMode); parsed {
		return mode, items[1:]
	}
	return FailureInherits, items
}
func parseAction(items []interface{}) (func(C), []interface{}) {
	switch x := item(items).(type) {
	case nil:
		return nil, items[1:]
	case func(C):
		return x, items[1:]
	case func():
		return func(C) { x() }, items[1:]
	}
	conveyPanic(parseError)
	panic("never get here")
}
func parseSpecifier(items []interface{}) (actionSpecifier, []interface{}) {
	if len(items) == 0 {
		return noSpecifier, items
	}
	if spec, ok := items[0].(actionSpecifier); ok {
		return spec, items[1:]
	}
	conveyPanic(parseError)
	panic("never get here")
}

// This interface allows us to pass the *testing.T struct
// throughout the internals of this package without ever
// having to import the "testing" package.
type t interface {
	Fail()
}

const parseError = "You must provide a name (string), then a *testing.T (if in outermost scope), an optional FailureMode, and then an action (func())."
