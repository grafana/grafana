package validator

import (
	"errors"
	"net/http"
	"testing"
)

func TestNewDatasourceNotFoundError(t *testing.T) {
	err := NewDatasourceNotFoundError("test-uid", "org-1")

	if err.Code != ErrCodeDatasourceNotFound {
		t.Errorf("expected error code %s, got %s", ErrCodeDatasourceNotFound, err.Code)
	}

	if err.StatusCode != http.StatusNotFound {
		t.Errorf("expected status code %d, got %d", http.StatusNotFound, err.StatusCode)
	}

	if err.Details["datasourceUID"] != "test-uid" {
		t.Errorf("expected datasourceUID detail to be 'test-uid', got %v", err.Details["datasourceUID"])
	}

	if err.Details["namespace"] != "org-1" {
		t.Errorf("expected namespace detail to be 'org-1', got %v", err.Details["namespace"])
	}
}

func TestNewDatasourceWrongTypeError(t *testing.T) {
	err := NewDatasourceWrongTypeError("test-uid", "prometheus", "influxdb")

	if err.Code != ErrCodeDatasourceWrongType {
		t.Errorf("expected error code %s, got %s", ErrCodeDatasourceWrongType, err.Code)
	}

	if err.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status code %d, got %d", http.StatusBadRequest, err.StatusCode)
	}

	if err.Details["expectedType"] != "prometheus" {
		t.Errorf("expected expectedType detail to be 'prometheus', got %v", err.Details["expectedType"])
	}

	if err.Details["actualType"] != "influxdb" {
		t.Errorf("expected actualType detail to be 'influxdb', got %v", err.Details["actualType"])
	}
}

func TestNewDatasourceUnreachableError(t *testing.T) {
	cause := errors.New("connection refused")
	err := NewDatasourceUnreachableError("test-uid", "http://localhost:9090", cause)

	if err.Code != ErrCodeDatasourceUnreachable {
		t.Errorf("expected error code %s, got %s", ErrCodeDatasourceUnreachable, err.Code)
	}

	if err.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected status code %d, got %d", http.StatusServiceUnavailable, err.StatusCode)
	}

	if err.Cause != cause {
		t.Errorf("expected cause to be set")
	}

	if err.Details["url"] != "http://localhost:9090" {
		t.Errorf("expected url detail to be 'http://localhost:9090', got %v", err.Details["url"])
	}
}

func TestNewAPIUnavailableError(t *testing.T) {
	err := NewAPIUnavailableError(503, "service unavailable", nil)

	if err.Code != ErrCodeAPIUnavailable {
		t.Errorf("expected error code %s, got %s", ErrCodeAPIUnavailable, err.Code)
	}

	if err.StatusCode != http.StatusBadGateway {
		t.Errorf("expected status code %d, got %d", http.StatusBadGateway, err.StatusCode)
	}

	if err.Details["upstreamStatus"] != 503 {
		t.Errorf("expected upstreamStatus detail to be 503, got %v", err.Details["upstreamStatus"])
	}
}

func TestNewAPIInvalidResponseError(t *testing.T) {
	cause := errors.New("invalid JSON")
	err := NewAPIInvalidResponseError("missing data field", cause)

	if err.Code != ErrCodeAPIInvalidResponse {
		t.Errorf("expected error code %s, got %s", ErrCodeAPIInvalidResponse, err.Code)
	}

	if err.StatusCode != http.StatusBadGateway {
		t.Errorf("expected status code %d, got %d", http.StatusBadGateway, err.StatusCode)
	}

	if err.Cause != cause {
		t.Errorf("expected cause to be set")
	}
}

func TestNewAPITimeoutError(t *testing.T) {
	cause := errors.New("context deadline exceeded")
	err := NewAPITimeoutError("http://localhost:9090/api/v1/query", cause)

	if err.Code != ErrCodeAPITimeout {
		t.Errorf("expected error code %s, got %s", ErrCodeAPITimeout, err.Code)
	}

	if err.StatusCode != http.StatusGatewayTimeout {
		t.Errorf("expected status code %d, got %d", http.StatusGatewayTimeout, err.StatusCode)
	}

	if err.Cause != cause {
		t.Errorf("expected cause to be set")
	}
}

