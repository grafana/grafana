package options

import (
	"net/http"
)

// NOTE: both dataplane aggregator and kubernetes aggregator (when enterprise is linked) have logic around
// setting this RoundTripper as ready, however, kubernetes aggregator part is skipped naturally,
// given it is invoked as part of the delegate chain headed by the dataplane aggregator, and not through
// its own Run method.
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
