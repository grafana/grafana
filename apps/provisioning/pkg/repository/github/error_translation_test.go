package github

import (
	"errors"
	"net/http"
	"testing"

	"github.com/google/go-github/v82/github"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	repo "github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestTranslateGitHubError(t *testing.T) {
	tests := []struct {
		name                string
		inputErr            error
		expectedErr         error
		expectedMsgContains string
	}{
		{
			name:        "nil error returns nil",
			inputErr:    nil,
			expectedErr: nil,
		},
		{
			name:                "non-GitHub error returns as-is",
			inputErr:            errors.New("some other error"),
			expectedMsgContains: "some other error",
		},
		{
			name: "401 with 'expired' returns descriptive error",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusUnauthorized},
				Message:  "expired",
			},
			expectedErr:         repo.ErrUnauthorized,
			expectedMsgContains: "authentication token has expired",
		},
		{
			name: "401 with 'Expired' (capital) returns descriptive error",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusUnauthorized},
				Message:  "Token Expired",
			},
			expectedErr:         repo.ErrUnauthorized,
			expectedMsgContains: "authentication token has expired",
		},
		{
			name: "401 without 'expired' returns generic unauthorized",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusUnauthorized},
				Message:  "Bad credentials",
			},
			expectedErr: repo.ErrUnauthorized,
		},
		{
			name: "403 with 'rate limit' returns descriptive error",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusForbidden},
				Message:  "API rate limit exceeded",
			},
			expectedErr:         repo.ErrPermissionDenied,
			expectedMsgContains: "API rate limit exceeded",
		},
		{
			name: "403 without 'rate limit' returns generic permission denied",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusForbidden},
				Message:  "Resource protected",
			},
			expectedErr: repo.ErrPermissionDenied,
		},
		{
			name: "404 returns file not found",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusNotFound},
				Message:  "Not Found",
			},
			expectedErr: repo.ErrFileNotFound,
		},
		{
			name: "503 returns server unavailable",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusServiceUnavailable},
				Message:  "Service Unavailable",
			},
			expectedErr: repo.ErrServerUnavailable,
		},
		{
			name: "502 returns server unavailable",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusBadGateway},
				Message:  "Bad Gateway",
			},
			expectedErr: repo.ErrServerUnavailable,
		},
		{
			name: "504 returns server unavailable",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusGatewayTimeout},
				Message:  "Gateway Timeout",
			},
			expectedErr: repo.ErrServerUnavailable,
		},
		{
			name: "500 returns GitHub API error with message",
			inputErr: &github.ErrorResponse{
				Response: &http.Response{StatusCode: http.StatusInternalServerError},
				Message:  "Internal server error",
			},
			expectedMsgContains: "GitHub API error (HTTP 500: Internal server error)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := translateGitHubError(tt.inputErr)

			if tt.expectedErr == nil && tt.expectedMsgContains == "" {
				assert.NoError(t, result)
				return
			}

			require.Error(t, result)

			// Check if the expected error is in the error chain (for wrapped errors)
			if tt.expectedErr != nil {
				assert.ErrorIs(t, result, tt.expectedErr,
					"Expected error %v to be in chain of %v", tt.expectedErr, result)
			}

			// Check if the error message contains expected text
			if tt.expectedMsgContains != "" {
				assert.Contains(t, result.Error(), tt.expectedMsgContains,
					"Expected error message to contain '%s', got: %s", tt.expectedMsgContains, result.Error())
			}
		})
	}
}

func TestTranslateGitHubError_PreservesErrorChain(t *testing.T) {
	// Test that wrapped errors preserve the error chain for errors.Is() checks
	expiredErr := &github.ErrorResponse{
		Response: &http.Response{StatusCode: http.StatusUnauthorized},
		Message:  "Token has expired",
	}

	result := translateGitHubError(expiredErr)

	// The result should be an error chain that can be checked with errors.Is()
	assert.ErrorIs(t, result, repo.ErrUnauthorized,
		"Expected repo.ErrUnauthorized to be in error chain")

	// The error message should contain both the descriptive text and the wrapped error
	assert.Contains(t, result.Error(), "authentication token has expired")
	assert.Contains(t, result.Error(), "authentication failed")
}
