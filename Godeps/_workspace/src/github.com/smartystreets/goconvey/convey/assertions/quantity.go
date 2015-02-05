package assertions

import (
	"fmt"

	"github.com/smartystreets/goconvey/convey/assertions/oglematchers"
)

// ShouldBeGreaterThan receives exactly two parameters and ensures that the first is greater than the second.
func ShouldBeGreaterThan(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	if matchError := oglematchers.GreaterThan(expected[0]).Matches(actual); matchError != nil {
		return fmt.Sprintf(shouldHaveBeenGreater, actual, expected[0])
	}
	return success
}

// ShouldBeGreaterThanOrEqualTo receives exactly two parameters and ensures that the first is greater than or equal to the second.
func ShouldBeGreaterThanOrEqualTo(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	} else if matchError := oglematchers.GreaterOrEqual(expected[0]).Matches(actual); matchError != nil {
		return fmt.Sprintf(shouldHaveBeenGreaterOrEqual, actual, expected[0])
	}
	return success
}

// ShouldBeLessThan receives exactly two parameters and ensures that the first is less than the second.
func ShouldBeLessThan(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	} else if matchError := oglematchers.LessThan(expected[0]).Matches(actual); matchError != nil {
		return fmt.Sprintf(shouldHaveBeenLess, actual, expected[0])
	}
	return success
}

// ShouldBeLessThan receives exactly two parameters and ensures that the first is less than or equal to the second.
func ShouldBeLessThanOrEqualTo(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	} else if matchError := oglematchers.LessOrEqual(expected[0]).Matches(actual); matchError != nil {
		return fmt.Sprintf(shouldHaveBeenLess, actual, expected[0])
	}
	return success
}

// ShouldBeBetween receives exactly three parameters: an actual value, a lower bound, and an upper bound.
// It ensures that the actual value is between both bounds (but not equal to either of them).
func ShouldBeBetween(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	lower, upper, fail := deriveBounds(expected)

	if fail != success {
		return fail
	} else if !isBetween(actual, lower, upper) {
		return fmt.Sprintf(shouldHaveBeenBetween, actual, lower, upper)
	}
	return success
}

// ShouldNotBeBetween receives exactly three parameters: an actual value, a lower bound, and an upper bound.
// It ensures that the actual value is NOT between both bounds.
func ShouldNotBeBetween(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	lower, upper, fail := deriveBounds(expected)

	if fail != success {
		return fail
	} else if isBetween(actual, lower, upper) {
		return fmt.Sprintf(shouldNotHaveBeenBetween, actual, lower, upper)
	}
	return success
}
func deriveBounds(values []interface{}) (lower interface{}, upper interface{}, fail string) {
	lower = values[0]
	upper = values[1]

	if ShouldNotEqual(lower, upper) != success {
		return nil, nil, fmt.Sprintf(shouldHaveDifferentUpperAndLower, lower)
	} else if ShouldBeLessThan(lower, upper) != success {
		lower, upper = upper, lower
	}
	return lower, upper, success
}
func isBetween(value, lower, upper interface{}) bool {
	if ShouldBeGreaterThan(value, lower) != success {
		return false
	} else if ShouldBeLessThan(value, upper) != success {
		return false
	}
	return true
}

// ShouldBeBetweenOrEqual receives exactly three parameters: an actual value, a lower bound, and an upper bound.
// It ensures that the actual value is between both bounds or equal to one of them.
func ShouldBeBetweenOrEqual(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	lower, upper, fail := deriveBounds(expected)

	if fail != success {
		return fail
	} else if !isBetweenOrEqual(actual, lower, upper) {
		return fmt.Sprintf(shouldHaveBeenBetweenOrEqual, actual, lower, upper)
	}
	return success
}

// ShouldNotBeBetweenOrEqual receives exactly three parameters: an actual value, a lower bound, and an upper bound.
// It ensures that the actual value is nopt between the bounds nor equal to either of them.
func ShouldNotBeBetweenOrEqual(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	lower, upper, fail := deriveBounds(expected)

	if fail != success {
		return fail
	} else if isBetweenOrEqual(actual, lower, upper) {
		return fmt.Sprintf(shouldNotHaveBeenBetweenOrEqual, actual, lower, upper)
	}
	return success
}

func isBetweenOrEqual(value, lower, upper interface{}) bool {
	if ShouldBeGreaterThanOrEqualTo(value, lower) != success {
		return false
	} else if ShouldBeLessThanOrEqualTo(value, upper) != success {
		return false
	}
	return true
}
