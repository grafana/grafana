package models

import "fmt"

type HttpError struct {
	Message    string
	Error      string
	StatusCode int
}

// Note: an HttpError should be a user-facing error.
// The message should always be something WE have written and vetted as non-sensitive.
// The original error stack trace can be directly from the service but should only ever be logged, not displayed to user
// This ensures that we don't leak sensitive information to the user.
func NewHttpError(message string, statusCode int, err error) *HttpError {
	httpError := &HttpError{
		Message:    message,
		StatusCode: statusCode,
	}
	if err != nil {
		httpError.Error = err.Error()
		httpError.Message = fmt.Sprintf("%s: %s", message, err)
	}

	return httpError
}
