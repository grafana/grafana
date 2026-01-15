package stream_utils

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/useragent"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

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

func TestSetHeadersFromIncomingContext_MergesTeamAndClientHeaders(t *testing.T) {
	jsonData := []byte(`{
		"teamHttpHeaders": {
			"headers": {
				"101": [
					{"header": "X-Prom-Label-Policy", "value": "1:team-value"},
					{"header": "X-Prom-Label-Policy", "value": "2:team-wins"}
				]
			}
		},
		"httpHeaderName1": "X-Client",
		"httpHeaderName2": "X-Shared"
	}`)

	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: jsonData,
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "client-value",
				"httpHeaderValue2": "client-overridden",
			},
		},
	}

	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	headers, err := SetHeadersFromIncomingContext(ctx)
	require.NoError(t, err)

	expected := map[string]string{
		"X-Client":            "client-value",
		"X-Prom-Label-Policy": "1:team-value,2:team-wins",
		"X-Shared":            "client-overridden",
	}
	assert.Equal(t, expected, headers)
}

func TestGetTeamHTTPHeaders_NoTeamHeaders(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"httpHeaderName1": "X-Client"}`),
		},
	}

	headers, err := getTeamHTTPHeaders(pluginCtx)
	require.NoError(t, err)
	assert.Empty(t, headers)
}

func TestGetTeamHTTPHeaders_LabelPolicyValue(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
				"teamHttpHeaders": {
					"headers": {
						"101": [
							{"header": "X-Prom-Label-Policy", "value": "1:team-value"},
							{"header": "X-Prom-Label-Policy", "value": "2:team-wins"}
						]
					}
				}
			}`),
		},
	}

	headers, err := getTeamHTTPHeaders(pluginCtx)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"X-Prom-Label-Policy": "1:team-value,2:team-wins",
	}, headers)
}

func TestGetLabelPolicyKeyValue_AppendsValues(t *testing.T) {
	headerWithRules := map[string]interface{}{
		"101": []interface{}{
			map[string]interface{}{
				"header": "X-Prom-Label-Policy",
				"value":  "1:alpha",
			},
			map[string]interface{}{
				"header": "X-Prom-Label-Policy",
				"value":  "2:beta",
			},
		},
	}

	key, value := getLabelPolicyKeyValue(headerWithRules)
	assert.Equal(t, "X-Prom-Label-Policy", key)
	assert.Equal(t, "1:alpha,2:beta", value)
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
