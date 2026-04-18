package graphite

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_CreateRequest(t *testing.T) {
	ctx := context.Background()

	service := &Service{}
	dsInfo := &datasourceInfo{
		URL: "http://graphite.example.com",
	}

	tests := []struct {
		name           string
		dsInfo         *datasourceInfo
		params         URLParams
		expectedURL    string
		expectedMethod string
		expectedError  string
		checkHeaders   map[string]string
		checkQuery     map[string][]string
	}{
		{
			name:           "basic request with default GET method",
			dsInfo:         dsInfo,
			params:         URLParams{},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "GET",
		},
		{
			name:   "request with subpath",
			dsInfo: dsInfo,
			params: URLParams{
				SubPath: "/metrics/find",
			},
			expectedURL:    "http://graphite.example.com/metrics/find",
			expectedMethod: "GET",
		},
		{
			name:   "request with custom method",
			dsInfo: dsInfo,
			params: URLParams{
				Method: "POST",
			},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "POST",
		},
		{
			name:   "request with query parameters",
			dsInfo: dsInfo,
			params: URLParams{
				QueryParams: map[string][]string{
					"query":  {"stats.counters.*"},
					"format": {"json"},
				},
			},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "GET",
			checkQuery: map[string][]string{
				"query":  {"stats.counters.*"},
				"format": {"json"},
			},
		},
		{
			name:   "request with headers",
			dsInfo: dsInfo,
			params: URLParams{
				Headers: map[string]string{
					"Content-Type": "application/json",
				},
			},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "GET",
			checkHeaders: map[string]string{
				"Content-Type": "application/json",
			},
		},
		{
			name:   "request with body",
			dsInfo: dsInfo,
			params: URLParams{
				Method: "POST",
				Body:   strings.NewReader(`{"test": "data"}`),
			},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "POST",
		},
		{
			name:   "complex request with all parameters",
			dsInfo: dsInfo,
			params: URLParams{
				SubPath: "/metrics/expand",
				Method:  "POST",
				QueryParams: map[string][]string{
					"groupByExpr": {"true"},
					"leavesOnly":  {"false"},
				},
				Headers: map[string]string{
					"X-Custom-Header": "test-value",
				},
				Body: strings.NewReader(`{"query": "stats.*"}`),
			},
			expectedURL:    "http://graphite.example.com/metrics/expand",
			expectedMethod: "POST",
			checkQuery: map[string][]string{
				"groupByExpr": {"true"},
				"leavesOnly":  {"false"},
			},
			checkHeaders: map[string]string{
				"X-Custom-Header": "test-value",
			},
		},
		{
			name: "invalid URL in datasource",
			dsInfo: &datasourceInfo{
				URL: "://invalid-url",
			},
			params:        URLParams{},
			expectedError: "missing protocol scheme",
		},
		{
			name:   "empty query parameter values",
			dsInfo: dsInfo,
			params: URLParams{
				QueryParams: map[string][]string{
					"empty": {""},
					"valid": {"value"},
				},
			},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "GET",
			checkQuery: map[string][]string{
				"empty": {""},
				"valid": {"value"},
			},
		},
		{
			name:   "multi-valued query parameter",
			dsInfo: dsInfo,
			params: URLParams{
				QueryParams: map[string][]string{
					"valid": {"value1", "value2"},
				},
			},
			expectedURL:    "http://graphite.example.com",
			expectedMethod: "GET",
			checkQuery: map[string][]string{
				"valid": {"value1", "value2"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := service.createRequest(ctx, tt.dsInfo, tt.params)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, req)

			// Check URL (base URL without query parameters)
			baseURL := req.URL.Scheme + "://" + req.URL.Host + req.URL.Path
			assert.Equal(t, tt.expectedURL, baseURL)
			assert.Equal(t, tt.expectedMethod, req.Method)

			if tt.checkQuery != nil {
				for key, expectedValues := range tt.checkQuery {
					actualValue := req.URL.Query()[key]
					assert.NotZero(t, len(actualValue))

					for _, expectedValue := range expectedValues {
						assert.Contains(t, actualValue, expectedValue, "Query parameter %s", key)
					}
				}
			}

			if tt.checkHeaders != nil {
				for key, expectedValue := range tt.checkHeaders {
					actualValue := req.Header.Get(key)
					assert.Equal(t, expectedValue, actualValue, "Header %s", key)
				}
			}

			if tt.params.Body != nil {
				bodyBytes, err := io.ReadAll(req.Body)
				require.NoError(t, err)

				expectedContent := ""
				switch tt.name {
				case "request with body":
					expectedContent = `{"test": "data"}`
				case "complex request with all parameters":
					expectedContent = `{"query": "stats.*"}`
				}
				assert.Equal(t, expectedContent, string(bodyBytes))
			}
		})
	}
}

func Test_CreateRequest_Body(t *testing.T) {
	ctx := context.Background()
	service := &Service{}
	dsInfo := &datasourceInfo{URL: "http://graphite.example.com"}

	t.Run("string reader body", func(t *testing.T) {
		bodyContent := `{"query": "stats.*", "format": "json"}`
		params := URLParams{
			Method: "POST",
			Body:   strings.NewReader(bodyContent),
		}

		req, err := service.createRequest(ctx, dsInfo, params)
		require.NoError(t, err)

		// Read the body to verify content
		bodyBytes, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		assert.Equal(t, bodyContent, string(bodyBytes))
	})

	t.Run("nil body", func(t *testing.T) {
		params := URLParams{
			Method: "GET",
			Body:   nil,
		}

		req, err := service.createRequest(ctx, dsInfo, params)
		require.NoError(t, err)
		assert.Nil(t, req.Body)
	})

	t.Run("empty body reader", func(t *testing.T) {
		params := URLParams{
			Method: "POST",
			Body:   strings.NewReader(""),
		}

		req, err := service.createRequest(ctx, dsInfo, params)
		require.NoError(t, err)

		bodyBytes, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		assert.Empty(t, string(bodyBytes))
	})
}
