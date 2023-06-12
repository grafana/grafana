package models

import "time"

var (
	// timeNow is an equivalent time.Now() that can be replaced in tests
	timeNow = time.Now
)
