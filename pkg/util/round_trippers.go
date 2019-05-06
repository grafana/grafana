package util

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

type basicAuthRoundTripper struct {
	username, password, passwordFile string
	rt                               http.RoundTripper
}

type bearerAuthRoundTripper struct {
	bearerTokenFile string
	rt              http.RoundTripper
}

// NewBearerAuthRoundTripper returns a new http.RoundTripper that uses bearer token authentication
// for HTTP requests. The bearer token is read from the specified file for each request. If the
// authorization header is already set, then the bearer token will not be sent with the request.
func NewBearerAuthRoundTripper(bearerTokenFile string, rt http.RoundTripper) http.RoundTripper {
	return &bearerAuthRoundTripper{
		bearerTokenFile: bearerTokenFile,
		rt:              rt,
	}
}

// RoundTrip implements http.RoundTripper.
func (b *bearerAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	buf, err := ioutil.ReadFile(b.bearerTokenFile)
	if err != nil {
		return nil, err
	}

	if req.Header.Get("Authorization") == "" {
		req = newRequest(req)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", string(buf)))
	}

	return b.rt.RoundTrip(req)
}

// NewBasicAuthRoundTripper returns a new http.RoundTripper that uses basic authentication for
// HTTP requests. If a password file is specified then the basic auth password will populated
// from the file on disk. If the authorization header is already set, then the basic auth
// credentials will not be sent with the request.
func NewBasicAuthRoundTripper(username, password, passwordFile string, rt http.RoundTripper) http.RoundTripper {
	return &basicAuthRoundTripper{
		username:     username,
		password:     password,
		passwordFile: passwordFile,
		rt:           rt,
	}
}

// RoundTrip implements http.RoundTripper.
func (b *basicAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	password := b.password
	if b.passwordFile != "" {
		buf, err := ioutil.ReadFile(b.passwordFile)
		if err != nil {
			return nil, err
		}
		password = string(buf)
	}

	if req.Header.Get("Authorization") == "" {
		req = newRequest(req)
		req.SetBasicAuth(b.username, password)
	}

	return b.rt.RoundTrip(req)
}

// newRequest clones an http.Request so that it can
// be re-used by the round tripper.
func newRequest(req *http.Request) *http.Request {
	newReq := *req
	newReq.Header = http.Header{}
	for k, v := range req.Header {
		newReq.Header[k] = v
	}
	return &newReq
}
