package git

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/nanogit/protocol/client"
)

// TestMapNanogitError tests the mapNanogitError helper function
func TestMapNanogitError(t *testing.T) {
	tests := []struct {
		name        string
		input       error
		wantError   error
		description string
	}{
		{
			name:        "nil error returns nil",
			input:       nil,
			wantError:   nil,
			description: "should handle nil input gracefully",
		},
		{
			name:        "ErrUnauthorized maps to repository.ErrUnauthorized",
			input:       client.NewUnauthorizedError("GET", "/info/refs", nil),
			wantError:   repository.ErrUnauthorized,
			description: "should map nanogit unauthorized to repository unauthorized",
		},
		{
			name:        "ErrPermissionDenied maps to repository.ErrPermissionDenied",
			input:       client.NewPermissionDeniedError("POST", "/git-receive-pack", nil),
			wantError:   repository.ErrPermissionDenied,
			description: "should map nanogit permission denied to repository permission denied",
		},
		{
			name:        "ErrServerUnavailable maps to repository.ErrServerUnavailable",
			input:       client.NewServerUnavailableError("GET", 503, nil),
			wantError:   repository.ErrServerUnavailable,
			description: "should map nanogit server unavailable to repository server unavailable",
		},
		{
			name:        "unknown error returns unchanged",
			input:       errors.New("some random error"),
			wantError:   nil, // should be the same error
			description: "should return original error if not a known nanogit error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mapNanogitError(tt.input)

			if tt.wantError == nil && tt.input != nil {
				// For unknown errors, should return the original error
				require.Equal(t, tt.input, got, tt.description)
			} else if tt.wantError != nil {
				// For known errors, should be wrapped and match with errors.Is()
				require.ErrorIs(t, got, tt.wantError, tt.description)
			} else {
				// For nil input, should return nil
				require.Nil(t, got, tt.description)
			}
		})
	}
}

// TestMapNanogitError_HTTPStatusCodes verifies that mapped errors have correct HTTP status codes
func TestMapNanogitError_HTTPStatusCodes(t *testing.T) {
	tests := []struct {
		name           string
		input          error
		wantStatusCode int32
		wantError      error
	}{
		{
			name:           "unauthorized maps to HTTP 401",
			input:          client.NewUnauthorizedError("GET", "/info/refs", nil),
			wantStatusCode: http.StatusUnauthorized,
			wantError:      repository.ErrUnauthorized,
		},
		{
			name:           "permission denied maps to HTTP 403",
			input:          client.NewPermissionDeniedError("POST", "/git-receive-pack", nil),
			wantStatusCode: http.StatusForbidden,
			wantError:      repository.ErrPermissionDenied,
		},
		{
			name:           "server unavailable maps to HTTP 503",
			input:          client.NewServerUnavailableError("GET", 503, nil),
			wantStatusCode: http.StatusServiceUnavailable,
			wantError:      repository.ErrServerUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mapNanogitError(tt.input)
			require.NotNil(t, got)

			// Verify it wraps the expected error
			require.ErrorIs(t, got, tt.wantError, "should wrap the expected repository error")

			// Verify HTTP status code using k8s StatusError interface
			var statusErr apierrors.APIStatus
			if errors.As(got, &statusErr) {
				require.Equal(t, tt.wantStatusCode, statusErr.Status().Code,
					"mapped error should have correct HTTP status code")
			} else {
				t.Fatalf("mapped error should implement APIStatus interface")
			}
		})
	}
}
