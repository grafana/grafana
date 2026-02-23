package stream_utils

import (
	"context"
	"net/url"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/useragent"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

// fakeRequester implements identity.Requester by embedding StaticRequester and overriding GetTeams.
// Used so tests can assert team-filtered headers (StaticRequester.GetTeams() always returns nil).
type fakeRequester struct {
	*identity.StaticRequester
	Teams []int64
}

func (f *fakeRequester) GetTeams() []int64 {
	if f == nil {
		return nil
	}
	return f.Teams
}

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
		"teamHttpHeaders": {
			"headers": {
				"101": [{"header": "X-Prom-Label-Policy", "value": "1:team-value"}]
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
				"httpHeaderValue2": "shared-value",
			},
		},
	}
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	// No GrafanaConfig or feature toggle disabled -> no team headers
	headers, err := SetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)
	// Only client-options headers; no X-Prom-Label-Policy
	assert.Equal(t, "client-value", headers["X-Client"])
	assert.Equal(t, "shared-value", headers["X-Shared"])
	assert.Empty(t, headers["X-Prom-Label-Policy"])
}

func TestSetHeadersFromIncomingContext_MergesTeamAndClientHeaders_WhenToggleOn(t *testing.T) {
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
	ctx = identity.WithRequester(ctx, &fakeRequester{
		StaticRequester: &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1},
		Teams:           []int64{101},
	})

	headers, err := SetHeadersFromIncomingContext(ctx, testLogger())
	require.NoError(t, err)

	// Rule values must be URL-encoded (e.g. ':' -> %3A)
	encoded1 := url.QueryEscape("1:team-value")
	encoded2 := url.QueryEscape("2:team-wins")
	expected := map[string]string{
		"X-Client":            "client-value",
		"X-Prom-Label-Policy": encoded1 + "," + encoded2,
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
	ctx := context.Background()

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)
	assert.Empty(t, headers)
}

func TestGetTeamHTTPHeaders_NoBasicAuth_ReturnsEmpty(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         []byte(`{"teamHttpHeaders":{"headers":{"101":[{"header":"X-Prom-Label-Policy","value":"1:team-value"}]}}}`),
			BasicAuthEnabled: false,
		},
	}
	ctx := identity.WithRequester(context.Background(), &fakeRequester{
		StaticRequester: &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1},
		Teams:           []int64{101},
	})

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)
	assert.Empty(t, headers)
}

func TestGetTeamHTTPHeaders_OnlyUserTeamsIncluded(t *testing.T) {
	// Team 101 and 303 have rules; user is only in 101
	jsonData := []byte(`{
		"teamHttpHeaders": {
			"headers": {
				"101": [{"header": "X-Prom-Label-Policy", "value": "1:team-101"}],
				"303": [{"header": "X-Prom-Label-Policy", "value": "3:team-303"}]
			}
		}
	}`)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         jsonData,
			BasicAuthEnabled: true,
		},
	}
	ctx := identity.WithRequester(context.Background(), &fakeRequester{
		StaticRequester: &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1},
		Teams:           []int64{101},
	})

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"X-Prom-Label-Policy": url.QueryEscape("1:team-101"),
	}, headers)
}

func TestGetTeamHTTPHeaders_MultipleTeams_MergedAndEncoded(t *testing.T) {
	jsonData := []byte(`{
		"teamHttpHeaders": {
			"headers": {
				"101": [
					{"header": "X-Prom-Label-Policy", "value": "1:team-value"},
					{"header": "X-Prom-Label-Policy", "value": "2:team-wins"}
				],
				"202": [
					{"header": "X-Prom-Label-Policy", "value": "resource:namespace=\"ns1\""}
				]
			}
		}
	}`)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         jsonData,
			BasicAuthEnabled: true,
		},
	}
	ctx := identity.WithRequester(context.Background(), &fakeRequester{
		StaticRequester: &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1},
		Teams:           []int64{101, 202},
	})

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)

	// All rules from teams 101 and 202, comma-separated, each value URL-encoded
	want1 := url.QueryEscape("1:team-value")
	want2 := url.QueryEscape("2:team-wins")
	want3 := url.QueryEscape("resource:namespace=\"ns1\"")
	// Order may vary by map iteration; we just check all three encoded values appear
	combined := headers["X-Prom-Label-Policy"]
	assert.Contains(t, combined, want1)
	assert.Contains(t, combined, want2)
	assert.Contains(t, combined, want3)
	assert.Len(t, headers, 1)
}

func TestGetTeamHTTPHeaders_LabelPolicyValue_Encoded(t *testing.T) {
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
			BasicAuthEnabled: true,
		},
	}
	ctx := identity.WithRequester(context.Background(), &fakeRequester{
		StaticRequester: &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1},
		Teams:           []int64{101},
	})

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"X-Prom-Label-Policy": url.QueryEscape("1:team-value") + "," + url.QueryEscape("2:team-wins"),
	}, headers)
}

func TestGetTeamHTTPHeaders_NoUserTeams_ReturnsEmpty(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{
				"teamHttpHeaders": {
					"headers": {
						"101": [{"header": "X-Prom-Label-Policy", "value": "1:team-value"}]
					}
				}
			}`),
			BasicAuthEnabled: true,
		},
	}
	// User in no teams (nil Teams)
	ctx := identity.WithRequester(context.Background(), &fakeRequester{
		StaticRequester: &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1},
		Teams:           []int64{},
	})

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)
	assert.Empty(t, headers)
}

func TestGetTeamHTTPHeaders_NonUserIdentity_ReturnsEmpty(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData:         []byte(`{"teamHttpHeaders":{"headers":{"101":[{"header":"X-Prom-Label-Policy","value":"1:team-value"}]}}}`),
			BasicAuthEnabled: true,
		},
	}
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:   claims.TypeServiceAccount,
		UserID: 1,
		OrgID:  1,
	})

	headers, err := getTeamHTTPHeaders(ctx, pluginCtx, testLogger())
	require.NoError(t, err)
	assert.Empty(t, headers)
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
