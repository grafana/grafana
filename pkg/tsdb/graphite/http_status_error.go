package graphite

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type httpStatusError struct {
	status backend.Status
	source backend.ErrorSource
	err    error
}

func newHTTPStatusError(statusCode int, source backend.ErrorSource, err error) error {
	return &httpStatusError{status: backend.Status(statusCode), source: source, err: err}
}

func (e *httpStatusError) Error() string { return e.err.Error() }

func (e *httpStatusError) Unwrap() error { return e.err }

func dataResponseFromError(err error) backend.DataResponse {
	var statusErr *httpStatusError
	if errors.As(err, &statusErr) {
		return backend.ErrDataResponseWithSource(statusErr.status, statusErr.source, statusErr.err.Error())
	}
	return backend.ErrorResponseWithErrorSource(err)
}
