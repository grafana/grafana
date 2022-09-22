package errutil

import "net/http"

const (
	// StatusUnknown implies an error that should be updated to contain
	// an accurate status code, as none has been provided.
	// HTTP status code 500.
	StatusUnknown CoreStatus = ""
	// StatusUnauthorized means that the server does not recognize the
	// client's authentication, either because it has not been provided
	// or is invalid for the operation.
	// HTTP status code 401.
	StatusUnauthorized CoreStatus = "Unauthorized"
	// StatusForbidden means that the server refuses to perform the
	// requested action for the authenticated uer.
	// HTTP status code 403.
	StatusForbidden CoreStatus = "Forbidden"
	// StatusNotFound means that the server does not have any
	// corresponding document to return to the request.
	// HTTP status code 404.
	StatusNotFound CoreStatus = "Not found"
	// StatusTooManyRequests means that the client is rate limited
	// by the server and should back-off before trying again.
	// HTTP status code 429.
	StatusTooManyRequests CoreStatus = "Too many requests"
	// StatusBadRequest means that the server was unable to parse the
	// parameters or payload for the request.
	// HTTP status code 400.
	StatusBadRequest CoreStatus = "Bad request"
	// StatusValidationFailed means that the server was able to parse
	// the payload for the request but it failed one or more validation
	// checks.
	// HTTP status code 400.
	StatusValidationFailed CoreStatus = "Validation failed"
	// StatusInternal means that the server acknowledges that there's
	// an error, but that there is nothing the client can do to fix it.
	// HTTP status code 500.
	StatusInternal CoreStatus = "Internal server error"
	// StatusTimeout means that the server did not complete the request
	// within the required time and aborted the action.
	// HTTP status code 504.
	StatusTimeout CoreStatus = "Timeout"
	// StatusNotImplemented means that the server does not support the
	// requested action. Typically used during development of new
	// features.
	// HTTP status code 501.
	StatusNotImplemented CoreStatus = "Not implemented"
)

// StatusReason allows for wrapping of CoreStatus.
type StatusReason interface {
	Status() CoreStatus
}

type CoreStatus string

// Status implements the StatusReason interface.
func (s CoreStatus) Status() CoreStatus {
	return s
}

// HTTPStatus converts the CoreStatus to an HTTP status code.
func (s CoreStatus) HTTPStatus() int {
	switch s {
	case StatusUnauthorized:
		return http.StatusUnauthorized
	case StatusForbidden:
		return http.StatusForbidden
	case StatusNotFound:
		return http.StatusNotFound
	case StatusTimeout:
		return http.StatusGatewayTimeout
	case StatusTooManyRequests:
		return http.StatusTooManyRequests
	case StatusBadRequest, StatusValidationFailed:
		return http.StatusBadRequest
	case StatusNotImplemented:
		return http.StatusNotImplemented
	case StatusUnknown, StatusInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}

// LogLevel returns the default LogLevel for the CoreStatus.
func (s CoreStatus) LogLevel() LogLevel {
	switch s {
	case StatusUnauthorized:
		return LevelDebug
	case StatusForbidden:
		return LevelDebug
	case StatusNotFound:
		return LevelDebug
	case StatusTimeout:
		return LevelDebug
	case StatusTooManyRequests:
		return LevelDebug
	case StatusBadRequest:
		return LevelDebug
	case StatusValidationFailed:
		return LevelDebug
	case StatusNotImplemented:
		return LevelDebug
	case StatusUnknown, StatusInternal:
		return LevelError
	default:
		return LevelUnknown
	}
}

func (s CoreStatus) String() string {
	return string(s)
}

// ProxyStatus implies that an error originated from the data source
// proxy.
type ProxyStatus CoreStatus

// Status implements the StatusReason interface.
func (s ProxyStatus) Status() CoreStatus {
	return CoreStatus(s)
}

// PluginStatus implies that an error originated from a plugin.
type PluginStatus CoreStatus

// Status implements the StatusReason interface.
func (s PluginStatus) Status() CoreStatus {
	return CoreStatus(s)
}
