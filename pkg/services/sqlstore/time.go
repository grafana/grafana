package sqlstore

import "time"

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

func MockTimeNow(constTime time.Time) {
	TimeNow = func() time.Time {
		return constTime
	}
}

func ResetTimeNow() {
	TimeNow = time.Now
}
