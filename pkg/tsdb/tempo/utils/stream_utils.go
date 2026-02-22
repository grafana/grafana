package stream_utils

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
// Team HTTP headers (LBAC) are only added when the forwardTeamHeadersTempo feature toggle is enabled.
func SetHeadersFromIncomingContext(ctx context.Context, logger log.Logger) (map[string]string, error) {
	plugin := backend.PluginConfigFromContext(ctx)

	headers, err := getClientOptionsHeaders(ctx, plugin)
	if err != nil {
		return nil, err
	}

	cfg := backend.GrafanaConfigFromContext(ctx)
	// we will only fetch and forward team headers if the feature toggle is enabled
	if cfg != nil && cfg.FeatureToggles().IsEnabled(featuremgmt.FlagForwardTeamHeadersTempo) {
		teamHeaders, err := getTeamHTTPHeaders(ctx, plugin, logger)
		if err != nil {
			return nil, err
		}
		for key, value := range teamHeaders {
			headers[key] = value
		}
	}

	return headers, nil
}

// getTeamHTTPHeaders returns HTTP headers for LBAC: only the rules for teams the current user belongs to.
func getTeamHTTPHeaders(ctx context.Context, plugin backend.PluginContext, logger log.Logger) (map[string]string, error) {
	headers := map[string]string{}

	if plugin.DataSourceInstanceSettings == nil || plugin.DataSourceInstanceSettings.JSONData == nil {
		return headers, nil
	}

	// team headers are only available when basic auth is enabled
	if !plugin.DataSourceInstanceSettings.BasicAuthEnabled {
		return headers, nil
	}

	dsUID := plugin.DataSourceInstanceSettings.UID

	jsonData := plugin.DataSourceInstanceSettings.JSONData
	var data map[string]interface{}
	err := json.Unmarshal(jsonData, &data)
	if err != nil {
		return nil, err
	}

	// no team headers present in the datasource settings
	if _, exists := data["teamHttpHeaders"]; !exists {
		logger.Debug("No teamHttpHeaders in datasource settings", "datasource_uid", dsUID)
		return headers, nil
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return headers, nil
	}

	// Only support team HTTP headers for users
	if !requester.IsIdentityType(claims.TypeUser) {
		logger.Debug("teamHttpHeaders is not supported for identity type", "identityType", requester.GetIdentityType(), "datasource_uid", dsUID)
		return headers, nil
	}

	userTeamIDs := requester.GetTeams()
	if len(userTeamIDs) == 0 {
		logger.Debug("User has no team memberships, skipping team headers", "datasource_uid", dsUID)
		return headers, nil
	}

	userTeamIDSet := make(map[string]struct{}, len(userTeamIDs))
	for _, id := range userTeamIDs {
		userTeamIDSet[strconv.FormatInt(id, 10)] = struct{}{}
	}

	rulesProcessed := 0
	teamHTTPHeaders := data["teamHttpHeaders"]
	if lbacHeaders, ok := teamHTTPHeaders.(map[string]interface{})["headers"]; ok {
		headerMap := lbacHeaders.(map[string]interface{})
		for teamID, accessRuleValue := range headerMap {
			if _, isUserTeam := userTeamIDSet[teamID]; !isUserTeam {
				continue
			}
			rules := accessRuleValue.([]interface{})
			for _, accessRule := range rules {
				header := accessRule.(map[string]interface{})
				headerName := ""
				headerValue := ""
				for key, value := range header {
					if key == "header" {
						if rawHeaderName, ok := value.(string); ok {
							headerName = rawHeaderName
						}
						continue
					}
					if key == "value" {
						if rawLBACRule, ok := value.(string); ok {
							headerValue = url.QueryEscape(rawLBACRule)
						}
					}
				}
				if headerName != "" && headerValue != "" {
					if existing := headers[headerName]; existing != "" {
						headers[headerName] = existing + "," + headerValue
					} else {
						headers[headerName] = headerValue
					}
					rulesProcessed++
				}
			}
		}
	}
	logger.Debug("Finished processing team HTTP headers", "datasource_uid", dsUID, "rules_processed", rulesProcessed, "user_teams", len(userTeamIDs))
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
