package models

import "fmt"

type HttpError struct {
	Message    string
	Error      string
	StatusCode int
}

// Note: an HttpError is a user facing error. It should not contain any sensitive information.
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
