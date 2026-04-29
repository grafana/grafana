package validator

import (
	"errors"
	"fmt"
	"net/http"
)

// ErrorCode represents the type of error that occurred
type ErrorCode string

const (
	// Datasource-related errors
	ErrCodeDatasourceNotFound    ErrorCode = "datasource_not_found"
	ErrCodeDatasourceWrongType   ErrorCode = "datasource_wrong_type"
	ErrCodeDatasourceUnreachable ErrorCode = "datasource_unreachable"
	ErrCodeDatasourceAuth        ErrorCode = "datasource_auth_failed"
	ErrCodeDatasourceConfig      ErrorCode = "datasource_config_error"

	// API-related errors
	ErrCodeAPIUnavailable     ErrorCode = "api_unavailable"
	ErrCodeAPIInvalidResponse ErrorCode = "api_invalid_response"
	ErrCodeAPIRateLimit       ErrorCode = "api_rate_limit"
	ErrCodeAPITimeout         ErrorCode = "api_timeout"

	// Validation errors
	ErrCodeInvalidDashboard       ErrorCode = "invalid_dashboard"
	ErrCodeUnsupportedDashVersion ErrorCode = "unsupported_dashboard_version"
	ErrCodeInvalidQuery           ErrorCode = "invalid_query"

	// Internal errors
	ErrCodeInternal ErrorCode = "internal_error"
)

// ValidationError represents a structured error with context
type ValidationError struct {
	Code       ErrorCode
	Message    string
	Details    map[string]interface{}
	StatusCode int
	Cause      error
}

// Error implements the error interface
func (e *ValidationError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap implements error unwrapping
func (e *ValidationError) Unwrap() error {
	return e.Cause
}

// NewValidationError creates a new ValidationError
func NewValidationError(code ErrorCode, message string, statusCode int) *ValidationError {
	return &ValidationError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
		Details:    make(map[string]interface{}),
	}
}

// WithCause adds the underlying error cause
func (e *ValidationError) WithCause(err error) *ValidationError {
	e.Cause = err
	return e
}

// WithDetail adds contextual information
func (e *ValidationError) WithDetail(key string, value interface{}) *ValidationError {
	e.Details[key] = value
	return e
}

// Common error constructors

// NewDatasourceNotFoundError creates an error for datasource not found
func NewDatasourceNotFoundError(uid string, namespace string) *ValidationError {
	return NewValidationError(
		ErrCodeDatasourceNotFound,
		fmt.Sprintf("datasource not found: %s", uid),
		http.StatusNotFound,
	).WithDetail("datasourceUID", uid).WithDetail("namespace", namespace)
}

// NewDatasourceWrongTypeError creates an error for wrong datasource type
func NewDatasourceWrongTypeError(uid string, expectedType string, actualType string) *ValidationError {
	return NewValidationError(
		ErrCodeDatasourceWrongType,
		fmt.Sprintf("datasource %s has wrong type: expected %s, got %s", uid, expectedType, actualType),
		http.StatusBadRequest,
	).WithDetail("datasourceUID", uid).
		WithDetail("expectedType", expectedType).
		WithDetail("actualType", actualType)
}

// NewDatasourceUnreachableError creates an error for unreachable datasource
func NewDatasourceUnreachableError(uid string, url string, cause error) *ValidationError {
	return NewValidationError(
		ErrCodeDatasourceUnreachable,
		fmt.Sprintf("datasource %s at %s is unreachable", uid, url),
		http.StatusServiceUnavailable,
	).WithDetail("datasourceUID", uid).
		WithDetail("url", url).
		WithCause(cause)
}

// NewAPIUnavailableError creates an error for unavailable API
func NewAPIUnavailableError(statusCode int, responseBody string, cause error) *ValidationError {
	return NewValidationError(
		ErrCodeAPIUnavailable,
		fmt.Sprintf("Prometheus API returned status %d", statusCode),
		http.StatusBadGateway,
	).WithDetail("upstreamStatus", statusCode).
		WithDetail("responseBody", responseBody).
		WithCause(cause)
}

// NewAPIInvalidResponseError creates an error for invalid API response
func NewAPIInvalidResponseError(message string, cause error) *ValidationError {
	return NewValidationError(
		ErrCodeAPIInvalidResponse,
		fmt.Sprintf("Prometheus API returned invalid response: %s", message),
		http.StatusBadGateway,
	).WithCause(cause)
}

// NewAPITimeoutError creates an error for API timeout
func NewAPITimeoutError(url string, cause error) *ValidationError {
	return NewValidationError(
		ErrCodeAPITimeout,
		fmt.Sprintf("request to %s timed out", url),
		http.StatusGatewayTimeout,
	).WithDetail("url", url).
		WithCause(cause)
}

// NewDatasourceAuthError creates an error for authentication failures
func NewDatasourceAuthError(uid string, statusCode int) *ValidationError {
	return NewValidationError(
		ErrCodeDatasourceAuth,
		fmt.Sprintf("authentication failed for datasource %s (status %d)", uid, statusCode),
		http.StatusUnauthorized,
	).WithDetail("datasourceUID", uid).
		WithDetail("upstreamStatus", statusCode)
}

// IsValidationError checks if an error is a ValidationError
func IsValidationError(err error) bool {
	var validationErr *ValidationError
	return errors.As(err, &validationErr)
}

// GetValidationError extracts a ValidationError from an error chain
func GetValidationError(err error) *ValidationError {
	var validationErr *ValidationError
	if errors.As(err, &validationErr) {
		return validationErr
	}
	return nil
}

// GetHTTPStatusCode returns the appropriate HTTP status code for an error
func GetHTTPStatusCode(err error) int {
	if validationErr := GetValidationError(err); validationErr != nil {
		return validationErr.StatusCode
	}
	return http.StatusInternalServerError
}
