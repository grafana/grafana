// Package assertions contains the implementations for all assertions which
// are referenced in the convey package for use with the So(...) method.
package assertions

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
	serializer = noop

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
