package clientmiddleware

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

const (
	pluginID = "plugin-id"

	metricRequestTotal      = "grafana_plugin_request_total"
	metricRequestDurationMs = "grafana_plugin_request_duration_milliseconds"
	metricRequestDurationS  = "grafana_plugin_request_duration_seconds"
	metricRequestSize       = "grafana_plugin_request_size_bytes"
)

func TestInstrumentationMiddleware(t *testing.T) {
	pCtx := backend.PluginContext{PluginID: pluginID}
	t.Run("should instrument requests", func(t *testing.T) {
		for _, tc := range []struct {
			expEndpoint                 backend.Endpoint
			fn                          func(cdt *handlertest.HandlerMiddlewareTest) error
			shouldInstrumentRequestSize bool
		}{
			{
				expEndpoint: backend.EndpointCheckHealth,
				fn: func(cdt *handlertest.HandlerMiddlewareTest) error {
					_, err := cdt.MiddlewareHandler.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: pCtx})
					return err
				},
				shouldInstrumentRequestSize: false,
			},
			{
				expEndpoint: backend.EndpointCallResource,
				fn: func(cdt *handlertest.HandlerMiddlewareTest) error {
					return cdt.MiddlewareHandler.CallResource(context.Background(), &backend.CallResourceRequest{PluginContext: pCtx}, nopCallResourceSender)
				},
				shouldInstrumentRequestSize: true,
			},
			{
				expEndpoint: backend.EndpointQueryData,
				fn: func(cdt *handlertest.HandlerMiddlewareTest) error {
					_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: pCtx})
					return err
				},
				shouldInstrumentRequestSize: true,
			},
			{
				expEndpoint: backend.EndpointCollectMetrics,
				fn: func(cdt *handlertest.HandlerMiddlewareTest) error {
					_, err := cdt.MiddlewareHandler.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{PluginContext: pCtx})
					return err
				},
				shouldInstrumentRequestSize: false,
			},
		} {
			t.Run(string(tc.expEndpoint), func(t *testing.T) {
				promRegistry := prometheus.NewRegistry()
				pluginsRegistry := fakes.NewFakePluginRegistry()
				require.NoError(t, pluginsRegistry.Add(context.Background(), &plugins.Plugin{
					JSONData: plugins.JSONData{ID: pluginID, Backend: true},
				}))

				mw := newMetricsMiddleware(promRegistry, pluginsRegistry)
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(
					backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
						mw.BaseHandler = backend.NewBaseHandler(next)
						return mw
					}),
				))
				require.NoError(t, tc.fn(cdt))

				// Ensure the correct metrics have been incremented/observed
				require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestTotal))
				require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestDurationMs))
				require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestDurationS))

				counter := mw.pluginRequestCounter.WithLabelValues(pluginID, string(tc.expEndpoint), instrumentationutils.RequestStatusOK.String(), string(backendplugin.TargetUnknown), string(backend.DefaultErrorSource))
				require.Equal(t, 1.0, testutil.ToFloat64(counter))
				for _, m := range []string{metricRequestDurationMs, metricRequestDurationS} {
					require.NoError(t, checkHistogram(promRegistry, m, map[string]string{
						"plugin_id": pluginID,
						"endpoint":  string(tc.expEndpoint),
						"target":    string(backendplugin.TargetUnknown),
					}))
				}
				if tc.shouldInstrumentRequestSize {
					require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestSize), "request size should have been instrumented")
					require.NoError(t, checkHistogram(promRegistry, metricRequestSize, map[string]string{
						"plugin_id": pluginID,
						"endpoint":  string(tc.expEndpoint),
						"target":    string(backendplugin.TargetUnknown),
						"source":    "grafana-backend",
					}), "request size should have been instrumented")
				}
			})
		}
	})
}

