package stream_utils

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
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
func SetHeadersFromIncomingContext(ctx context.Context, logger log.Logger) (map[string]string, error) {
	// get the plugin from context
	plugin := backend.PluginConfigFromContext(ctx)

	// get the HTTP headers for the current user's teams only (LBAC)
	teamHeaders, err := getTeamHTTPHeaders(ctx, plugin, logger)
	if err != nil {
		return nil, err
	}

	// get the rest of the incoming headers
	headers, err := getClientOptionsHeaders(ctx, plugin, logger)
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
func getTeamHTTPHeaders(ctx context.Context, plugin backend.PluginContext, logger log.Logger) (map[string]string, error) {
	headers := map[string]string{}

	if plugin.DataSourceInstanceSettings == nil || plugin.DataSourceInstanceSettings.JSONData == nil {
		return headers, nil
	}

	// team headers are only available when basic auth is enabled
	if !plugin.DataSourceInstanceSettings.BasicAuthEnabled {
		return headers, nil
	}

	jsonData := plugin.DataSourceInstanceSettings.JSONData
	var data map[string]interface{}
	err := json.Unmarshal(jsonData, &data)
	if err != nil {
		return nil, err
	}

	// no team headers present in the datasource settings
	if _, exists := data["teamHttpHeaders"]; !exists {
		return headers, nil
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return headers, nil
	}

	// Only support team HTTP headers for users
	if !requester.IsIdentityType(claims.TypeUser) {
		logger.Debug("teamHttpHeaders is not supported for identity type %s", "identityType", requester.GetIdentityType())
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

func getClientOptionsHeaders(ctx context.Context, plugin backend.PluginContext, logger log.Logger) (map[string]string, error) {
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
