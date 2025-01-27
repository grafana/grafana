package resource_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/promlib/resource"
)

type mockRoundTripper struct {
	Response *http.Response
	Err      error
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
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
