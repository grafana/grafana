package resource_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	// "github.com/grafana/grafana/pkg/promlib/client"
	"github.com/grafana/grafana/pkg/promlib/resource"
)

func TestNewResource(t *testing.T) {
	httpClient := &http.Client{}
	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		URL:      "http://localhost:9090",
		JSONData: []byte(`{"httpMethod": "GET"}`),
	}
	logger := log.DefaultLogger

	res, err := resource.New(httpClient, settings, logger)
	require.NoError(t, err)
	assert.NotNil(t, res)
}

func TestResource_Execute(t *testing.T) {
	httpClient := &http.Client{}
	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		URL:      "http://localhost:9090",
		JSONData: []byte(`{"httpMethod": "GET"}`),
	}
	logger := log.DefaultLogger

	res, err := resource.New(httpClient, settings, logger)
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
	httpClient := &http.Client{}
	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		URL:      "http://localhost:9090",
		JSONData: []byte(`{"httpMethod": "GET"}`),
	}
	logger := log.DefaultLogger

	res, err := resource.New(httpClient, settings, logger)
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
