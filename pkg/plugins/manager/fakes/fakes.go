package fakes

import (
	"archive/zip"
	"context"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

type FakeLoader struct {
	LoadFunc func(_ context.Context, _ plugins.Class, paths []string, _ map[string]struct{}) ([]*plugins.Plugin, error)

	LoadedPaths []string
}

func (l *FakeLoader) Load(ctx context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
	if l.LoadFunc != nil {
		return l.LoadFunc(ctx, class, paths, ignore)
	}

	l.LoadedPaths = append(l.LoadedPaths, paths...)

	return nil, nil
}

type FakePluginClient struct {
	ID      string
	Managed bool
	Log     log.Logger

	startCount     int
	stopCount      int
	exited         bool
	decommissioned bool
	backend.CollectMetricsHandlerFunc
	backend.CheckHealthHandlerFunc
	backend.QueryDataHandlerFunc
	backend.CallResourceHandlerFunc
	mutex sync.RWMutex

	backendplugin.Plugin
}

func (pc *FakePluginClient) PluginID() string {
	return pc.ID
}

func (pc *FakePluginClient) Logger() log.Logger {
	return pc.Log
}

func (pc *FakePluginClient) Start(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.exited = false
	pc.startCount++
	return nil
}

func (pc *FakePluginClient) Stop(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.stopCount++
	pc.exited = true
	return nil
}

func (pc *FakePluginClient) IsManaged() bool {
	return pc.Managed
}

func (pc *FakePluginClient) Exited() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.exited
}

func (pc *FakePluginClient) Decommission() error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.decommissioned = true
	return nil
}

func (pc *FakePluginClient) IsDecommissioned() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.decommissioned
}

func (pc *FakePluginClient) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if pc.CollectMetricsHandlerFunc != nil {
		return pc.CollectMetricsHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if pc.CheckHealthHandlerFunc != nil {
		return pc.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pc.QueryDataHandlerFunc != nil {
		return pc.QueryDataHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if pc.CallResourceHandlerFunc != nil {
		return pc.CallResourceHandlerFunc(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginClient) SubscribeStream(_ context.Context, _ *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginClient) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *FakePluginClient) RunStream(_ context.Context, _ *backend.RunStreamRequest, _ *backend.StreamSender) error {
	return backendplugin.ErrMethodNotImplemented
}

type FakePluginRegistry struct {
	Store map[string]*plugins.Plugin
}

func NewFakePluginRegistry() *FakePluginRegistry {
	return &FakePluginRegistry{
		Store: make(map[string]*plugins.Plugin),
	}
}

func (f *FakePluginRegistry) Plugin(_ context.Context, id string) (*plugins.Plugin, bool) {
	p, exists := f.Store[id]
	return p, exists
}

func (f *FakePluginRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin

	for _, p := range f.Store {
		res = append(res, p)
	}

	return res
}

func (f *FakePluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	f.Store[p.ID] = p
	return nil
}

func (f *FakePluginRegistry) Remove(_ context.Context, id string) error {
	delete(f.Store, id)
	return nil
}

type FakePluginRepo struct {
	GetPluginArchiveFunc         func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	GetPluginArchiveByURLFunc    func(_ context.Context, archiveURL string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	GetPluginDownloadOptionsFunc func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error)
}

// GetPluginArchive fetches the requested plugin archive.
func (r *FakePluginRepo) GetPluginArchive(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	if r.GetPluginArchiveFunc != nil {
		return r.GetPluginArchiveFunc(ctx, pluginID, version, opts)
	}

	return &repo.PluginArchive{}, nil
}

// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
func (r *FakePluginRepo) GetPluginArchiveByURL(ctx context.Context, archiveURL string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	if r.GetPluginArchiveByURLFunc != nil {
		return r.GetPluginArchiveByURLFunc(ctx, archiveURL, opts)
	}

	return &repo.PluginArchive{}, nil
}

// GetPluginDownloadOptions fetches information for downloading the requested plugin.
func (r *FakePluginRepo) GetPluginDownloadOptions(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
	if r.GetPluginDownloadOptionsFunc != nil {
		return r.GetPluginDownloadOptionsFunc(ctx, pluginID, version, opts)
	}
	return &repo.PluginDownloadOptions{}, nil
}

type FakePluginStorage struct {
	AddFunc    func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error)
	RemoveFunc func(_ context.Context, pluginID string) error
	Added      map[string]string
	Removed    map[string]int
}

func (s *FakePluginStorage) Add(ctx context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
	s.Added[pluginID] = z.File[0].Name
	if s.AddFunc != nil {
		return s.AddFunc(ctx, pluginID, z)
	}
	return &storage.ExtractedPluginArchive{}, nil
}

func (s *FakePluginStorage) Remove(ctx context.Context, pluginID string) error {
	s.Removed[pluginID]++
	if s.RemoveFunc != nil {
		return s.RemoveFunc(ctx, pluginID)
	}
	return nil
}

type FakeProcessManager struct {
	StartFunc func(_ context.Context, pluginID string) error
	StopFunc  func(_ context.Context, pluginID string) error
	Started   map[string]int
	Stopped   map[string]int
}

func NewFakeProcessManager() *FakeProcessManager {
	return &FakeProcessManager{
		Started: make(map[string]int),
		Stopped: make(map[string]int),
	}
}

func (m *FakeProcessManager) Start(ctx context.Context, pluginID string) error {
	m.Started[pluginID]++
	if m.StartFunc != nil {
		return m.StartFunc(ctx, pluginID)
	}
	return nil
}

func (m *FakeProcessManager) Stop(ctx context.Context, pluginID string) error {
	m.Stopped[pluginID]++
	if m.StopFunc != nil {
		return m.StopFunc(ctx, pluginID)
	}
	return nil
}
