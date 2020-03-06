package backendplugin

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/expfmt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/collector"
	"github.com/grafana/grafana/pkg/util/errutil"
	plugin "github.com/hashicorp/go-plugin"
	dto "github.com/prometheus/client_model/go"
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
	core           CorePlugin
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

		rawBackend, err := rpcClient.Dispense("backend")
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
		if rawBackend != nil {
			if plugin, ok := rawBackend.(CorePlugin); ok {
				p.core = plugin
				client.CorePlugin = plugin
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
func (p *BackendPlugin) CollectMetrics(ctx context.Context, ch chan<- prometheus.Metric) error {
	if p.diagnostics == nil {
		return nil
	}

	if p.client == nil || p.client.Exited() {
		return nil
	}

	res, err := p.diagnostics.CollectMetrics(ctx, &pluginv2.CollectMetrics_Request{})
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return nil
			}
		}

		return err
	}

	if res == nil || res.Metrics == nil || res.Metrics.Prometheus == nil {
		return nil
	}

	reader := bytes.NewReader(res.Metrics.Prometheus)
	var parser expfmt.TextParser
	families, err := parser.TextToMetricFamilies(reader)
	if err != nil {
		return errutil.Wrap("failed to parse collected metrics", err)
	}

	for _, mf := range families {
		if mf.Help == nil {
			help := fmt.Sprintf("Metric read from %s plugin", p.id)
			mf.Help = &help
		}
	}

	for _, mf := range families {
		convertMetricFamily(p.id, mf, ch, p.logger)
	}

	return nil
}

func (p *BackendPlugin) checkHealth(ctx context.Context) (*pluginv2.CheckHealth_Response, error) {
	if p.diagnostics == nil || p.client == nil || p.client.Exited() {
		return &pluginv2.CheckHealth_Response{
			Status: pluginv2.CheckHealth_Response_UNKNOWN,
		}, nil
	}

	res, err := p.diagnostics.CheckHealth(ctx, &pluginv2.CheckHealth_Request{})
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &pluginv2.CheckHealth_Response{
					Status:  pluginv2.CheckHealth_Response_UNKNOWN,
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

	if p.core == nil || p.client == nil || p.client.Exited() {
		return nil, errors.New("plugin not running, cannot call resource")
	}

	reqHeaders := map[string]*pluginv2.CallResource_StringList{}
	for k, v := range req.Headers {
		reqHeaders[k] = &pluginv2.CallResource_StringList{Values: v}
	}

	jsonDataBytes, err := req.Config.JSONData.ToDB()
	if err != nil {
		return nil, err
	}

	protoReq := &pluginv2.CallResource_Request{
		Config: &pluginv2.PluginConfig{
			OrgId:                   req.Config.OrgID,
			PluginId:                req.Config.PluginID,
			PluginType:              req.Config.PluginType,
			JsonData:                jsonDataBytes,
			DecryptedSecureJsonData: req.Config.DecryptedSecureJSONData,
			UpdatedMS:               req.Config.Updated.UnixNano() / int64(time.Millisecond),
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
		protoReq.Config.DatasourceConfig = &pluginv2.DataSourceConfig{
			Id:               req.Config.DataSourceConfig.ID,
			Name:             req.Config.DataSourceConfig.Name,
			Url:              req.Config.DataSourceConfig.URL,
			Database:         req.Config.DataSourceConfig.Database,
			User:             req.Config.DataSourceConfig.User,
			BasicAuthEnabled: req.Config.DataSourceConfig.BasicAuthEnabled,
			BasicAuthUser:    req.Config.DataSourceConfig.BasicAuthUser,
		}
	}

	protoStream, err := p.core.CallResource(ctx, protoReq)
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

// convertMetricFamily converts metric family to prometheus.Metric.
// Copied from https://github.com/prometheus/node_exporter/blob/3ddc82c2d8d11eec53ed5faa8db969a1bb81f8bb/collector/textfile.go#L66-L165
func convertMetricFamily(pluginID string, metricFamily *dto.MetricFamily, ch chan<- prometheus.Metric, logger log.Logger) {
	var valType prometheus.ValueType
	var val float64

	allLabelNames := map[string]struct{}{}
	for _, metric := range metricFamily.Metric {
		labels := metric.GetLabel()
		for _, label := range labels {
			if _, ok := allLabelNames[label.GetName()]; !ok {
				allLabelNames[label.GetName()] = struct{}{}
			}
		}
	}

	for _, metric := range metricFamily.Metric {
		if metric.TimestampMs != nil {
			logger.Warn("Ignoring unsupported custom timestamp on metric", "metric", metric)
		}

		labels := metric.GetLabel()
		var names []string
		var values []string
		for _, label := range labels {
			names = append(names, label.GetName())
			values = append(values, label.GetValue())
		}
		names = append(names, "plugin_id")
		values = append(values, pluginID)

		for k := range allLabelNames {
			present := false
			for _, name := range names {
				if k == name {
					present = true
					break
				}
			}
			if !present {
				names = append(names, k)
				values = append(values, "")
			}
		}

		metricName := prometheus.BuildFQName(collector.Namespace, "", *metricFamily.Name)

		metricType := metricFamily.GetType()
		switch metricType {
		case dto.MetricType_COUNTER:
			valType = prometheus.CounterValue
			val = metric.Counter.GetValue()

		case dto.MetricType_GAUGE:
			valType = prometheus.GaugeValue
			val = metric.Gauge.GetValue()

		case dto.MetricType_UNTYPED:
			valType = prometheus.UntypedValue
			val = metric.Untyped.GetValue()

		case dto.MetricType_SUMMARY:
			quantiles := map[float64]float64{}
			for _, q := range metric.Summary.Quantile {
				quantiles[q.GetQuantile()] = q.GetValue()
			}
			ch <- prometheus.MustNewConstSummary(
				prometheus.NewDesc(
					metricName,
					metricFamily.GetHelp(),
					names, nil,
				),
				metric.Summary.GetSampleCount(),
				metric.Summary.GetSampleSum(),
				quantiles, values...,
			)
		case dto.MetricType_HISTOGRAM:
			buckets := map[float64]uint64{}
			for _, b := range metric.Histogram.Bucket {
				buckets[b.GetUpperBound()] = b.GetCumulativeCount()
			}
			ch <- prometheus.MustNewConstHistogram(
				prometheus.NewDesc(
					metricName,
					metricFamily.GetHelp(),
					names, nil,
				),
				metric.Histogram.GetSampleCount(),
				metric.Histogram.GetSampleSum(),
				buckets, values...,
			)
		default:
			logger.Error("unknown metric type", "type", metricType)
			continue
		}

		if metricType == dto.MetricType_GAUGE || metricType == dto.MetricType_COUNTER || metricType == dto.MetricType_UNTYPED {
			ch <- prometheus.MustNewConstMetric(
				prometheus.NewDesc(
					metricName,
					metricFamily.GetHelp(),
					names, nil,
				),
				valType, val, values...,
			)
		}
	}
}
