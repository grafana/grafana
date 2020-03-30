package backendplugin

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/errutil"
	plugin "github.com/hashicorp/go-plugin"
)

// BackendPlugin a registered backend plugin.
type BackendPlugin struct {
	id             string
	executablePath string
	managed        bool
	clientFactory  func() *plugin.Client
	client         *plugin.Client
	logger         log.Logger
	startFns       PluginStartFuncs
	diagnostics    DiagnosticsPlugin
	resource       ResourcePlugin
}

func (p *BackendPlugin) start(ctx context.Context) error {
	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	var legacyClient *LegacyClient
	var client *Client

	if p.client.NegotiatedVersion() > 1 {
		rawDiagnostics, err := rpcClient.Dispense("diagnostics")
		if err != nil {
			return err
		}

		rawResource, err := rpcClient.Dispense("resource")
		if err != nil {
			return err
		}

		rawData, err := rpcClient.Dispense("data")
		if err != nil {
			return err
		}

		rawTransform, err := rpcClient.Dispense("transform")
		if err != nil {
			return err
		}

		if rawDiagnostics != nil {
			if plugin, ok := rawDiagnostics.(DiagnosticsPlugin); ok {
				p.diagnostics = plugin
			}
		}

		client = &Client{}
		if rawResource != nil {
			if plugin, ok := rawResource.(ResourcePlugin); ok {
				p.resource = plugin
				client.ResourcePlugin = plugin
			}
		}

		if rawData != nil {
			if plugin, ok := rawData.(DataPlugin); ok {
				client.DataPlugin = plugin
			}
		}

		if rawTransform != nil {
			if plugin, ok := rawTransform.(TransformPlugin); ok {
				client.TransformPlugin = plugin
			}
		}
	} else {
		raw, err := rpcClient.Dispense(p.id)
		if err != nil {
			return err
		}

		legacyClient = &LegacyClient{}
		if plugin, ok := raw.(datasourceV1.DatasourcePlugin); ok {
			legacyClient.DatasourcePlugin = plugin
		}

		if plugin, ok := raw.(rendererV1.RendererPlugin); ok {
			legacyClient.RendererPlugin = plugin
		}
	}

	if legacyClient == nil && client == nil {
		return errors.New("no compatible plugin implementation found")
	}

	if legacyClient != nil && p.startFns.OnLegacyStart != nil {
		if err := p.startFns.OnLegacyStart(p.id, legacyClient, p.logger); err != nil {
			return err
		}
	}

	if client != nil && p.startFns.OnStart != nil {
		if err := p.startFns.OnStart(p.id, client, p.logger); err != nil {
			return err
		}
	}

	return nil
}

func (p *BackendPlugin) stop() error {
	if p.client != nil {
		p.client.Kill()
	}
	return nil
}

// supportsDiagnostics return whether backend plugin supports diagnostics like metrics and health check.
func (p *BackendPlugin) supportsDiagnostics() bool {
	return p.diagnostics != nil
}

// CollectMetrics implements the collector.Collector interface.
func (p *BackendPlugin) CollectMetrics(ctx context.Context) (*pluginv2.CollectMetricsResponse, error) {
	if p.diagnostics == nil || p.client == nil || p.client.Exited() {
		return &pluginv2.CollectMetricsResponse{
			Metrics: &pluginv2.CollectMetricsResponse_Payload{},
		}, nil
	}

	res, err := p.diagnostics.CollectMetrics(ctx, &pluginv2.CollectMetricsRequest{})
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &pluginv2.CollectMetricsResponse{
					Metrics: &pluginv2.CollectMetricsResponse_Payload{},
				}, nil
			}
		}

		return nil, err
	}

	return res, nil
}

