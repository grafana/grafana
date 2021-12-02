package channels

import "time"

// mockTimeNow replaces function timeNow to return constant time.
// It returns a function that resets the variable back to its original value.
// This allows usage of this function with defer:
// func Test (t *testing.T) {
//    now := time.Now()
//    defer mockTimeNow(now)()
//    ...
// }
func mockTimeNow(constTime time.Time) func() {
	timeNow = func() time.Time {
		return constTime
	}
	return resetTimeNow
}

// resetTimeNow resets the global variable timeNow to the default value, which is time.Now
func resetTimeNow() {
	timeNow = time.Now
}
