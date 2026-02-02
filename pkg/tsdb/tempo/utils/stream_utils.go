package stream_utils

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
	var data map[string]interface{}
	err := json.Unmarshal(jsonData, &data)
	if err != nil {
		return nil, err
	}

	// fetch team http headers
	if teamHttpHeaders, ok := data["teamHttpHeaders"]; ok {
		// team headers have the following structure
		// headers: [<team_id>: [{header: <header_name>, value: <header_value>}]]
		// header_value is whatever the user has set under LBAC permissions for their given rule.
		if lbacHeaders, ok := teamHttpHeaders.(map[string]interface{})["headers"]; ok {
			headerMap := lbacHeaders.(map[string]interface{})
			labelPolicyKey, labelPolicyValue := getLabelPolicyKeyValue(headerMap)

			if labelPolicyKey != "" && labelPolicyValue != "" {
				headers[labelPolicyKey] = labelPolicyValue
			}
		}
	}
	return headers, nil
}

func getLabelPolicyKeyValue(headerWithRules map[string]interface{}) (string, string) {
	labelPolicyKey := ""
	labelPolicyValue := ""
	// we go through each teams' rule and ignoring the team, go through their set rules and prepare them to be all appended for the X-Prom-Label-Policy header value
	// the result will be a comma separated list of the rules:
	// "<rule_num>:<rule_value>, <rule_num>:<rule_value>"
	for _, accessRuleValue := range headerWithRules {
		rules := accessRuleValue.([]interface{})
		for _, accessRule := range rules {
			header := accessRule.(map[string]interface{})
			for key, value := range header {
				// for now, team headers only contain a single header key value, but in case in the future more are introduced, we make sure we only set the one we care about.
				if key == "header" && value == "X-Prom-Label-Policy" {
					labelPolicyKey = value.(string)
					continue
				}
				if key == "value" {
					if valueStr, ok := value.(string); ok {
						if labelPolicyValue == "" {
							labelPolicyValue = valueStr
						} else {
							labelPolicyValue += "," + valueStr
						}
					}
				}
			}
		}
	}

	return labelPolicyKey, labelPolicyValue
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
