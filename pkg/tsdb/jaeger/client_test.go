package jaeger

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
)

func TestJaegerClient_Services(t *testing.T) {
	tests := []struct {
		name           string
		mockResponse   string
		mockStatusCode int
		mockStatus     string
		expectedResult []string
		expectError    bool
		expectedError  error
	}{
		{
			name:           "Successful response",
			mockResponse:   `{"data": ["service1", "service2"], "total": 2, "limit": 0, "offset": 0}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"service1", "service2"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Non-200 response",
			mockResponse:   "",
			mockStatusCode: http.StatusInternalServerError,
			mockStatus:     "Internal Server Error",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  errors.New("Internal Server Error"),
		},
		{
			name:           "Invalid JSON response",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  &json.SyntaxError{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, err := New(server.URL, server.Client(), log.NewNullLogger())
			assert.NoError(t, err)

			services, err := client.Services()

			if tt.expectError {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.IsType(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, services)
			}
		})
	}
}

func TestJaegerClient_Operations(t *testing.T) {
	tests := []struct {
		name           string
		service        string
		mockResponse   string
		mockStatusCode int
		mockStatus     string
		expectedResult []string
		expectError    bool
		expectedError  error
	}{
		{
			name:           "Successful response",
			service:        "test-service",
			mockResponse:   `{"data": ["operation1", "operation2"], "total": 2, "limit": 0, "offset": 0}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"operation1", "operation2"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Non-200 response",
			service:        "test-service",
			mockResponse:   "",
			mockStatusCode: http.StatusInternalServerError,
			mockStatus:     "Internal Server Error",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  errors.New("Internal Server Error"),
		},
		{
			name:           "Invalid JSON response",
			service:        "test-service",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  &json.SyntaxError{},
		},
		{
			name:           "Service with special characters",
			service:        "test/service:1",
			mockResponse:   `{"data": ["operation1"], "total": 1, "limit": 0, "offset": 0}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"operation1"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Empty service",
			service:        "",
			mockResponse:   `{"data": [], "total": 0, "limit": 0, "offset": 0}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    false,
			expectedError:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, err := New(server.URL, server.Client(), log.NewNullLogger())
			assert.NoError(t, err)

			operations, err := client.Operations(tt.service)

			if tt.expectError {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.IsType(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, operations)
			}
		})
	}
}
