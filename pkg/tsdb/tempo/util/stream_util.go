package util

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"google.golang.org/grpc/metadata"
)

// Appends incoming request headers to the outgoing context to make sure none are lost when we make the request to tempo.
func AppendHeadersToOutgoingContext(ctx context.Context, req *backend.RunStreamRequest) context.Context {
	// append all incoming headers
	for key, value := range req.Headers {
		ctx = metadata.AppendToOutgoingContext(ctx, key, value)
	}
	// Setting the user agent for the gRPC call. When DS is decoupled we don't recreate instance when grafana config
	// changes or updates, so we have to get it from context.
	// Ideally this would be pushed higher, so it's set once for all rpc calls, but we have only one now.
	ctx = metadata.AppendToOutgoingContext(ctx, "User-Agent", backend.UserAgentFromContext(ctx).String())
	return ctx
}

// When we receive a new query request we should make sure that all incoming HTTP headers are being forwarding to the grpc stream request
// this is to make sure that no headers are lost when we make the actual call to Tempo later on.
func SetHeadersFromIncomingContext(ctx context.Context) (map[string]string, error) {
	headers := map[string]string{}
	// get the plugin from context
	plugin := backend.PluginConfigFromContext(ctx)

	// get the HTTP headers
	teamHeaders, error := getTeamHTTPHeaders(plugin)
	if error != nil {
		return nil, error
	}

	// get the rest of the incoming headers
	headers, err := getClientOptionsHeaders(ctx, plugin)
	if err != nil {
		return nil, err
	}

	for key, value := range teamHeaders {
		headers[key] = value
	}
	return headers, nil
}

func getTeamHTTPHeaders(plugin backend.PluginContext) (map[string]string, error) {
	headers := map[string]string{}
	// Grab the JSON data from the datasource instance settings
	jsonData := plugin.DataSourceInstanceSettings.JSONData
	js, err := simplejson.NewJson(jsonData)
	if err != nil {
		return nil, err
	}

	// fetch team http headers
	teamHttpHeaders, err := datasources.GetTeamHTTPHeaders(js)
	if err != nil {
		return nil, err
	}

	// if present, set the Team HTTP Headers
	if teamHttpHeaders != nil {
		for _, ruleValue := range teamHttpHeaders.Headers {
			for _, accessRule := range ruleValue {
				headers[accessRule.Header] = accessRule.LBACRule
			}
		}
	}
	return headers, nil
}

func getClientOptionsHeaders(ctx context.Context, plugin backend.PluginContext) (map[string]string, error) {
	headers := map[string]string{}
	opts, err := plugin.DataSourceInstanceSettings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get HTTP client options: %w", err)
	}

	for name, values := range opts.Header {
		for _, value := range values {
			headers[name] = value
		}
	}
	return headers, nil
}
