package models

import "fmt"

type HttpError struct {
	Message    string
	Error      string
	StatusCode int
}

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