func TestNewDatasourceAuthError(t *testing.T) {
	err := NewDatasourceAuthError("test-uid", 401)

	if err.Code != ErrCodeDatasourceAuth {
		t.Errorf("expected error code %s, got %s", ErrCodeDatasourceAuth, err.Code)
	}

	if err.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected status code %d, got %d", http.StatusUnauthorized, err.StatusCode)
	}

	if err.Details["upstreamStatus"] != 401 {
		t.Errorf("expected upstreamStatus detail to be 401, got %v", err.Details["upstreamStatus"])
	}
}

func TestValidationErrorChaining(t *testing.T) {
	cause := errors.New("network error")
	err := NewValidationError(ErrCodeInternal, "test error", http.StatusInternalServerError).
		WithCause(cause).
		WithDetail("key1", "value1").
		WithDetail("key2", 123)

	if err.Cause != cause {
		t.Errorf("expected cause to be set")
	}

	if err.Details["key1"] != "value1" {
		t.Errorf("expected detail key1 to be 'value1', got %v", err.Details["key1"])
	}

	if err.Details["key2"] != 123 {
		t.Errorf("expected detail key2 to be 123, got %v", err.Details["key2"])
	}
}

func TestIsValidationError(t *testing.T) {
	validationErr := NewDatasourceNotFoundError("test-uid", "org-1")
	regularErr := errors.New("regular error")

	if !IsValidationError(validationErr) {
		t.Errorf("expected IsValidationError to return true for ValidationError")
	}

	if IsValidationError(regularErr) {
		t.Errorf("expected IsValidationError to return false for regular error")
	}
}

func TestGetValidationError(t *testing.T) {
	validationErr := NewDatasourceNotFoundError("test-uid", "org-1")
	regularErr := errors.New("regular error")

	retrieved := GetValidationError(validationErr)
	if retrieved == nil {
		t.Errorf("expected GetValidationError to return the ValidationError")
	}
	if retrieved.Code != ErrCodeDatasourceNotFound {
		t.Errorf("expected retrieved error to have correct code")
	}

	retrieved = GetValidationError(regularErr)
	if retrieved != nil {
		t.Errorf("expected GetValidationError to return nil for regular error")
	}
}

func TestGetHTTPStatusCode(t *testing.T) {
	validationErr := NewDatasourceNotFoundError("test-uid", "org-1")
	regularErr := errors.New("regular error")

	statusCode := GetHTTPStatusCode(validationErr)
	if statusCode != http.StatusNotFound {
		t.Errorf("expected status code %d, got %d", http.StatusNotFound, statusCode)
	}

	statusCode = GetHTTPStatusCode(regularErr)
	if statusCode != http.StatusInternalServerError {
		t.Errorf("expected default status code %d for regular error, got %d", http.StatusInternalServerError, statusCode)
	}
}

func TestErrorUnwrap(t *testing.T) {
	cause := errors.New("underlying error")
	err := NewDatasourceUnreachableError("test-uid", "http://localhost:9090", cause)

	unwrapped := errors.Unwrap(err)
	if unwrapped != cause {
		t.Errorf("expected Unwrap to return the cause")
	}
}

func TestErrorErrorMethod(t *testing.T) {
	// Test without cause
	err1 := NewDatasourceNotFoundError("test-uid", "org-1")
	errMsg1 := err1.Error()
	if errMsg1 == "" {
		t.Errorf("expected non-empty error message")
	}

	// Test with cause
	cause := errors.New("underlying error")
	err2 := NewDatasourceUnreachableError("test-uid", "http://localhost:9090", cause)
	errMsg2 := err2.Error()
	if errMsg2 == "" {
		t.Errorf("expected non-empty error message")
	}
	// Error message should include the cause
	if !contains(errMsg2, "underlying error") {
		t.Errorf("expected error message to include cause, got: %s", errMsg2)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
