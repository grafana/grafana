package stream_utils

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func testLogger() log.Logger {
	return backend.NewLoggerWith("stream_utils_test")
}

func TestGetTeamHeaders_NoOutgoingMetadata_ReturnsNil(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{JSONData: []byte(`{}`)},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)

	assert.Nil(t, getTeamHeaders(ctx, testLogger(), pluginCtx))
}

// getTeamHeaders does not consult the feature toggle; SetHeadersFromIncomingContext gates calling it.
func TestGetTeamHeaders_MapsOutgoingMetadataToHeaderStrings(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{JSONData: []byte(`{}`)},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = metadata.AppendToOutgoingContext(ctx,
		TeamHttpHeaderKeyLower, "policy-a", TeamHttpHeaderKeyLower, "policy-b",
		"x-custom-forward", "extra",
	)

	got := getTeamHeaders(ctx, testLogger(), pluginCtx)
	require.NotNil(t, got)
	assert.Equal(t, "policy-a,policy-b", got[TeamHttpHeaderKeyCamel])
	assert.Equal(t, "extra", got["x-custom-forward"])
}

func TestSetHeadersFromIncomingContext_FeatureToggleOff_OnlyClientHeaders(t *testing.T) {
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

	headers, err := SetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)
	assert.Equal(t, "client-value", headers["X-Client"])
	assert.Equal(t, "shared-value", headers["X-Shared"])
	assert.Empty(t, headers[TeamHttpHeaderKeyCamel])
}

func TestSetHeadersFromIncomingContext_MergesOutgoingMetadata_WhenToggleOn(t *testing.T) {
	jsonData := []byte(`{
		"httpHeaderName1": "X-Client",
		"httpHeaderName2": "X-Shared"
	}`)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         jsonData,
			BasicAuthEnabled: true,
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value",
				"httpHeaderValue2": "client-overridden",
			},
		},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	ctx = backend.WithGrafanaConfig(ctx, backend.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: featuremgmt.FlagForwardTeamHeadersTempo,
	}))
	ctx = metadata.AppendToOutgoingContext(ctx,
		TeamHttpHeaderKeyLower, "policy-a", TeamHttpHeaderKeyLower, "policy-b",
		"x-custom-forward", "extra",
	)

	headers, err := SetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)

	assert.Equal(t, "policy-a,policy-b", headers[TeamHttpHeaderKeyCamel])
	assert.Equal(t, "extra", headers["x-custom-forward"])
	assert.Equal(t, "client-value", headers["X-Client"])
	assert.Equal(t, "client-overridden", headers["X-Shared"])
}

func TestGetClientOptionsHeaders_ParsesHeaders(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"httpHeaderName1": "X-Client"}`),
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value",
			},
		},
	}

	headers, err := getClientOptionsHeaders(context.Background(), pluginCtx)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"X-Client": "client-value"}, headers)
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
