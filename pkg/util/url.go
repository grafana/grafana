package util

import (
	"net/url"
	"strings"
)

// URLQueryReader is a URL query type.
type URLQueryReader struct {
	values url.Values
}

// NewURLQueryReader parses a raw query and returns it as a URLQueryReader type.
func NewURLQueryReader(urlInfo *url.URL) (*URLQueryReader, error) {
	u, err := url.ParseQuery(urlInfo.RawQuery)
	if err != nil {
		return nil, err
	}

	return &URLQueryReader{
		values: u,
	}, nil
}

// Get parse parameters from an URL. If the parameter does not exist, it returns
// the default value.
func (r *URLQueryReader) Get(name string, def string) string {
	val := r.values[name]
	if len(val) == 0 {
		return def
	}

	return val[0]
}

// JoinURLFragments joins two URL fragments into only one URL string.
func JoinURLFragments(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")

	if len(b) == 0 {
		return a
	}

	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}
