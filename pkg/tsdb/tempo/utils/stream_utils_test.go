package stream_utils

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
)

func testLogger() log.Logger {
	return backend.NewLoggerWith("stream_utils_test")
}

func TestGetTeamHeaders_NoMetadata_ReturnsNil(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{JSONData: []byte(`{}`)},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: "streamingForwardTeamHeadersTempo",
	}))

	assert.Nil(t, getTeamHeaders(ctx, testLogger(), pluginCtx))
}

func TestGetTeamHeaders_FeatureToggleOff_ReturnsNil(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{JSONData: []byte(`{}`)},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = metadata.AppendToOutgoingContext(ctx,
		TeamHttpHeaderKeyLower, "policy-a", TeamHttpHeaderKeyLower, "policy-b",
		"x-custom-forward", "extra",
	)

	assert.Nil(t, getTeamHeaders(ctx, testLogger(), pluginCtx))
}

func TestGetTeamHeaders_MapsOutgoingMetadataToHeaderStrings(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{JSONData: []byte(`{}`)},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: "streamingForwardTeamHeadersTempo",
	}))
	ctx = metadata.AppendToOutgoingContext(ctx,
		TeamHttpHeaderKeyLower, "policy-a,policy-b",
		"x-custom-forward", "extra",
	)

	got := getTeamHeaders(ctx, testLogger(), pluginCtx)
	require.NotNil(t, got)
	assert.Equal(t, "policy-a,policy-b", got[TeamHttpHeaderKeyCamel])
	assert.Equal(t, "extra", got["x-custom-forward"])
}

func TestGetTeamHeaders_FallsBackToIncomingMetadata(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{JSONData: []byte(`{}`)},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: "streamingForwardTeamHeadersTempo",
	}))
	ctx = metadata.NewIncomingContext(ctx, metadata.Pairs(
		TeamHttpHeaderKeyLower, "policy-a",
		TeamHttpHeaderKeyLower, "policy-b",
		"x-custom-forward", "extra",
	))

	got := getTeamHeaders(ctx, testLogger(), pluginCtx)
	require.NotNil(t, got)
	assert.Equal(t, "policy-a,policy-b", got[TeamHttpHeaderKeyCamel])
	assert.Equal(t, "extra", got["x-custom-forward"])
}

func TestGetHeadersFromIncomingContext_WithoutFeatureFlag_OnlyClientHeaders(t *testing.T) {
	jsonData := []byte(`{
		"httpHeaderName1": "X-Client",
		"httpHeaderName2": "X-Shared"
	}`)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: jsonData,
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value",
				"httpHeaderValue2": "shared-value",
			},
		},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = metadata.AppendToOutgoingContext(ctx, TeamHttpHeaderKeyLower, "should-not-forward")

	headers, err := GetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)
	assert.Equal(t, "client-value", headers["X-Client"])
	assert.Equal(t, "shared-value", headers["X-Shared"])
	_, ok := headers[TeamHttpHeaderKeyCamel]
	assert.False(t, ok)
}

func TestGetHeadersFromIncomingContext_MergesOutgoingMetadata_WhenToggleOn(t *testing.T) {
	jsonData := []byte(`{
		"httpHeaderName1": "X-Client",
		"httpHeaderName2": "X-Client"
	}`)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         jsonData,
			BasicAuthEnabled: true,
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value-a",
				"httpHeaderValue2": "client-value-b",
			},
		},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: "streamingForwardTeamHeadersTempo",
	}))
	ctx = metadata.AppendToOutgoingContext(ctx,
		TeamHttpHeaderKeyLower, "policy-a,policy-b",
		"x-custom-forward", "extra",
	)

	headers, err := GetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)

	assert.Equal(t, "policy-a,policy-b", headers[TeamHttpHeaderKeyCamel])
	assert.Equal(t, "extra", headers["x-custom-forward"])
	assert.Equal(t, "client-value-a,client-value-b", headers["X-Client"])
}

func TestGetHeadersFromIncomingContext_MergesIncomingMetadata_WhenToggleOn(t *testing.T) {
	jsonData := []byte(`{
		"httpHeaderName1": "X-Client",
		"httpHeaderName2": "X-Client"
	}`)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         jsonData,
			BasicAuthEnabled: true,
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value-a",
				"httpHeaderValue2": "client-value-b",
			},
		},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: "streamingForwardTeamHeadersTempo",
	}))
	ctx = metadata.NewIncomingContext(ctx, metadata.Pairs(
		TeamHttpHeaderKeyLower, "policy-a",
		TeamHttpHeaderKeyLower, "policy-b",
		"x-custom-forward", "extra",
	))

	headers, err := GetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)

	assert.Equal(t, "policy-a,policy-b", headers[TeamHttpHeaderKeyCamel])
	assert.Equal(t, "extra", headers["x-custom-forward"])
	assert.Equal(t, "client-value-a,client-value-b", headers["X-Client"])
}

func TestGetClientOptionsHeaders_ParsesHeaders(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"httpHeaderName1": "X-Client", "httpHeaderName2": "X-Client"}`),
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value-a",
				"httpHeaderValue2": "client-value-b",
			},
		},
	}

	headers, err := getClientOptionsHeaders(context.Background(), pluginCtx)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"X-Client": "client-value-a,client-value-b"}, headers)
}

func TestGetClientOptionsHeaders_InvalidJSON(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte("{"),
		},
	}

	_, err := getClientOptionsHeaders(context.Background(), pluginCtx)
	require.Error(t, err)
}
