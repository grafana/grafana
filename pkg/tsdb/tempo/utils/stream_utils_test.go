package stream_utils

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/useragent"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func testLogger() log.Logger {
	return backend.NewLoggerWith("stream_utils_test")
}

func TestAppendHeadersToOutgoingContext_AppendsHeadersAndUserAgent(t *testing.T) {
	ctx := context.TODO()
	ua, err := useragent.New("10.0.0", "linux", "amd64")
	require.NoError(t, err)
	ctx = backend.WithUserAgent(ctx, ua)
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs("Existing", "one"))

	req := &backend.RunStreamRequest{
		Headers: map[string]string{
			"X-Test": "value",
		},
	}

	out := AppendHeadersToOutgoingContext(ctx, req)
	outgoingMD, ok := metadata.FromOutgoingContext(out)
	require.True(t, ok)
	assert.Equal(t, []string{"value"}, outgoingMD.Get("x-test"))
	assert.Equal(t, []string{ua.String()}, outgoingMD.Get("user-agent"))
	assert.Equal(t, []string{"one"}, outgoingMD.Get("existing"))
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
