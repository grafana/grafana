package pluginproxy

import "time"

type accessTokenProvider interface {
	getAccessToken() (string, error)
}

var (
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)
