package updatemanager

import "net/http"

type httpClient interface {
	Do(req *http.Request) (resp *http.Response, err error)
}
