package client

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

const testPluginID = "testDatasource"

func Test_PluginClient(t *testing.T) {
	newScenario(t, []func(plugin *plugins.Plugin){}, func(t *testing.T, ctx *scenarioCtx) {
		t.Run("Unimplemented handlers", func(t *testing.T) {
			t.Run("Collect metrics should return method not implemented error", func(t *testing.T) {
				_, err := ctx.pluginClientManager.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
				require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
			})

			t.Run("Check health should return method not implemented error", func(t *testing.T) {
				_, err := ctx.pluginClientManager.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
				require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
			})
		})
	})

	newScenario(t, []func(plugin *plugins.Plugin){}, func(t *testing.T, ctx *scenarioCtx) {
		t.Run("Implemented handlers", func(t *testing.T) {
			t.Run("Collect metrics should return expected result", func(t *testing.T) {

				ctx.pluginClient.CollectMetricsHandlerFunc = func(_ context.Context, _ *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
					return &backend.CollectMetricsResult{
						PrometheusMetrics: []byte("hello"),
					}, nil
				}

				res, err := ctx.pluginClientManager.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
				require.NoError(t, err)
				require.NotNil(t, res)
				require.Equal(t, "hello", string(res.PrometheusMetrics))
			})

			t.Run("Check health should return expected result", func(t *testing.T) {
				json := []byte(`{
							"key": "value"
						}`)
				ctx.pluginClient.CheckHealthHandlerFunc = func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
					return &backend.CheckHealthResult{
						Status:      backend.HealthStatusOk,
						Message:     "All good",
						JSONDetails: json,
					}, nil
				}

				res, err := ctx.pluginClientManager.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
				require.NoError(t, err)
				require.NotNil(t, res)
				require.Equal(t, backend.HealthStatusOk, res.Status)
				require.Equal(t, "All good", res.Message)
				require.Equal(t, json, res.JSONDetails)
			})

			t.Run("Call resource should return expected response", func(t *testing.T) {
				ctx.pluginClient.CallResourceHandlerFunc = func(ctx context.Context,
					req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
					return sender.Send(&backend.CallResourceResponse{
						Status: http.StatusOK,
					})
				}

				sender := &fakeSender{}
				err := ctx.pluginClientManager.CallResource(context.Background(), &backend.CallResourceRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}}, sender)
				require.NoError(t, err)
				require.NotNil(t, sender.resp)
				require.Equal(t, http.StatusOK, sender.resp.Status)
			})
		})
	})
}

func newScenario(t *testing.T, cbs []func(*plugins.Plugin), fn func(t *testing.T, ctx *scenarioCtx)) {
	t.Helper()

	p, pc := createPlugin(t, cbs...)

	ctx := &scenarioCtx{
		pluginClientManager: &PluginClientManager{pluginRegistry: &fakeInternalRegistry{
			store: map[string]*plugins.Plugin{
				testPluginID: p,
			},
		}},
		pluginClient: pc,
	}

	fn(t, ctx)
}

type scenarioCtx struct {
	pluginClientManager *PluginClientManager
	pluginClient        *fakePluginClient
}

type fakePluginClient struct {
	pluginID       string
	logger         log.Logger
	startCount     int
	stopCount      int
	managed        bool
	exited         bool
	decommissioned bool
	backend.CollectMetricsHandlerFunc
	backend.CheckHealthHandlerFunc
	backend.QueryDataHandlerFunc
	backend.CallResourceHandlerFunc
	mutex sync.RWMutex

	backendplugin.Plugin
}

func (pc *fakePluginClient) PluginID() string {
	return pc.pluginID
}

func (pc *fakePluginClient) Logger() log.Logger {
	return pc.logger
}

func (pc *fakePluginClient) Start(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.exited = false
	pc.startCount++
	return nil
}

func (pc *fakePluginClient) Stop(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.stopCount++
	pc.exited = true
	return nil
}

func (pc *fakePluginClient) IsManaged() bool {
	return pc.managed
}

func (pc *fakePluginClient) Exited() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.exited
}

func (pc *fakePluginClient) Decommission() error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()

	pc.decommissioned = true

	return nil
}

func (pc *fakePluginClient) IsDecommissioned() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.decommissioned
}

func (pc *fakePluginClient) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if pc.CollectMetricsHandlerFunc != nil {
		return pc.CollectMetricsHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if pc.CheckHealthHandlerFunc != nil {
		return pc.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pc.QueryDataHandlerFunc != nil {
		return pc.QueryDataHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if pc.CallResourceHandlerFunc != nil {
		return pc.CallResourceHandlerFunc(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) SubscribeStream(_ context.Context, _ *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) RunStream(_ context.Context, _ *backend.RunStreamRequest, _ *backend.StreamSender) error {
	return backendplugin.ErrMethodNotImplemented
}

func createPlugin(t *testing.T, cbs ...func(*plugins.Plugin)) (*plugins.Plugin, *fakePluginClient) {
	t.Helper()

	p := &plugins.Plugin{
		Class: plugins.External,
		JSONData: plugins.JSONData{
			ID:      testPluginID,
			Type:    plugins.DataSource,
			Backend: true,
		},
	}

	logger := fakeLogger{}

	p.SetLogger(logger)

	pc := &fakePluginClient{
		pluginID: testPluginID,
		logger:   logger,
		managed:  true,
	}

	p.RegisterClient(pc)

	for _, cb := range cbs {
		cb(p)
	}

	return p, pc
}

type fakeSender struct {
	resp *backend.CallResourceResponse
}

func (s *fakeSender) Send(crr *backend.CallResourceResponse) error {
	s.resp = crr

	return nil
}

type fakeInternalRegistry struct {
	store map[string]*plugins.Plugin
}

func (f *fakeInternalRegistry) Plugin(_ context.Context, id string) (*plugins.Plugin, bool) {
	p, exists := f.store[id]
	return p, exists
}

func (f *fakeInternalRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin

	for _, p := range f.store {
		res = append(res, p)
	}

	return res
}

func (f *fakeInternalRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	f.store[p.ID] = p
	return nil
}

func (f *fakeInternalRegistry) Remove(_ context.Context, id string) error {
	delete(f.store, id)
	return nil
}

type fakeLogger struct {
	log.Logger
}

func (l fakeLogger) Info(_ string, _ ...interface{}) {

}

func (l fakeLogger) Debug(_ string, _ ...interface{}) {

}
