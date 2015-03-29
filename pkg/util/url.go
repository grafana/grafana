package util

import (
	"net/url"
	"strings"
)

type UrlQueryReader struct {
	values url.Values
}

func NewUrlQueryReader(url *url.URL) *UrlQueryReader {
	return &UrlQueryReader{
		values: url.Query(),
	}
}

func (r *UrlQueryReader) Get(name string, def string) string {
	val := r.values[name]
	if len(val) == 0 {
		return def
	}

	return val[0]
}

func JoinUrlFragments(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}
