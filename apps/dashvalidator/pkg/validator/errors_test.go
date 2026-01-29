package validator

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewDatasourceNotFoundError(t *testing.T) {
	err := NewDatasourceNotFoundError("test-uid", "org-1")

	require.Equal(t, ErrCodeDatasourceNotFound, err.Code)
	require.Equal(t, http.StatusNotFound, err.StatusCode)
	require.Equal(t, "test-uid", err.Details["datasourceUID"])
	require.Equal(t, "org-1", err.Details["namespace"])
}

func TestNewDatasourceWrongTypeError(t *testing.T) {
	err := NewDatasourceWrongTypeError("test-uid", "prometheus", "influxdb")

	require.Equal(t, ErrCodeDatasourceWrongType, err.Code)
	require.Equal(t, http.StatusBadRequest, err.StatusCode)
	require.Equal(t, "prometheus", err.Details["expectedType"])
	require.Equal(t, "influxdb", err.Details["actualType"])
}

func TestNewDatasourceUnreachableError(t *testing.T) {
	cause := errors.New("connection refused")
	err := NewDatasourceUnreachableError("test-uid", "http://localhost:9090", cause)

	require.Equal(t, ErrCodeDatasourceUnreachable, err.Code)
	require.Equal(t, http.StatusServiceUnavailable, err.StatusCode)
	require.Equal(t, cause, err.Cause)
	require.Equal(t, "http://localhost:9090", err.Details["url"])
}

func TestNewAPIUnavailableError(t *testing.T) {
	err := NewAPIUnavailableError(503, "service unavailable", nil)

	require.Equal(t, ErrCodeAPIUnavailable, err.Code)
	require.Equal(t, http.StatusBadGateway, err.StatusCode)
	require.Equal(t, 503, err.Details["upstreamStatus"])
}

func TestNewAPIInvalidResponseError(t *testing.T) {
	cause := errors.New("invalid JSON")
	err := NewAPIInvalidResponseError("missing data field", cause)

	require.Equal(t, ErrCodeAPIInvalidResponse, err.Code)
	require.Equal(t, http.StatusBadGateway, err.StatusCode)
	require.Equal(t, cause, err.Cause)
}

func TestNewAPITimeoutError(t *testing.T) {
	cause := errors.New("context deadline exceeded")
	err := NewAPITimeoutError("http://localhost:9090/api/v1/query", cause)

	require.Equal(t, ErrCodeAPITimeout, err.Code)
	require.Equal(t, http.StatusGatewayTimeout, err.StatusCode)
	require.Equal(t, cause, err.Cause)
}

func TestNewDatasourceAuthError(t *testing.T) {
	err := NewDatasourceAuthError("test-uid", 401)

	require.Equal(t, ErrCodeDatasourceAuth, err.Code)
	require.Equal(t, http.StatusUnauthorized, err.StatusCode)
	require.Equal(t, 401, err.Details["upstreamStatus"])
}

func TestValidationErrorChaining(t *testing.T) {
	cause := errors.New("network error")
	err := NewValidationError(ErrCodeInternal, "test error", http.StatusInternalServerError).
		WithCause(cause).
		WithDetail("key1", "value1").
		WithDetail("key2", 123)

	require.Equal(t, cause, err.Cause)
	require.Equal(t, "value1", err.Details["key1"])
	require.Equal(t, 123, err.Details["key2"])
}

func TestIsValidationError(t *testing.T) {
	validationErr := NewDatasourceNotFoundError("test-uid", "org-1")
	regularErr := errors.New("regular error")

	require.True(t, IsValidationError(validationErr), "expected IsValidationError to return true for ValidationError")
	require.False(t, IsValidationError(regularErr), "expected IsValidationError to return false for regular error")
}

func TestGetValidationError(t *testing.T) {
	validationErr := NewDatasourceNotFoundError("test-uid", "org-1")
	regularErr := errors.New("regular error")

	retrieved := GetValidationError(validationErr)
	require.NotNil(t, retrieved, "expected GetValidationError to return the ValidationError")
	require.Equal(t, ErrCodeDatasourceNotFound, retrieved.Code)

	retrieved = GetValidationError(regularErr)
	require.Nil(t, retrieved, "expected GetValidationError to return nil for regular error")
}

func TestGetHTTPStatusCode(t *testing.T) {
	validationErr := NewDatasourceNotFoundError("test-uid", "org-1")
	regularErr := errors.New("regular error")

	require.Equal(t, http.StatusNotFound, GetHTTPStatusCode(validationErr))
	require.Equal(t, http.StatusInternalServerError, GetHTTPStatusCode(regularErr), "expected default status code for regular error")
}

func TestErrorUnwrap(t *testing.T) {
	cause := errors.New("underlying error")
	err := NewDatasourceUnreachableError("test-uid", "http://localhost:9090", cause)

	require.Equal(t, cause, errors.Unwrap(err), "expected Unwrap to return the cause")
}

func TestErrorErrorMethod(t *testing.T) {
	// Test without cause
	err1 := NewDatasourceNotFoundError("test-uid", "org-1")
	require.NotEmpty(t, err1.Error(), "expected non-empty error message")

	// Test with cause
	cause := errors.New("underlying error")
	err2 := NewDatasourceUnreachableError("test-uid", "http://localhost:9090", cause)
	errMsg2 := err2.Error()
	require.NotEmpty(t, errMsg2, "expected non-empty error message")
	require.Contains(t, errMsg2, "underlying error", "error message should include cause")
}
