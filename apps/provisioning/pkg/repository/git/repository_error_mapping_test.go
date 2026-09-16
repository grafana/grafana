package git

import (
	"errors"
	"math"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/nanogit/options"
	"github.com/grafana/nanogit/protocol"
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

// TestMapNanogitError_ObjectTooLarge verifies that nanogit's decoded-object
// cap error (the decompression-bomb defense) is surfaced as a 413.
func TestMapNanogitError_ObjectTooLarge(t *testing.T) {
	got := mapNanogitError(&protocol.ObjectTooLargeError{Size: 1 << 30, Limit: 10 << 20})
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

// TestLimits_toOptions verifies that each provisioning limit maps to the right
// nanogit option, that non-positive limits are clamped to 0 (unlimited) so
// nanogit never receives a negative field, that "set" only reports true when at
// least one positive cap is configured, and that the single-object cap carries
// wire-overhead headroom over the decoded max_file_size content limit.
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
			name: "each field maps to its nanogit option",
			limits: Limits{
				MaxFileSize:         5 * 1024 * 1024,
				MaxBulkFetchSize:    1024 * 1024 * 1024,
				MaxRefsSize:         10 * 1024 * 1024,
				MaxPushResponseSize: 10 * 1024 * 1024,
				MaxDecodedFileSize:  20 * 1024 * 1024,
			},
			want: options.Limits{
				// max_file_size + wire-overhead headroom (see singleObjectWireCap).
				SingleObjectFetchMaxBytes:   singleObjectWireCap(5 * 1024 * 1024),
				MultiObjectFetchMaxBytes:    1024 * 1024 * 1024,
				RefsMetadataMaxBytes:        10 * 1024 * 1024,
				ReceivePackResponseMaxBytes: 10 * 1024 * 1024,
				MaxObjectDecodedBytes:       20 * 1024 * 1024,
			},
			wantSet: true,
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
				SingleObjectFetchMaxBytes:   singleObjectWireCap(1024),
				ReceivePackResponseMaxBytes: 2048,
			},
			wantSet: true,
		},
		{
			// A non-positive decoded cap clamps to 0, which nanogit reads as
			// "keep the built-in default" — so it must not, on its own, mark the
			// options as set.
			name:    "non-positive decoded cap stays 0 and unset",
			limits:  Limits{MaxDecodedFileSize: -1},
			want:    options.Limits{},
			wantSet: false,
		},
		{
			// A positive decoded cap alone must still install the options.
			name:    "decoded cap alone marks options set",
			limits:  Limits{MaxDecodedFileSize: 15 * 1024 * 1024},
			want:    options.Limits{MaxObjectDecodedBytes: 15 * 1024 * 1024},
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

// TestSingleObjectWireCap verifies the wire-overhead headroom: the cap must
// exceed max_file_size (so an incompressible file at the content limit is not
// aborted on the wire), and unlimited must stay unlimited.
func TestSingleObjectWireCap(t *testing.T) {
	require.Equal(t, int64(0), singleObjectWireCap(0), "unlimited stays unlimited")
	require.Equal(t, int64(0), singleObjectWireCap(-1), "non-positive stays unlimited")

	const maxFile = 5 * 1024 * 1024
	got := singleObjectWireCap(maxFile)
	require.Greater(t, got, int64(maxFile), "wire cap must leave room above the content limit")
	require.Equal(t, int64(maxFile+maxFile/gitWireOverheadDivisor+gitWireOverheadFloor), got)

	// A cap near the int64 ceiling must saturate, not overflow into a negative
	// (which nanogit rejects at construction).
	require.Equal(t, int64(math.MaxInt64), singleObjectWireCap(math.MaxInt64), "must saturate at MaxInt64")
	require.Positive(t, singleObjectWireCap(math.MaxInt64-1), "must not overflow to a negative limit")
}

// TestWrapNanogitError verifies that a mapped API-status error (e.g. the 413
// from a capped response) is returned unwrapped so responsewriters.ErrorToAPIStatus,
// which type-switches on the concrete error rather than unwrapping, still emits
// the intended status code; non-status errors keep the context prefix.
func TestWrapNanogitError(t *testing.T) {
	t.Run("status error is returned unwrapped", func(t *testing.T) {
		got := wrapNanogitError("list refs", &client.ErrResponseTooLarge{Limit: 1024, Op: "ls-refs"})

		// A direct type assertion (what ErrorToAPIStatus does) must succeed.
		_, ok := got.(apierrors.APIStatus)
		require.True(t, ok, "mapped status error must not be wrapped")
		require.True(t, apierrors.IsRequestEntityTooLargeError(got))
	})

	t.Run("non-status error keeps context prefix", func(t *testing.T) {
		got := wrapNanogitError("list refs", errors.New("boom"))
		require.EqualError(t, got, "list refs: boom")
	})

	t.Run("nil error is unwrapped nil", func(t *testing.T) {
		require.NoError(t, wrapNanogitError("list refs", nil))
	})
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
