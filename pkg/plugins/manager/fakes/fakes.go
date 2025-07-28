package fakes

import (
	"archive/zip"
	"context"
	"fmt"
	"io/fs"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

type FakePluginInstaller struct {
	AddFunc func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error
	// Remove removes a plugin from the store.
	RemoveFunc func(ctx context.Context, pluginID, version string) error
}

func (i *FakePluginInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error {
	if i.AddFunc != nil {
		return i.AddFunc(ctx, pluginID, version, opts)
	}
	return nil
}

func (i *FakePluginInstaller) Remove(ctx context.Context, pluginID, version string) error {
	if i.RemoveFunc != nil {
		return i.RemoveFunc(ctx, pluginID, version)
	}
	return nil
}

type FakeLoader struct {
	LoadFunc   func(_ context.Context, _ plugins.PluginSource) ([]*plugins.Plugin, error)
	UnloadFunc func(_ context.Context, _ *plugins.Plugin) (*plugins.Plugin, error)
}

func (l *FakeLoader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	if l.LoadFunc != nil {
		return l.LoadFunc(ctx, src)
	}
	return nil, nil
}

func (l *FakeLoader) Unload(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if l.UnloadFunc != nil {
		return l.UnloadFunc(ctx, p)
	}
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
	backend.MutateAdmissionFunc
	backend.ValidateAdmissionFunc
	backend.ConvertObjectsFunc
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

func (pc *FakePluginClient) Target() backendplugin.Target {
	return "test-target"
}

func (pc *FakePluginClient) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if pc.CollectMetricsHandlerFunc != nil {
		return pc.CollectMetricsHandlerFunc(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if pc.CheckHealthHandlerFunc != nil {
		return pc.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pc.QueryDataHandlerFunc != nil {
		return pc.QueryDataHandlerFunc(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if pc.CallResourceHandlerFunc != nil {
		return pc.CallResourceHandlerFunc(ctx, req, sender)
	}

	return plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) SubscribeStream(_ context.Context, _ *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) RunStream(_ context.Context, _ *backend.RunStreamRequest, _ *backend.StreamSender) error {
	return plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if pc.ValidateAdmissionFunc != nil {
		return pc.ValidateAdmissionFunc(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if pc.MutateAdmissionFunc != nil {
		return pc.MutateAdmissionFunc(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (pc *FakePluginClient) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if pc.ConvertObjectsFunc != nil {
		return pc.ConvertObjectsFunc(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

type FakePluginRegistry struct {
	Store map[string]*plugins.Plugin
}

func NewFakePluginRegistry() *FakePluginRegistry {
	return &FakePluginRegistry{
		Store: make(map[string]*plugins.Plugin),
	}
}

func (f *FakePluginRegistry) Plugin(_ context.Context, id, _ string) (*plugins.Plugin, bool) {
	p, exists := f.Store[id]
	return p, exists
}

func (f *FakePluginRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	res := make([]*plugins.Plugin, 0, len(f.Store))
	for _, p := range f.Store {
		res = append(res, p)
	}

	return res
}

func (f *FakePluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	f.Store[p.ID] = p
	return nil
}

func (f *FakePluginRegistry) Remove(_ context.Context, id, _ string) error {
	delete(f.Store, id)
	return nil
}

type FakePluginRepo struct {
	GetPluginArchiveFunc      func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	GetPluginArchiveByURLFunc func(_ context.Context, archiveURL string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	GetPluginArchiveInfoFunc  func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchiveInfo, error)
	PluginVersionFunc         func(_ context.Context, pluginID, version string, compatOpts repo.CompatOpts) (repo.VersionData, error)
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

// GetPluginArchiveInfo fetches information for downloading the requested plugin.
func (r *FakePluginRepo) GetPluginArchiveInfo(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginArchiveInfo, error) {
	if r.GetPluginArchiveInfoFunc != nil {
		return r.GetPluginArchiveInfoFunc(ctx, pluginID, version, opts)
	}
	return &repo.PluginArchiveInfo{}, nil
}

func (r *FakePluginRepo) PluginVersion(ctx context.Context, pluginID, version string, compatOpts repo.CompatOpts) (repo.VersionData, error) {
	if r.PluginVersionFunc != nil {
		return r.PluginVersionFunc(ctx, pluginID, version, compatOpts)
	}
	return repo.VersionData{}, nil
}

func (r *FakePluginRepo) PluginInfo(ctx context.Context, pluginID string, compatOpts repo.CompatOpts) (*repo.PluginInfo, error) {
	return &repo.PluginInfo{}, nil
}

func (r *FakePluginRepo) GetPluginsInfo(ctx context.Context, options repo.GetPluginsInfoOptions, compatOpts repo.CompatOpts) ([]repo.PluginInfo, error) {
	return []repo.PluginInfo{}, nil
}

type fakeTracerProvider struct {
	noop.TracerProvider
}

func InitializeNoopTracerForTest() trace.Tracer {
	return fakeTracerProvider{}.Tracer("test")
}

type FakePluginStorage struct {
	ExtractFunc func(_ context.Context, pluginID string, dirNameFunc storage.DirNameGeneratorFunc, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error)
}

func NewFakePluginStorage() *FakePluginStorage {
	return &FakePluginStorage{}
}

func (s *FakePluginStorage) Extract(ctx context.Context, pluginID string, dirNameFunc storage.DirNameGeneratorFunc, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
	if s.ExtractFunc != nil {
		return s.ExtractFunc(ctx, pluginID, dirNameFunc, z)
	}
	return &storage.ExtractedPluginArchive{}, nil
}

type FakePluginEnvProvider struct {
	PluginEnvVarsFunc func(ctx context.Context, plugin *plugins.Plugin) []string
}

func NewFakePluginEnvProvider() *FakePluginEnvProvider {
	return &FakePluginEnvProvider{}
}

func (p *FakePluginEnvProvider) PluginEnvVars(ctx context.Context, plugin *plugins.Plugin) []string {
	if p.PluginEnvVarsFunc != nil {
		return p.PluginEnvVarsFunc(ctx, plugin)
	}
	return []string{}
}

type FakeProcessManager struct {
	StartFunc func(_ context.Context, p *plugins.Plugin) error
	StopFunc  func(_ context.Context, p *plugins.Plugin) error
	Started   map[string]int
	Stopped   map[string]int
}

func NewFakeProcessManager() *FakeProcessManager {
	return &FakeProcessManager{
		Started: make(map[string]int),
		Stopped: make(map[string]int),
	}
}

func (m *FakeProcessManager) Start(ctx context.Context, p *plugins.Plugin) error {
	m.Started[p.ID]++
	if m.StartFunc != nil {
		return m.StartFunc(ctx, p)
	}
	return nil
}

func (m *FakeProcessManager) Stop(ctx context.Context, p *plugins.Plugin) error {
	m.Stopped[p.ID]++
	if m.StopFunc != nil {
		return m.StopFunc(ctx, p)
	}
	return nil
}

type FakeBackendProcessProvider struct {
	Requested          map[string]int
	Invoked            map[string]int
	BackendFactoryFunc func(context.Context, *plugins.Plugin) backendplugin.PluginFactoryFunc
}

func NewFakeBackendProcessProvider() *FakeBackendProcessProvider {
	f := &FakeBackendProcessProvider{
		Requested: make(map[string]int),
		Invoked:   make(map[string]int),
	}
	f.BackendFactoryFunc = func(ctx context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
		f.Requested[p.ID]++
		return func(pluginID string, _ log.Logger, _ trace.Tracer, _ func() []string) (backendplugin.Plugin, error) {
			f.Invoked[pluginID]++
			return &FakePluginClient{}, nil
		}
	}
	return f
}

func (pr *FakeBackendProcessProvider) BackendFactory(ctx context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	return pr.BackendFactoryFunc(ctx, p)
}

type FakeLicensingService struct {
	LicenseEdition string
	TokenRaw       string
	LicensePath    string
	LicenseAppURL  string
	CDNPrefix      string
}

func NewFakeLicensingService() *FakeLicensingService {
	return &FakeLicensingService{}
}

func (s *FakeLicensingService) Edition() string {
	return s.LicenseEdition
}

func (s *FakeLicensingService) Path() string {
	return s.LicensePath
}

func (s *FakeLicensingService) AppURL() string {
	return s.LicenseAppURL
}

func (s *FakeLicensingService) Environment() []string {
	return []string{fmt.Sprintf("GF_ENTERPRISE_LICENSE_TEXT=%s", s.TokenRaw)}
}

func (s *FakeLicensingService) ContentDeliveryPrefix() string {
	return s.CDNPrefix
}

type FakeRoleRegistry struct {
	ExpectedErr error
}

func NewFakeRoleRegistry() *FakeRoleRegistry {
	return &FakeRoleRegistry{}
}

func (f *FakeRoleRegistry) DeclarePluginRoles(_ context.Context, _ string, _ string, _ []plugins.RoleRegistration) error {
	return f.ExpectedErr
}

type FakeActionSetRegistry struct {
	ExpectedErr error
}

func NewFakeActionSetRegistry() *FakeActionSetRegistry {
	return &FakeActionSetRegistry{}
}

func (f *FakeActionSetRegistry) RegisterActionSets(_ context.Context, _ string, _ []plugins.ActionSet) error {
	return f.ExpectedErr
}

type FakePluginFS struct {
	OpenFunc   func(name string) (fs.File, error)
	RemoveFunc func() error
	RelFunc    func(string) (string, error)

	base string
}

func NewFakePluginFS(base string) *FakePluginFS {
	return &FakePluginFS{
		base: base,
	}
}

func (f *FakePluginFS) Open(name string) (fs.File, error) {
	if f.OpenFunc != nil {
		return f.OpenFunc(name)
	}
	return nil, nil
}

func (f *FakePluginFS) Rel(_ string) (string, error) {
	if f.RelFunc != nil {
		return f.RelFunc(f.base)
	}
	return "", nil
}

func (f *FakePluginFS) Base() string {
	return f.base
}

func (f *FakePluginFS) Files() ([]string, error) {
	return []string{}, nil
}

func (f *FakePluginFS) Remove() error {
	if f.RemoveFunc != nil {
		return f.RemoveFunc()
	}
	return nil
}

type FakeSourceRegistry struct {
	ListFunc func(_ context.Context) []plugins.PluginSource
}

func (s *FakeSourceRegistry) List(ctx context.Context) []plugins.PluginSource {
	if s.ListFunc != nil {
		return s.ListFunc(ctx)
	}
	return []plugins.PluginSource{}
}

type FakePluginSource struct {
	PluginClassFunc      func(ctx context.Context) plugins.Class
	DiscoverFunc         func(ctx context.Context) ([]*plugins.FoundBundle, error)
	DefaultSignatureFunc func(ctx context.Context) (plugins.Signature, bool)
}

func (s *FakePluginSource) PluginClass(ctx context.Context) plugins.Class {
	if s.PluginClassFunc != nil {
		return s.PluginClassFunc(ctx)
	}
	return ""
}

func (s *FakePluginSource) Discover(ctx context.Context) ([]*plugins.FoundBundle, error) {
	if s.DiscoverFunc != nil {
		return s.DiscoverFunc(ctx)
	}
	return []*plugins.FoundBundle{}, nil
}

func (s *FakePluginSource) DefaultSignature(ctx context.Context, _ string) (plugins.Signature, bool) {
	if s.DefaultSignatureFunc != nil {
		return s.DefaultSignatureFunc(ctx)
	}
	return plugins.Signature{}, false
}

type FakePluginFileStore struct {
	FileFunc func(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error)
}

func (f *FakePluginFileStore) File(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error) {
	if f.FileFunc != nil {
		return f.FileFunc(ctx, pluginID, pluginVersion, filename)
	}
	return nil, nil
}

type FakeAuthService struct {
	Result *auth.ExternalService
}

func (f *FakeAuthService) HasExternalService(ctx context.Context, pluginID string) (bool, error) {
	return f.Result != nil, nil
}

func (f *FakeAuthService) RegisterExternalService(ctx context.Context, pluginID string, pType string, svc *auth.IAM) (*auth.ExternalService, error) {
	return f.Result, nil
}

func (f *FakeAuthService) RemoveExternalService(ctx context.Context, pluginID string) error {
	return nil
}

type FakeDiscoverer struct {
	DiscoverFunc func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
}

func (f *FakeDiscoverer) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
	if f.DiscoverFunc != nil {
		return f.DiscoverFunc(ctx, src)
	}
	return []*plugins.FoundBundle{}, nil
}

type FakeBootstrapper struct {
	BootstrapFunc func(ctx context.Context, src plugins.PluginSource, bundle *plugins.FoundBundle) ([]*plugins.Plugin, error)
}

func (f *FakeBootstrapper) Bootstrap(ctx context.Context, src plugins.PluginSource, bundle *plugins.FoundBundle) ([]*plugins.Plugin, error) {
	if f.BootstrapFunc != nil {
		return f.BootstrapFunc(ctx, src, bundle)
	}
	return []*plugins.Plugin{}, nil
}

type FakeValidator struct {
	ValidateFunc func(ctx context.Context, ps *plugins.Plugin) error
}

func (f *FakeValidator) Validate(ctx context.Context, ps *plugins.Plugin) error {
	if f.ValidateFunc != nil {
		return f.ValidateFunc(ctx, ps)
	}
	return nil
}

type FakeInitializer struct {
	IntializeFunc func(ctx context.Context, ps *plugins.Plugin) (*plugins.Plugin, error)
}

func (f *FakeInitializer) Initialize(ctx context.Context, ps *plugins.Plugin) (*plugins.Plugin, error) {
	if f.IntializeFunc != nil {
		return f.IntializeFunc(ctx, ps)
	}
	return ps, nil
}

type FakeTerminator struct {
	TerminateFunc func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)
}

func (f *FakeTerminator) Terminate(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if f.TerminateFunc != nil {
		return f.TerminateFunc(ctx, p)
	}
	return nil, nil
}

type FakeBackendPlugin struct {
	Managed bool

	StartCount     int
	StopCount      int
	Decommissioned bool
	Running        bool

	// ExitedCheckDoneOrStopped is used to signal that the Exited() or Stop() method has been called.
	ExitedCheckDoneOrStopped chan struct{}

	mutex sync.RWMutex
	backendplugin.Plugin
}

func NewFakeBackendPlugin(managed bool) *FakeBackendPlugin {
	return &FakeBackendPlugin{
		Managed:                  managed,
		ExitedCheckDoneOrStopped: make(chan struct{}),
	}
}

func (p *FakeBackendPlugin) Start(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.Running = true
	p.StartCount++
	return nil
}

func (p *FakeBackendPlugin) Stop(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.Running = false
	p.StopCount++
	go func() { p.ExitedCheckDoneOrStopped <- struct{}{} }()
	return nil
}

func (p *FakeBackendPlugin) Decommission() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.Decommissioned = true
	return nil
}

func (p *FakeBackendPlugin) IsDecommissioned() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.Decommissioned
}

func (p *FakeBackendPlugin) IsManaged() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.Managed
}

func (p *FakeBackendPlugin) Exited() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	go func() { p.ExitedCheckDoneOrStopped <- struct{}{} }()
	return !p.Running
}

func (p *FakeBackendPlugin) Kill() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.Running = false
}

func (p *FakeBackendPlugin) Target() backendplugin.Target {
	return "test-target"
}

func (p *FakeBackendPlugin) Logger() log.Logger {
	return log.NewTestLogger()
}

type AssetProvider struct {
	ModuleFunc    func(plugin pluginassets.PluginInfo) (string, error)
	AssetPathFunc func(plugin pluginassets.PluginInfo, assetPath ...string) (string, error)
}

func NewFakeAssetProvider() *AssetProvider {
	return &AssetProvider{}
}

func (p *AssetProvider) Module(plugin pluginassets.PluginInfo) (string, error) {
	if p.ModuleFunc != nil {
		return p.ModuleFunc(plugin)
	}
	return "", nil
}

func (p *AssetProvider) AssetPath(plugin pluginassets.PluginInfo, assetPath ...string) (string, error) {
	if p.AssetPathFunc != nil {
		return p.AssetPathFunc(plugin, assetPath...)
	}
	return "", nil
}
