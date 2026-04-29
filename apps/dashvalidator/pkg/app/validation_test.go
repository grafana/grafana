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
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/datasources"
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
// Request Parsing Tests
// ============================================================================

func TestHandleCheck_InvalidJSON(t *testing.T) {
	bodyBytes := []byte(`{invalid json`)

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
	handler := handleCheckRoute(
		logging.DefaultLogger,
		nil, nil,
		map[string]validator.DatasourceValidator{},
		nil, // ac - not reached for invalid JSON
	)

	_ = handler(context.Background(), recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response map[string]string
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Contains(t, response["error"], "invalid JSON")
}

func TestHandleCheck_MultipleDatasources(t *testing.T) {
	body := checkRequest{
		DashboardJSON: map[string]interface{}{"title": "Test"},
		DatasourceMappings: []datasourceMapping{
			{UID: "ds-1", Type: "prometheus"},
			{UID: "ds-2", Type: "prometheus"},
		},
	}

	recorder := executeValidationRequest(t, body)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response map[string]string
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Contains(t, response["error"], "MVP only supports single datasource")
}

func TestHandleCheck_ZeroDatasources(t *testing.T) {
	body := checkRequest{
		DashboardJSON:      map[string]interface{}{"title": "Test"},
		DatasourceMappings: []datasourceMapping{},
	}

	recorder := executeValidationRequest(t, body)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response map[string]string
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Contains(t, response["error"], "MVP only supports single datasource")
}

// ============================================================================
// Datasource Scoped Permission Tests
// ============================================================================

func TestHandleCheck_DatasourcePermissions(t *testing.T) {
	ac := acimpl.ProvideAccessControl(nil)

	// Valid request body — passes input validation, reaches the permission check
	body := checkRequest{
		DashboardJSON: map[string]any{"title": "Test Dashboard"},
		DatasourceMappings: []datasourceMapping{
			{UID: "target-ds", Type: "prometheus"},
		},
	}
	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	// Helper to build the handler request with a fresh body reader
	makeRequest := func(ctx context.Context) (*httptest.ResponseRecorder, *app.CustomRouteRequest) {
		requestURL, _ := url.Parse("http://localhost:3000/apis/dashvalidator.grafana.app/v1alpha1/namespaces/org-1/check")
		req := &app.CustomRouteRequest{
			ResourceIdentifier: resource.FullIdentifier{Namespace: "org-1"},
			Path:               "check",
			URL:                requestURL,
			Method:             "POST",
			Headers:            http.Header{"Content-Type": []string{"application/json"}},
			Body:               io.NopCloser(bytes.NewReader(bodyBytes)),
		}
		return httptest.NewRecorder(), req
	}

	t.Run("no identity in context returns 401", func(t *testing.T) {
		handler := handleCheckRoute(logging.DefaultLogger, nil, nil, map[string]validator.DatasourceValidator{}, ac)
		recorder, req := makeRequest(context.Background())

		_ = handler(context.Background(), recorder, req)

		assert.Equal(t, http.StatusUnauthorized, recorder.Code)
		var resp map[string]string
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
		assert.Equal(t, "auth_error", resp["code"])
	})

	t.Run("user with scoped access passes permission check", func(t *testing.T) {
		ctx := identity.WithRequester(context.TODO(), &identity.StaticRequester{
			OrgRole: identity.RoleEditor,
			UserID:  1,
			OrgID:   1,
			Permissions: map[int64]map[string][]string{
				1: {
					datasources.ActionRead:  {"datasources:uid:target-ds"},
					datasources.ActionQuery: {"datasources:uid:target-ds"},
				},
			},
		})

		handler := handleCheckRoute(logging.DefaultLogger, nil, nil, map[string]validator.DatasourceValidator{}, ac)
		recorder, req := makeRequest(ctx)

		// Will panic on nil datasourceSvc AFTER passing the permission check
		func() {
			defer func() { _ = recover() }()
			_ = handler(ctx, recorder, req)
		}()

		// Should NOT be 401 or 403 — permission check passed
		assert.NotEqual(t, http.StatusUnauthorized, recorder.Code)
		assert.NotEqual(t, http.StatusForbidden, recorder.Code)
	})

	// the "user lacks scoped access" test case
	t.Run("user without scoped access returns 403", func(t *testing.T) {
		ctx := identity.WithRequester(context.TODO(), &identity.StaticRequester{
			OrgRole: identity.RoleEditor,
			UserID:  1,
			OrgID:   1,
			Permissions: map[int64]map[string][]string{
				1: {
					datasources.ActionRead:  {"datasources:uid:not-target-ds"},
					datasources.ActionQuery: {"datasources:uid:not-target-ds"},
				},
			},
		})

		handler := handleCheckRoute(logging.DefaultLogger, nil, nil, map[string]validator.DatasourceValidator{}, ac)

		recorder, req := makeRequest(ctx)
		_ = handler(ctx, recorder, req)

		assert.Equal(t, http.StatusForbidden, recorder.Code)
		var resp map[string]string
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
		assert.Equal(t, "datasource_forbidden", resp["code"])
	})
}

// ============================================================================
// Response Conversion Tests (transforms data structure)
// ============================================================================

func TestConvertToCheckResponse(t *testing.T) {
	t.Run("converts basic result correctly", func(t *testing.T) {
		input := &validator.DashboardCompatibilityResult{
			CompatibilityScore: 0.85,
			DatasourceResults: []validator.DatasourceValidationResult{
				{
					UID:  "ds-1",
					Type: "prometheus",
					Name: "My Prometheus",
					ValidationResult: validator.ValidationResult{
						TotalQueries:   10,
						CheckedQueries: 10,
						CompatibilityResult: validator.CompatibilityResult{
							TotalMetrics:       20,
							FoundMetrics:       17,
							MissingMetrics:     []string{"missing_1", "missing_2", "missing_3"},
							CompatibilityScore: 0.85,
						},
						QueryBreakdown: []validator.QueryResult{
							{
								PanelTitle: "CPU Usage",
								PanelID:    1,
								QueryRefID: "A",
								CompatibilityResult: validator.CompatibilityResult{
									TotalMetrics:       5,
									FoundMetrics:       4,
									MissingMetrics:     []string{"missing_1"},
									CompatibilityScore: 0.8,
								},
							},
						},
					},
				},
			},
		}

		result := convertToCheckResponse(input)

		assert.Equal(t, 0.85, result.CompatibilityScore)
		require.Len(t, result.DatasourceResults, 1)

		dsResult := result.DatasourceResults[0]
		assert.Equal(t, "ds-1", dsResult.UID)
		assert.Equal(t, "prometheus", dsResult.Type)
		require.NotNil(t, dsResult.Name)
		assert.Equal(t, "My Prometheus", *dsResult.Name)
		assert.Equal(t, 10, dsResult.TotalQueries)
		assert.Equal(t, 17, dsResult.FoundMetrics)
		assert.Equal(t, []string{"missing_1", "missing_2", "missing_3"}, dsResult.MissingMetrics)

		require.Len(t, dsResult.QueryBreakdown, 1)
		qr := dsResult.QueryBreakdown[0]
		assert.Equal(t, "CPU Usage", qr.PanelTitle)
		assert.Equal(t, 1, qr.PanelID)
		assert.Equal(t, "A", qr.QueryRefID)
		assert.Nil(t, qr.ParseError)
	})

	t.Run("handles empty name as nil pointer", func(t *testing.T) {
		input := &validator.DashboardCompatibilityResult{
			CompatibilityScore: 1.0,
			DatasourceResults: []validator.DatasourceValidationResult{
				{
					UID:  "ds-1",
					Type: "prometheus",
					Name: "", // Empty name
				},
			},
		}

		result := convertToCheckResponse(input)

		require.Len(t, result.DatasourceResults, 1)
		assert.Nil(t, result.DatasourceResults[0].Name, "Empty name should become nil pointer")
	})

	t.Run("handles parse error in query result", func(t *testing.T) {
		parseErr := "failed to parse PromQL"
		input := &validator.DashboardCompatibilityResult{
			CompatibilityScore: 0.5,
			DatasourceResults: []validator.DatasourceValidationResult{
				{
					UID:  "ds-1",
					Type: "prometheus",
					ValidationResult: validator.ValidationResult{
						QueryBreakdown: []validator.QueryResult{
							{
								PanelTitle: "Broken Query",
								ParseError: &parseErr,
							},
						},
					},
				},
			},
		}

		result := convertToCheckResponse(input)

		require.Len(t, result.DatasourceResults, 1)
		require.Len(t, result.DatasourceResults[0].QueryBreakdown, 1)
		require.NotNil(t, result.DatasourceResults[0].QueryBreakdown[0].ParseError)
		assert.Equal(t, "failed to parse PromQL", *result.DatasourceResults[0].QueryBreakdown[0].ParseError)
	})

	t.Run("handles empty datasource results", func(t *testing.T) {
		input := &validator.DashboardCompatibilityResult{
			CompatibilityScore: 1.0,
			DatasourceResults:  []validator.DatasourceValidationResult{},
		}

		result := convertToCheckResponse(input)

		assert.Equal(t, 1.0, result.CompatibilityScore)
		assert.Empty(t, result.DatasourceResults)
	})
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
		nil, // httpClientProvider
		map[string]validator.DatasourceValidator{},
		nil, // ac - not reached during validation failures
	)

	// For validation tests, we only care about responses written before the panic.
	// Valid inputs will panic when hitting nil datasourceSvc, but that's after
	// validation passes - the recorder already has the validation error response.
	func() {
		defer func() {
			// Recover from nil pointer dereference that occurs after validation passes
			_ = recover()
		}()
		_ = handler(context.Background(), recorder, req)
	}()

	return recorder
}
