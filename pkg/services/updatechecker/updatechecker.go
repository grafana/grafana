package updatechecker

import (
	"net/http"
)

type httpClient interface {
	Get(url string) (resp *http.Response, err error)
}
