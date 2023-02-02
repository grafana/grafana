package updatechecker

import (
	"context"
	"net/http"
)

type httpClient interface {
	Get(ctx context.Context, url string) (resp *http.Response, err error)
}
