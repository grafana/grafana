package options

import (
	"net/http"
)

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