func (p *BackendPlugin) checkHealth(ctx context.Context, config *PluginConfig) (*pluginv2.CheckHealthResponse, error) {
	if p.diagnostics == nil || p.client == nil || p.client.Exited() {
		return &pluginv2.CheckHealthResponse{
			Status: pluginv2.CheckHealthResponse_UNKNOWN,
		}, nil
	}

	jsonDataBytes, err := config.JSONData.ToDB()
	if err != nil {
		return nil, err
	}

	pconfig := &pluginv2.PluginConfig{
		OrgId:                   config.OrgID,
		PluginId:                config.PluginID,
		JsonData:                jsonDataBytes,
		DecryptedSecureJsonData: config.DecryptedSecureJSONData,
		LastUpdatedMS:           config.Updated.UnixNano() / int64(time.Millisecond),
	}

	if config.DataSourceConfig != nil {
		datasourceJSONData, err := config.DataSourceConfig.JSONData.ToDB()
		if err != nil {
			return nil, err
		}

		pconfig.DatasourceConfig = &pluginv2.DataSourceConfig{
			Id:                      config.DataSourceConfig.ID,
			Name:                    config.DataSourceConfig.Name,
			Url:                     config.DataSourceConfig.URL,
			User:                    config.DataSourceConfig.User,
			Database:                config.DataSourceConfig.Database,
			BasicAuthEnabled:        config.DataSourceConfig.BasicAuthEnabled,
			BasicAuthUser:           config.DataSourceConfig.BasicAuthUser,
			JsonData:                datasourceJSONData,
			DecryptedSecureJsonData: config.DataSourceConfig.DecryptedSecureJSONData,
			LastUpdatedMS:           config.DataSourceConfig.Updated.Unix() / int64(time.Millisecond),
		}
	}

	res, err := p.diagnostics.CheckHealth(ctx, &pluginv2.CheckHealthRequest{Config: pconfig})
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &pluginv2.CheckHealthResponse{
					Status:  pluginv2.CheckHealthResponse_UNKNOWN,
					Message: "Health check not implemented",
				}, nil
			}
		}
		return nil, err
	}

	return res, nil
}

func (p *BackendPlugin) callResource(ctx context.Context, req CallResourceRequest) (callResourceResultStream, error) {
	p.logger.Debug("Calling resource", "path", req.Path, "method", req.Method)

	if p.resource == nil || p.client == nil || p.client.Exited() {
		return nil, errors.New("plugin not running, cannot call resource")
	}

	reqHeaders := map[string]*pluginv2.StringList{}
	for k, v := range req.Headers {
		reqHeaders[k] = &pluginv2.StringList{Values: v}
	}

	jsonDataBytes, err := req.Config.JSONData.ToDB()
	if err != nil {
		return nil, err
	}

	protoReq := &pluginv2.CallResourceRequest{
		Config: &pluginv2.PluginConfig{
			OrgId:                   req.Config.OrgID,
			PluginId:                req.Config.PluginID,
			JsonData:                jsonDataBytes,
			DecryptedSecureJsonData: req.Config.DecryptedSecureJSONData,
			LastUpdatedMS:           req.Config.Updated.UnixNano() / int64(time.Millisecond),
		},
		Path:    req.Path,
		Method:  req.Method,
		Url:     req.URL,
		Headers: reqHeaders,
		Body:    req.Body,
	}

	if req.User != nil {
		protoReq.User = &pluginv2.User{
			Name:  req.User.Name,
			Login: req.User.Login,
			Email: req.User.Email,
			Role:  string(req.User.OrgRole),
		}
	}

	if req.Config.DataSourceConfig != nil {
		datasourceJSONData, err := req.Config.DataSourceConfig.JSONData.ToDB()
		if err != nil {
			return nil, err
		}

		protoReq.Config.DatasourceConfig = &pluginv2.DataSourceConfig{
			Id:                      req.Config.DataSourceConfig.ID,
			Name:                    req.Config.DataSourceConfig.Name,
			Url:                     req.Config.DataSourceConfig.URL,
			Database:                req.Config.DataSourceConfig.Database,
			User:                    req.Config.DataSourceConfig.User,
			BasicAuthEnabled:        req.Config.DataSourceConfig.BasicAuthEnabled,
			BasicAuthUser:           req.Config.DataSourceConfig.BasicAuthUser,
			JsonData:                datasourceJSONData,
			DecryptedSecureJsonData: req.Config.DataSourceConfig.DecryptedSecureJSONData,
			LastUpdatedMS:           req.Config.DataSourceConfig.Updated.UnixNano() / int64(time.Millisecond),
		}
	}

	protoStream, err := p.resource.CallResource(ctx, protoReq)
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &singleCallResourceResult{
					result: &CallResourceResult{
						Status: http.StatusNotImplemented,
					},
				}, nil
			}
		}

		return nil, errutil.Wrap("Failed to call resource", err)
	}

	return &callResourceResultStreamImpl{
		stream: protoStream,
	}, nil
}
