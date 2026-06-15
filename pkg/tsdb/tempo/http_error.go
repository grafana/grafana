package tempo

import (
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func dataResponseFromHTTPError(resp *http.Response, body []byte, fallbackMessage string) *backend.DataResponse {
	message := string(body)
	if strings.TrimSpace(message) == "" {
		message = fallbackMessage
	}
	if message == "" && resp != nil {
		message = resp.Status
	}
	if message == "" {
		message = http.StatusText(http.StatusInternalServerError)
	}

	status := backend.StatusUnknown
	source := backend.DefaultErrorSource
	if resp != nil {
		status = backend.Status(resp.StatusCode)
		source = backend.ErrorSourceFromHTTPStatus(resp.StatusCode)
	}

	return &backend.DataResponse{
		Error:       errors.New(message),
		ErrorSource: source,
		Status:      status,
	}
}
