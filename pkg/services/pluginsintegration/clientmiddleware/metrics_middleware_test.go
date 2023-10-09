package clientmiddleware

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

func TestInstrumentationMiddleware(t *testing.T) {
	const (
		pluginID = "plugin-id"

		metricRequestTotal      = "grafana_plugin_request_total"
		metricRequestDurationMs = "grafana_plugin_request_duration_milliseconds"
		metricRequestDurationS  = "grafana_plugin_request_duration_seconds"
		metricRequestSize       = "grafana_plugin_request_size_bytes"
	)

	pCtx := backend.PluginContext{PluginID: pluginID}

	t.Run("should instrument requests", func(t *testing.T) {
		for _, tc := range []struct {
			expEndpoint                 string
			fn                          func(cdt *clienttest.ClientDecoratorTest) error
			shouldInstrumentRequestSize bool
		}{
			{
				expEndpoint: endpointCheckHealth,
				fn: func(cdt *clienttest.ClientDecoratorTest) error {
					_, err := cdt.Decorator.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: pCtx})
					return err
				},
				shouldInstrumentRequestSize: false,
			},
			{
				expEndpoint: endpointCallResource,
				fn: func(cdt *clienttest.ClientDecoratorTest) error {
					return cdt.Decorator.CallResource(context.Background(), &backend.CallResourceRequest{PluginContext: pCtx}, nopCallResourceSender)
				},
				shouldInstrumentRequestSize: true,
			},
			{
				expEndpoint: endpointQueryData,
				fn: func(cdt *clienttest.ClientDecoratorTest) error {
					_, err := cdt.Decorator.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: pCtx})
					return err
				},
				shouldInstrumentRequestSize: true,
			},
			{
				expEndpoint: endpointCollectMetrics,
				fn: func(cdt *clienttest.ClientDecoratorTest) error {
					_, err := cdt.Decorator.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{PluginContext: pCtx})
					return err
				},
				shouldInstrumentRequestSize: false,
			},
		} {
			t.Run(tc.expEndpoint, func(t *testing.T) {
				promRegistry := prometheus.NewRegistry()
				pluginsRegistry := fakes.NewFakePluginRegistry()
				require.NoError(t, pluginsRegistry.Add(context.Background(), &plugins.Plugin{
					JSONData: plugins.JSONData{ID: pluginID, Backend: true},
				}))

				mw := newMetricsMiddleware(promRegistry, pluginsRegistry)
				cdt := clienttest.NewClientDecoratorTest(t, clienttest.WithMiddlewares(
					plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
						mw.next = next
						return mw
					}),
				))
				require.NoError(t, tc.fn(cdt))

				// Ensure the correct metrics have been incremented/observed
				require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestTotal))
				require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestDurationMs))
				require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestDurationS))

				counter := mw.pluginMetrics.pluginRequestCounter.WithLabelValues(pluginID, tc.expEndpoint, statusOK, string(backendplugin.TargetUnknown))
				require.Equal(t, 1.0, testutil.ToFloat64(counter))
				for _, m := range []string{metricRequestDurationMs, metricRequestDurationS} {
					require.NoError(t, checkHistogram(promRegistry, m, map[string]string{
						"plugin_id": pluginID,
						"endpoint":  tc.expEndpoint,
						"target":    string(backendplugin.TargetUnknown),
					}))
				}
				if tc.shouldInstrumentRequestSize {
					require.Equal(t, 1, testutil.CollectAndCount(promRegistry, metricRequestSize), "request size should have been instrumented")
					require.NoError(t, checkHistogram(promRegistry, metricRequestSize, map[string]string{
						"plugin_id": pluginID,
						"endpoint":  tc.expEndpoint,
						"target":    string(backendplugin.TargetUnknown),
						"source":    "grafana-backend",
					}), "request size should have been instrumented")
				}
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
