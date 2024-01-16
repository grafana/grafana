package userimpl

import "time"

// timeNow wraps time.Now so it can be mocked in tests.
var timeNow = time.Now

func MockTimeNow(constTime time.Time) {
	timeNow = func() time.Time {
		return constTime
	}
}

func ResetTimeNow() {
	timeNow = time.Now
}
