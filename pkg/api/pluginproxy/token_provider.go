package pluginproxy

import "time"

type accessTokenProvider interface {
	GetAccessToken() (string, error)
}

var (
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)
