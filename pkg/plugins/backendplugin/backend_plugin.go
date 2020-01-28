package backendplugin

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/resource"

	"gopkg.in/macaron.v1"

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
	resources      map[string]*pluginv2.Resource
	routerTree     *macaron.Tree
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
				client.DatasourcePlugin = plugin
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

	res, err := p.getSchema(ctx)
	if err != nil {
		return errutil.Wrap("Failed to get schema for plugin", err)
	}

	p.resources = res.Resources
	p.routerTree = macaron.NewTree()

	for resourceName, resource := range p.resources {
		p.logger.Info("got resource", "name", resourceName)
		for _, r := range resource.Routes {
			resourcePath := resource.Path + r.Path
			p.logger.Info("adding route to tree", "resourcePath", resourcePath)
			p.routerTree.Add(resourcePath, createResourceHandler(p, resourceName, resourcePath))
		}
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

func (p *BackendPlugin) getSchema(ctx context.Context) (*pluginv2.GetSchema_Response, error) {
	if p.core == nil {
		return &pluginv2.GetSchema_Response{
			Resources: map[string]*pluginv2.Resource{},
		}, nil
	}

	res, err := p.core.GetSchema(ctx, &pluginv2.GetSchema_Request{})
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unimplemented {
				return &pluginv2.GetSchema_Response{
					Resources: map[string]*pluginv2.Resource{},
				}, nil
			}
		}

		return nil, err
	}

	return res, nil
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
					Status: pluginv2.CheckHealth_Response_UNKNOWN,
					Info:   "Health check not implemented",
				}, nil
			}
		}
		return nil, err
	}

	return res, nil
}

func (p *BackendPlugin) callResource(ctx context.Context, req CallResourceRequest) (*CallResourceResult, error) {
	if p.resources == nil {
		return &CallResourceResult{
			Status:  http.StatusNotFound,
			Headers: map[string][]string{"Content-Type": {"application/json"}},
		}, nil
	}

	p.logger.Debug("Calling resource", "path", req.Path, "method", req.Method)

	handle, params, matched := p.routerTree.Match(req.Path)
	if !matched {
		return &CallResourceResult{
			Status:  http.StatusNotFound,
			Headers: map[string][]string{"Content-Type": {"application/json"}},
		}, nil
	}

	rw := resource.NewResourceResponseWriter()
	r := bytes.NewReader(req.Body)
	httpReq, err := http.NewRequest(req.Method, req.URL, r)
	if err != nil {
		return nil, err
	}
	handle(rw, httpReq, params)
	result := rw.Result()
	p.logger.Debug("Call resource response", "res", result)

	headers := map[string][]string{}
	for key, values := range result.Headers {
		headers[key] = values.Values
	}

	return &CallResourceResult{
		Headers: headers,
		Body:    result.Body,
		Status:  int(result.Code),
	}, nil
}

func createResourceHandler(p *BackendPlugin, resourceName, resourcePath string) macaron.Handle {
	return macaron.Handle(func(rw http.ResponseWriter, req *http.Request, params macaron.Params) {
		var body []byte
		var err error
		if req.Body != nil {
			defer req.Body.Close()
			body, err = ioutil.ReadAll(req.Body)
			if err != nil {
				p.logger.Error("Failed to read request body", "error", err)
				return
			}
		}
		protoReq := &pluginv2.CallResource_Request{
			Config:       &pluginv2.PluginConfig{},
			ResourceName: resourceName,
			ResourcePath: resourcePath,
			Method:       req.Method,
			Url:          req.URL.String(),
			Params:       params,
			Body:         body,
		}
		protoRes, err := p.core.CallResource(req.Context(), protoReq)
		if err != nil {
			p.logger.Error("Failed to call resource", "error", err)
			return
		}

		for key, values := range protoRes.Headers {
			for _, v := range values.Values {
				rw.Header().Add(key, v)
			}
		}

		rw.WriteHeader(int(protoRes.Code))
		_, err = rw.Write(protoRes.Body)
		if err != nil {
			p.logger.Error("Failed to write resource response", "error", err)
		}
	})
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
