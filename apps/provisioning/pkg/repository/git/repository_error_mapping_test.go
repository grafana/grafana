package git

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/nanogit/options"
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

// TestMapNanogitError_ResponseTooLarge verifies that nanogit's response byte
// limit error is surfaced as a 413 Request Entity Too Large.
func TestMapNanogitError_ResponseTooLarge(t *testing.T) {
	got := mapNanogitError(&client.ErrResponseTooLarge{Limit: 1024, Op: "fetch"})
	require.Error(t, got)

	var statusErr apierrors.APIStatus
	require.True(t, errors.As(got, &statusErr), "mapped error should implement APIStatus interface")
	require.Equal(t, int32(http.StatusRequestEntityTooLarge), statusErr.Status().Code)
}

// TestCheckHTTPError_ResponseTooLarge verifies that a capped operation's 413
// surfaces as a 413 TestResults rather than falling through to the generic 400
// that Test() returns for unrecognized errors.
func TestCheckHTTPError_ResponseTooLarge(t *testing.T) {
	err := mapNanogitError(&client.ErrResponseTooLarge{Limit: 1024, Op: "ls-refs"})
	result := checkHTTPError(err, field.NewPath("spec", "git", "branch"))

	require.NotNil(t, result)
	require.Equal(t, http.StatusRequestEntityTooLarge, result.Code)
	require.False(t, result.Success)
	require.Len(t, result.Errors, 1)
}

// TestLimits_toOptions verifies that non-positive limits are clamped to 0
// (unlimited) so nanogit never receives a negative field, and that "set" only
// reports true when at least one positive cap is configured.
func TestLimits_toOptions(t *testing.T) {
	tests := []struct {
		name    string
		limits  Limits
		want    options.Limits
		wantSet bool
	}{
		{
			name:    "all zero is unlimited and unset",
			limits:  Limits{},
			want:    options.Limits{},
			wantSet: false,
		},
		{
			name: "negative values are clamped to unlimited",
			limits: Limits{
				MaxFileSize:         -1,
				MaxBulkFetchSize:    -5,
				MaxRefsSize:         -100,
				MaxPushResponseSize: -1,
			},
			want:    options.Limits{},
			wantSet: false,
		},
		{
			name: "mixed positive and non-positive",
			limits: Limits{
				MaxFileSize:         1024,
				MaxBulkFetchSize:    0,
				MaxRefsSize:         -1,
				MaxPushResponseSize: 2048,
			},
			want: options.Limits{
				SingleObjectFetchMaxBytes:   1024,
				ReceivePackResponseMaxBytes: 2048,
			},
			wantSet: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, set := tt.limits.toOptions()
			require.Equal(t, tt.want, got)
			require.Equal(t, tt.wantSet, set)
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
