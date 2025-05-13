package options

import (
	"net/http"
)

// NOTE: both dataplane aggregator and kubernetes aggregator (when enterprise is linked) have logic around
// setting this RoundTripper as ready, however, dataplane aggregator skips it if it detects that kubernetes aggregator
// is available
type RoundTripperFunc struct {
	Ready chan struct{}
	Fn    func(req *http.Request) (*http.Response, error)
}

func (f *RoundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	if f.Fn == nil {
		<-f.Ready
	}
	return f.Fn(req)
}
