package app

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Datasource UID Validation Tests
// ============================================================================

func TestHandleCheck_InvalidDatasourceUID(t *testing.T) {
	tests := []struct {
		name          string
		uid           string
		expectedError string
	}{
		{
			name:          "empty UID",
			uid:           "",
			expectedError: "UID is empty",
		},
		{
			name:          "UID too long",
			uid:           strings.Repeat("a", util.MaxUIDLength+1),
			expectedError: "UID is longer than",
		},
		{
			name:          "UID with spaces",
			uid:           "invalid uid",
			expectedError: "invalid format",
		},
		{
			name:          "UID with @ symbol",
			uid:           "invalid@uid",
			expectedError: "invalid format",
		},
		{
			name:          "UID with ! symbol",
			uid:           "invalid!uid",
			expectedError: "invalid format",
		},
		{
			name:          "UID with unicode",
			uid:           "invalid\u00e9uid",
			expectedError: "invalid format",
		},
		{
			name:          "UID with dots",
			uid:           "invalid.uid",
			expectedError: "invalid format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := checkRequest{
				DashboardJSON: map[string]interface{}{"title": "Test Dashboard"},
				DatasourceMappings: []datasourceMapping{
					{UID: tt.uid, Type: "prometheus"},
				},
			}

			recorder := executeValidationRequest(t, body)

			assert.Equal(t, http.StatusBadRequest, recorder.Code)

			var response map[string]string
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			assert.Equal(t, "invalid_datasource_uid", response["code"])
			assert.Contains(t, response["error"], tt.expectedError)
		})
	}
}

func TestHandleCheck_ValidDatasourceUID(t *testing.T) {
	tests := []struct {
		name string
		uid  string
	}{
		{"lowercase letters", "abcdefg"},
		{"uppercase letters", "ABCDEFG"},
		{"numbers", "1234567"},
		{"hyphens", "test-uid"},
		{"underscores", "test_uid"},
		{"mixed characters", "Test-UID_123"},
		{"max length UID", strings.Repeat("a", util.MaxUIDLength)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := checkRequest{
				DashboardJSON: map[string]interface{}{"title": "Test Dashboard"},
				DatasourceMappings: []datasourceMapping{
					{UID: tt.uid, Type: "prometheus"},
				},
			}

			recorder := executeValidationRequest(t, body)

			// Valid UIDs should NOT return invalid_datasource_uid error
			// They may fail later (e.g., datasource not found), but not at validation
			if recorder.Code == http.StatusBadRequest {
				var response map[string]string
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
				assert.NotEqual(t, "invalid_datasource_uid", response["code"],
					"Valid UID %q should not fail UID validation", tt.uid)
			}
		})
	}
}

// ============================================================================
// Datasource Type Validation Tests
// ============================================================================

func TestHandleCheck_EmptyDatasourceType(t *testing.T) {
	body := checkRequest{
		DashboardJSON: map[string]interface{}{"title": "Test Dashboard"},
		DatasourceMappings: []datasourceMapping{
			{UID: "valid-uid", Type: ""},
		},
	}

	recorder := executeValidationRequest(t, body)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response map[string]string
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, "invalid_datasource_type", response["code"])
	assert.Contains(t, response["error"], "datasource type cannot be empty")
}

// ============================================================================
// Test Helper - Executes validation portion of handler only
// ============================================================================

// executeValidationRequest tests the validation logic in handleCheck.
// It uses a minimal handler setup that will fail after validation passes,
// allowing us to isolate and test the validation behavior.
func executeValidationRequest(t *testing.T, body checkRequest) *httptest.ResponseRecorder {
	t.Helper()

	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	requestURL, err := url.Parse("http://localhost:3000/apis/dashvalidator.grafana.app/v1alpha1/namespaces/org-1/check")
	require.NoError(t, err)

	req := &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{
			Namespace: "org-1",
		},
		Path:    "check",
		URL:     requestURL,
		Method:  "POST",
		Headers: http.Header{"Content-Type": []string{"application/json"}},
		Body:    io.NopCloser(bytes.NewReader(bodyBytes)),
	}

	recorder := httptest.NewRecorder()

	// Create handler with nil dependencies - validation happens before they're used
	handler := handleCheckRoute(
		logging.DefaultLogger,
		nil, // datasourceSvc - not reached during validation failures
		nil, // pluginCtx
		nil, // httpClientProvider
		map[string]validator.DatasourceValidator{},
	)

	// For validation tests, we only care about responses written before the panic.
	// Valid inputs will panic when hitting nil datasourceSvc, but that's after
	// validation passes - the recorder already has the validation error response.
	func() {
		defer func() {
			// Recover from nil pointer dereference that occurs after validation passes
			recover()
		}()
		_ = handler(context.Background(), recorder, req)
	}()

	return recorder
}
