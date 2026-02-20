package stream_utils

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	// get the plugin from context
	plugin := backend.PluginConfigFromContext(ctx)

	// get the HTTP headers for the current user's teams only (LBAC)
	teamHeaders, err := getTeamHTTPHeaders(ctx, plugin)
	if err != nil {
		return nil, err
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

// getTeamHTTPHeaders returns HTTP headers for LBAC: only the rules for teams the current user belongs to.
// This matches the grafana-enterprise teamhttpheaders middleware behavior so that each user only gets
// headers for their own teams' rules.
func getTeamHTTPHeaders(ctx context.Context, plugin backend.PluginContext) (map[string]string, error) {
	headers := map[string]string{}

	requester, err := identity.GetRequester(ctx)
	if err != nil || requester == nil || requester.IsNil() {
		return headers, nil
	}

	userTeamIDs := requester.GetTeams()
	if len(userTeamIDs) == 0 {
		return headers, nil
	}

	userTeamIDSet := make(map[string]struct{}, len(userTeamIDs))
	for _, id := range userTeamIDs {
		userTeamIDSet[strconv.FormatInt(id, 10)] = struct{}{}
	}

	jsonData := plugin.DataSourceInstanceSettings.JSONData
	if len(jsonData) == 0 {
		return headers, nil
	}
	sj, err := simplejson.NewJson(jsonData)
	if err != nil {
		return nil, fmt.Errorf("parse datasource jsonData: %w", err)
	}

	teamHTTPHeaders, err := datasources.GetTeamHTTPHeaders(sj)
	if err != nil {
		return nil, fmt.Errorf("get team HTTP headers: %w", err)
	}
	if teamHTTPHeaders == nil || len(teamHTTPHeaders.Headers) == 0 {
		return headers, nil
	}

	for teamIDStr, rules := range teamHTTPHeaders.Headers {
		if _, isUserTeam := userTeamIDSet[teamIDStr]; !isUserTeam {
			continue
		}
		for _, rule := range rules {
			if rule.Header == "" || rule.LBACRule == "" {
				continue
			}
			if existing := headers[rule.Header]; existing != "" {
				headers[rule.Header] = existing + "," + rule.LBACRule
			} else {
				headers[rule.Header] = rule.LBACRule
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
