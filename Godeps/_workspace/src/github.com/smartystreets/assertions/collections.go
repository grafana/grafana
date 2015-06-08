package assertions

import (
	"fmt"
	"reflect"

	"github.com/smartystreets/assertions/internal/oglematchers"
)

// ShouldContain receives exactly two parameters. The first is a slice and the
// second is a proposed member. Membership is determined using ShouldEqual.
func ShouldContain(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	if matchError := oglematchers.Contains(expected[0]).Matches(actual); matchError != nil {
		typeName := reflect.TypeOf(actual)

		if fmt.Sprintf("%v", matchError) == "which is not a slice or array" {
			return fmt.Sprintf(shouldHaveBeenAValidCollection, typeName)
		}
		return fmt.Sprintf(shouldHaveContained, typeName, expected[0])
	}
	return success
}

// ShouldNotContain receives exactly two parameters. The first is a slice and the
// second is a proposed member. Membership is determinied using ShouldEqual.
func ShouldNotContain(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}
	typeName := reflect.TypeOf(actual)

	if matchError := oglematchers.Contains(expected[0]).Matches(actual); matchError != nil {
		if fmt.Sprintf("%v", matchError) == "which is not a slice or array" {
			return fmt.Sprintf(shouldHaveBeenAValidCollection, typeName)
		}
		return success
	}
	return fmt.Sprintf(shouldNotHaveContained, typeName, expected[0])
}

// ShouldBeIn receives at least 2 parameters. The first is a proposed member of the collection
// that is passed in either as the second parameter, or of the collection that is comprised
// of all the remaining parameters. This assertion ensures that the proposed member is in
// the collection (using ShouldEqual).
func ShouldBeIn(actual interface{}, expected ...interface{}) string {
	if fail := atLeast(1, expected); fail != success {
		return fail
	}

	if len(expected) == 1 {
		return shouldBeIn(actual, expected[0])
	}
	return shouldBeIn(actual, expected)
}
func shouldBeIn(actual interface{}, expected interface{}) string {
	if matchError := oglematchers.Contains(actual).Matches(expected); matchError != nil {
		return fmt.Sprintf(shouldHaveBeenIn, actual, reflect.TypeOf(expected))
	}
	return success
}

// ShouldNotBeIn receives at least 2 parameters. The first is a proposed member of the collection
// that is passed in either as the second parameter, or of the collection that is comprised
// of all the remaining parameters. This assertion ensures that the proposed member is NOT in
// the collection (using ShouldEqual).
func ShouldNotBeIn(actual interface{}, expected ...interface{}) string {
	if fail := atLeast(1, expected); fail != success {
		return fail
	}

	if len(expected) == 1 {
		return shouldNotBeIn(actual, expected[0])
	}
	return shouldNotBeIn(actual, expected)
}
func shouldNotBeIn(actual interface{}, expected interface{}) string {
	if matchError := oglematchers.Contains(actual).Matches(expected); matchError == nil {
		return fmt.Sprintf(shouldNotHaveBeenIn, actual, reflect.TypeOf(expected))
	}
	return success
}

// ShouldBeEmpty receives a single parameter (actual) and determines whether or not
// calling len(actual) would return `0`. It obeys the rules specified by the len
// function for determining length: http://golang.org/pkg/builtin/#len
func ShouldBeEmpty(actual interface{}, expected ...interface{}) string {
	if fail := need(0, expected); fail != success {
		return fail
	}

	if actual == nil {
		return success
	}

	value := reflect.ValueOf(actual)
	switch value.Kind() {
	case reflect.Slice:
		if value.Len() == 0 {
			return success
		}
	case reflect.Chan:
		if value.Len() == 0 {
			return success
		}
	case reflect.Map:
		if value.Len() == 0 {
			return success
		}
	case reflect.String:
		if value.Len() == 0 {
			return success
		}
	case reflect.Ptr:
		elem := value.Elem()
		kind := elem.Kind()
		if (kind == reflect.Slice || kind == reflect.Array) && elem.Len() == 0 {
			return success
		}
	}

	return fmt.Sprintf(shouldHaveBeenEmpty, actual)
}

// ShouldNotBeEmpty receives a single parameter (actual) and determines whether or not
// calling len(actual) would return a value greater than zero. It obeys the rules
// specified by the `len` function for determining length: http://golang.org/pkg/builtin/#len
func ShouldNotBeEmpty(actual interface{}, expected ...interface{}) string {
	if fail := need(0, expected); fail != success {
		return fail
	}

	if empty := ShouldBeEmpty(actual, expected...); empty != success {
		return success
	}
	return fmt.Sprintf(shouldNotHaveBeenEmpty, actual)
}
