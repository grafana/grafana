package resource_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/promlib/resource"
)

type mockRoundTripper struct {
	Response        *http.Response
	Err             error
	customRoundTrip func(req *http.Request) (*http.Response, error)
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.customRoundTrip != nil {
		return m.customRoundTrip(req)
	}
	return m.Response, m.Err
}

func setup() (*http.Client, backend.DataSourceInstanceSettings, log.Logger) {
	// Mock HTTP Response
	mockResponse := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewReader([]byte(`{"message": "success"}`))),
		Header:     make(http.Header),
	}

	// Create a mock RoundTripper
	mockTransport := &mockRoundTripper{
		Response: mockResponse,
	}

	// Create a mock HTTP client using the mock RoundTripper
	mockClient := &http.Client{
		Transport: mockTransport,
	}

	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		URL:      "http://mock-server",
		JSONData: []byte(`{}`),
	}

	logger := log.DefaultLogger

	return mockClient, settings, logger
}

func TestNewResource(t *testing.T) {
	mockClient, settings, logger := setup()
	res, err := resource.New(mockClient, settings, logger)
	require.NoError(t, err)
	assert.NotNil(t, res)
}

func TestResource_Execute(t *testing.T) {
	mockClient, settings, logger := setup()
	res, err := resource.New(mockClient, settings, logger)
	require.NoError(t, err)

	req := &backend.CallResourceRequest{
		URL: "/test",
	}
	ctx := context.Background()

	resp, err := res.Execute(ctx, req)
	require.NoError(t, err)
	assert.NotNil(t, resp)
}

func TestResource_GetSuggestions(t *testing.T) {
	mockClient, _, logger := setup()
	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		URL:      "http://localhost:9090",
		JSONData: []byte(`{"httpMethod": "GET"}`),
	}

	res, err := resource.New(mockClient, settings, logger)
	require.NoError(t, err)

	suggestionReq := resource.SuggestionRequest{
		LabelName: "instance",
		Queries:   []string{"up"},
		Start:     "1609459200",
		End:       "1609462800",
		Limit:     10,
	}

	body, err := json.Marshal(suggestionReq)
	require.NoError(t, err)

	req := &backend.CallResourceRequest{
		Body: body,
	}
	ctx := context.Background()

	resp, err := res.GetSuggestions(ctx, req)
	require.NoError(t, err)
	assert.NotNil(t, resp)
}

func TestResource_GetSuggestionsWithEmptyQueriesButFilters(t *testing.T) {
	var capturedURL string

	// Create a mock transport that captures the request URL
	mockTransport := &mockRoundTripper{
		Response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader([]byte(`{"status":"success","data":[]}`))),
			Header:     make(http.Header),
		},
		customRoundTrip: func(req *http.Request) (*http.Response, error) {
			capturedURL = req.URL.String()
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewReader([]byte(`{"status":"success","data":[]}`))),
				Header:     make(http.Header),
			}, nil
		},
	}

	// Create a client with the mock transport
	mockClient := &http.Client{
		Transport: mockTransport,
	}

	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		URL:      "http://localhost:9090",
		JSONData: []byte(`{"httpMethod": "GET"}`),
	}

	res, err := resource.New(mockClient, settings, log.DefaultLogger)
	require.NoError(t, err)

	// Create a request with empty queries but with filters
	suggestionReq := resource.SuggestionRequest{
		Queries: []string{}, // Empty queries
		Scopes: []models.ScopeFilter{
			{Key: "job", Operator: models.FilterOperatorEquals, Value: "testjob"},
		},
		AdhocFilters: []models.ScopeFilter{
			{Key: "instance", Operator: models.FilterOperatorEquals, Value: "localhost:9090"},
		},
	}

	body, err := json.Marshal(suggestionReq)
	require.NoError(t, err)

	req := &backend.CallResourceRequest{
		Body: body,
	}
	ctx := context.Background()

	resp, err := res.GetSuggestions(ctx, req)
	require.NoError(t, err)
	assert.NotNil(t, resp)

	// Parse the captured URL to get the query parameters
	parsedURL, err := url.Parse(capturedURL)
	require.NoError(t, err)

	// Get the match[] parameter
	matchValues := parsedURL.Query()["match[]"]
	require.Len(t, matchValues, 1, "Expected exactly one match[] parameter")

	// The actual filter expression should match our expectation, regardless of URL encoding
	decodedMatch, err := url.QueryUnescape(matchValues[0])
	require.NoError(t, err)

	// Check that both label matchers are present with their correct values
	assert.Contains(t, decodedMatch, `job="testjob"`)
	assert.Contains(t, decodedMatch, `instance="localhost:9090"`)
}
