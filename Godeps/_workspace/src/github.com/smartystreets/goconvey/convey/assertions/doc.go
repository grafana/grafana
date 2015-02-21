// Package assertions contains the implementations for all assertions which
// are referenced in the convey package for use with the So(...) method.
package assertions

// By default we use this serializer to provide a JSON representation
// of failure results on selected assertions so the web UI can display
// a convenient diff.
var serializer Serializer = newSerializer()

// StandaloneMode provides control over JSON serialization of failures. When
// using the assertions in this package outside of the convey package JSON results
// aren't generally helpful. In that case, call this function with a value of 'true'
// (maybe in an 'init' function) before using the So function (below) for standalone
// assertions. Calling this function with a value of 'false' will restore the default
// JSON serialization behavior.
func StandaloneMode(yes bool) {
	if yes {
		serializer = new(noopSerializer)
	} else {
		serializer = newSerializer()
	}
}

// This function is not used by the goconvey library. It's actually a convenience method
// for running assertions on arbitrary arguments outside of any testing context, like for
// application logging. It allows you to perform assertion-like behavior (and get nicely
// formatted messages detailing discrepancies) but without the probram blowing up or panicking.
// All that is required is to import this package and call `So` with one of the assertions
// exported by this package as the second parameter.
// The first return parameter is a boolean indicating if the assertion was true. The second
// return parameter is the well-formatted message showing why an assertion was incorrect, or
// blank if the assertion was correct.
//
// Example:
//
//   if ok, message := So(x, ShouldBeGreaterThan, y); !ok {
//        log.Println(message)
//   }
//
func So(actual interface{}, assert assertion, expected ...interface{}) (bool, string) {
	if result := so(actual, assert, expected...); len(result) == 0 {
		return true, result
	} else {
		return false, result
	}
}

// so is like So, except that it only returns the string message, which is blank if the
// assertion passed. Used to facilitate testing.
func so(actual interface{}, assert func(interface{}, ...interface{}) string, expected ...interface{}) string {
	return assert(actual, expected...)
}

// assertion is an alias for a function with a signature that the So()
// function can handle. Any future or custom assertions should conform to this
// method signature. The return value should be an empty string if the assertion
// passes and a well-formed failure message if not.
type assertion func(actual interface{}, expected ...interface{}) string

////////////////////////////////////////////////////////////////////////////
