package util

import (
	"net/url"
	"strings"
)

// UrlQueryReader is a URL query type.
type UrlQueryReader struct {
	values url.Values
}

// NewUrlQueryReader parses a raw query and returns it as a UrlQueryReader type.
func NewUrlQueryReader(urlInfo *url.URL) (*UrlQueryReader, error) {
	u, err := url.ParseQuery(urlInfo.RawQuery)
	if err != nil {
		return nil, err
	}

	return &UrlQueryReader{
		values: u,
	}, nil
}

// Get parse parameters from an URL. If the parameter does not exist, it returns
// the default value.
func (r *UrlQueryReader) Get(name string, def string) string {
	val := r.values[name]
	if len(val) == 0 {
		return def
	}

	return val[0]
}

// JoinUrlFragments joins two URL fragments into only one URL string.
func JoinUrlFragments(a, b string) string {
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
