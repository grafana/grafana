package utils

import (
	"net/url"
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
