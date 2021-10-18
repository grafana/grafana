package channels

import "time"

func mockTimeNow(constTime time.Time) {
	timeNow = func() time.Time {
		return constTime
	}
}

func resetTimeNow() {
	timeNow = time.Now
}