func TestInstrumentationMiddlewareStatusSource(t *testing.T) {
	const labelStatusSource = "status_source"
	queryDataErrorCounterLabels := prometheus.Labels{
		"plugin_id": pluginID,
		"endpoint":  string(backend.EndpointQueryData),
		"status":    instrumentationutils.RequestStatusError.String(),
		"target":    string(backendplugin.TargetUnknown),
	}
	downstreamErrorResponse := backend.DataResponse{
		Frames:      nil,
		Error:       errors.New("bad gateway"),
		Status:      502,
		ErrorSource: backend.ErrorSourceDownstream,
	}
	pluginErrorResponse := backend.DataResponse{
		Frames:      nil,
		Error:       errors.New("internal error"),
		Status:      500,
		ErrorSource: backend.ErrorSourcePlugin,
	}
	legacyErrorResponse := backend.DataResponse{
		Frames:      nil,
		Error:       errors.New("internal error"),
		Status:      500,
		ErrorSource: "",
	}
	okResponse := backend.DataResponse{
		Frames:      nil,
		Error:       nil,
		Status:      200,
		ErrorSource: "",
	}

	pCtx := backend.PluginContext{PluginID: pluginID}

	promRegistry := prometheus.NewRegistry()
	pluginsRegistry := fakes.NewFakePluginRegistry()
	require.NoError(t, pluginsRegistry.Add(context.Background(), &plugins.Plugin{
		JSONData: plugins.JSONData{ID: pluginID, Backend: true},
	}))
	metricsMw := newMetricsMiddleware(promRegistry, pluginsRegistry)
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(
		backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
			metricsMw.BaseHandler = backend.NewBaseHandler(next)
			return metricsMw
		}),
		backend.NewErrorSourceMiddleware(),
	))

	t.Run("Metrics", func(t *testing.T) {
		metricsMw.pluginRequestCounter.Reset()

		cdt.TestHandler.QueryDataFunc = func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			return &backend.QueryDataResponse{Responses: map[string]backend.DataResponse{"A": downstreamErrorResponse}}, nil
		}
		_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: pCtx})
		require.NoError(t, err)
		counter, err := metricsMw.pluginRequestCounter.GetMetricWith(newLabels(
			queryDataErrorCounterLabels,
			prometheus.Labels{
				labelStatusSource: string(backend.ErrorSourceDownstream),
			}),
		)
		require.NoError(t, err)
		require.Equal(t, 1.0, testutil.ToFloat64(counter))
	})

	t.Run("Priority", func(t *testing.T) {
		for _, tc := range []struct {
			name            string
			responses       map[string]backend.DataResponse
			expStatusSource backend.ErrorSource
		}{
			{
				"Default status source for ok responses should be plugin",
				map[string]backend.DataResponse{"A": okResponse},
				backend.ErrorSourcePlugin,
			},
			{
				"Plugin errors should have higher priority than downstream errors",
				map[string]backend.DataResponse{
					"A": pluginErrorResponse,
					"B": downstreamErrorResponse,
				},
				backend.ErrorSourcePlugin,
			},
			{
				"Errors without ErrorSource should be reported as plugin status source",
				map[string]backend.DataResponse{"A": legacyErrorResponse},
				backend.ErrorSourcePlugin,
			},
			{
				"Downstream errors should have higher priority than ok responses",
				map[string]backend.DataResponse{
					"A": okResponse,
					"B": downstreamErrorResponse,
				},
				backend.ErrorSourceDownstream,
			},
			{
				"Plugin errors should have higher priority than ok responses",
				map[string]backend.DataResponse{
					"A": okResponse,
					"B": pluginErrorResponse,
				},
				backend.ErrorSourcePlugin,
			},
			{
				"Legacy errors should have higher priority than ok responses",
				map[string]backend.DataResponse{
					"A": okResponse,
					"B": legacyErrorResponse,
				},
				backend.ErrorSourcePlugin,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				t.Cleanup(func() {
					cdt.QueryDataCtx = nil
					cdt.QueryDataReq = nil
				})
				cdt.TestHandler.QueryDataFunc = func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
					cdt.QueryDataCtx = ctx
					cdt.QueryDataReq = req
					return &backend.QueryDataResponse{Responses: tc.responses}, nil
				}
				_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: pCtx})
				require.NoError(t, err)
				ctxStatusSource := backend.ErrorSourceFromContext(cdt.QueryDataCtx)
				require.Equal(t, tc.expStatusSource, ctxStatusSource)
			})
		}
	})
}

// checkHistogram is a utility function that checks if a histogram with the given name and label values exists
// and has been observed at least once.
func checkHistogram(promRegistry *prometheus.Registry, expMetricName string, expLabels map[string]string) error {
	metrics, err := promRegistry.Gather()
	if err != nil {
		return fmt.Errorf("gather: %w", err)
	}
	var metricFamily *dto.MetricFamily
	for _, mf := range metrics {
		if *mf.Name == expMetricName {
			metricFamily = mf
			break
		}
	}
	if metricFamily == nil {
		return fmt.Errorf("metric %q not found", expMetricName)
	}
	var foundLabels int
	var metric *dto.Metric
	for _, m := range metricFamily.Metric {
		for _, l := range m.GetLabel() {
			v, ok := expLabels[*l.Name]
			if !ok {
				continue
			}
			if v != *l.Value {
				return fmt.Errorf("expected label %q to have value %q, got %q", *l.Name, v, *l.Value)
			}
			foundLabels++
		}
		if foundLabels == 0 {
			continue
		}
		if foundLabels != len(expLabels) {
			return fmt.Errorf("expected %d labels, got %d", len(expLabels), foundLabels)
		}
		metric = m
		break
	}
	if metric == nil {
		return fmt.Errorf("could not find metric with labels %v", expLabels)
	}
	if metric.Histogram == nil {
		return fmt.Errorf("metric %q is not a histogram", expMetricName)
	}
	if metric.Histogram.SampleCount == nil || *metric.Histogram.SampleCount == 0 {
		return errors.New("found metric but no samples have been collected")
	}
	return nil
}

// newLabels creates a new prometheus.Labels from the given initial labels and additional labels.
// The additionalLabels are merged into the initial ones, and will overwrite a value if already set in initialLabels.
func newLabels(initialLabels prometheus.Labels, additional ...prometheus.Labels) prometheus.Labels {
	r := make(prometheus.Labels, len(initialLabels)+len(additional)/2)
	for k, v := range initialLabels {
		r[k] = v
	}
	for _, l := range additional {
		for k, v := range l {
			r[k] = v
		}
	}
	return r
}
