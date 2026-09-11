package installsync

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/configprovider"
	infraserverlock "github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	ServiceName          = "plugins.installsync"
	syncerLockActionName = "plugin-install-api-sync"
)

var (
	lockTimeout = 10 * time.Minute

	// defaultBackoffConfig controls retries between failed Sync attempts.
	// Retries are infinite: Sync only ever runs once at process startup, so
	// there is no other trigger to resync a stack whose sync failed (e.g.
	// because the API server was throttling requests during a fleet-wide
	// restart) until the process restarts.
	defaultBackoffConfig = backoff.Config{
		MinBackoff: 5 * time.Second,
		MaxBackoff: 5 * time.Minute,
		MaxRetries: 0,
	}
)

// Syncer is the interface for syncing plugin installations to the Kubernetes-style API.
type Syncer interface {
	registry.BackgroundService
	registry.CanBeDisabled
	Sync(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error
}

// ServerLock is the interface for acquiring distributed locks.
type ServerLock interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

type syncer struct {
	services.NamedService
	featureToggles      featuremgmt.FeatureToggles
	installRegistrar    *install.InstallRegistrar
	orgService          org.Service
	namespaceMapper     request.NamespaceMapper
	serverLock          ServerLock
	restConfigProvider  apiserver.RestConfigProvider
	pluginsStoreService pluginstore.Store
	backoffConfig       backoff.Config
}

var _ Syncer = (*syncer)(nil)
var _ registry.BackgroundService = (*syncer)(nil)
var _ registry.CanBeDisabled = (*syncer)(nil)
var _ services.NamedService = (*syncer)(nil)

// newSyncer creates a new syncer with the provided dependencies.
func newSyncer(
	featureToggles featuremgmt.FeatureToggles,
	installRegistrar *install.InstallRegistrar,
	orgService org.Service,
	namespaceMapper request.NamespaceMapper,
	serverLock ServerLock,
	restConfigProvider apiserver.RestConfigProvider,
	pluginsStoreService pluginstore.Store,
) *syncer {
	s := syncer{
		featureToggles:      featureToggles,
		installRegistrar:    installRegistrar,
		orgService:          orgService,
		namespaceMapper:     namespaceMapper,
		serverLock:          serverLock,
		restConfigProvider:  restConfigProvider,
		pluginsStoreService: pluginsStoreService,
		backoffConfig:       defaultBackoffConfig,
	}
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(ServiceName)
	return &s
}

// ProvideSyncer creates a new Syncer for syncing plugin installations to the API.
func ProvideSyncer(
	featureToggles featuremgmt.FeatureToggles,
	clientGenerator resource.ClientGenerator,
	orgService org.Service,
	cfgProvider configprovider.ConfigProvider,
	serverLock ServerLock,
	restConfigProvider apiserver.RestConfigProvider,
	pluginsStoreService pluginstore.Store,
) (Syncer, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}
	installRegistrar := install.NewInstallRegistrar(logging.DefaultLogger, clientGenerator)
	namespaceMapper := request.GetNamespaceMapper(cfg)

	return newSyncer(
		featureToggles,
		installRegistrar,
		orgService,
		namespaceMapper,
		serverLock,
		restConfigProvider,
		pluginsStoreService,
	), nil
}

func (s *syncer) IsDisabled() bool {
	//nolint:staticcheck // not yet migrated to OpenFeature
	syncEnabled := s.featureToggles.IsEnabled(context.Background(), featuremgmt.FlagPluginInstallAPISync)
	//nolint:staticcheck // not yet migrated to OpenFeature
	serviceLoadingEnabled := s.featureToggles.IsEnabled(context.Background(), featuremgmt.FlagPluginStoreServiceLoading)
	return !syncEnabled || !serviceLoadingEnabled
}

func (s *syncer) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *syncer) running(ctx context.Context) error {
	ctxLog := logging.FromContext(ctx)
	restConfig, err := s.restConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return err
	}
	discoveryClient, err := client.NewDiscoveryClient(restConfig)
	if err != nil {
		ctxLog.Warn("Failed to create discovery client, skipping plugin sync", "error", err)
	}
	if err := discoveryClient.WaitForAvailability(ctx, pluginsv0alpha1.PluginKind().GroupVersionKind().GroupVersion()); err != nil {
		ctxLog.Warn("Failed to wait for plugin API availability, skipping plugin sync", "error", err)
	}

	s.syncWithRetry(ctx, func(ctx context.Context) error {
		return s.Sync(ctx, install.SourcePluginStore, s.pluginsStoreService.Plugins(ctx))
	})
	<-ctx.Done()
	return nil
}

// syncWithRetry calls attempt, retrying with backoff on failure until it
// succeeds, fails with a non-retryable error, or ctx is done. A single failed
// attempt (e.g. the API server throttling requests during a fleet-wide
// restart) must not strand this stack's plugin state until the process
// restarts, since Sync only ever runs once at startup otherwise.
func (s *syncer) syncWithRetry(ctx context.Context, attempt func(ctx context.Context) error) {
	ctxLog := logging.FromContext(ctx)
	bo := backoff.New(ctx, s.backoffConfig)
	for {
		err := attempt(ctx)
		if err == nil {
			return
		}
		if isServerLockExistsError(err) {
			ctxLog.Debug("Another instance is running plugin sync, skipping this instance")
			return
		}
		if !isRetryableSyncError(err) {
			ctxLog.Error("Plugin sync failed with a non-retryable error, giving up", "error", err)
			return
		}
		if !bo.Ongoing() {
			ctxLog.Warn("Giving up on plugin sync", "error", err, "attempts", bo.NumRetries()+1)
			return
		}
		ctxLog.Warn("Failed to sync plugins, retrying", "error", err, "attempt", bo.NumRetries()+1)
		bo.Wait()
	}
}

func isServerLockExistsError(err error) bool {
	_, ok := errors.AsType[*infraserverlock.ServerLockExistsError](err)
	return ok
}

type joinedError interface {
	error
	Unwrap() []error
}

type apiStatusError interface {
	error
	errorsK8s.APIStatus
}

// isRetryableSyncError reports whether err is a known transient failure.
// Unknown errors are not retried because retries are otherwise infinite.
func isRetryableSyncError(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) {
		return false
	}
	// Reconciliation already made the maximum safe number of passes. Never
	// restart that write loop, even when another namespace had a transient
	// failure in the same attempt.
	if errors.Is(err, install.ErrSyncDidNotConverge) {
		return false
	}

	// Kubernetes predicates select the first APIStatus in an error tree. Walk
	// joined namespace errors individually so their order cannot change whether
	// a transient failure is retried.
	if joined, ok := errors.AsType[joinedError](err); ok {
		for _, joinedErr := range joined.Unwrap() {
			if isRetryableSyncError(joinedErr) {
				return true
			}
		}
		return false
	}

	// Some app-sdk errors both expose their own Kubernetes status and unwrap
	// to a lower-level transport error. Preserve the status classification
	// before classifying an error from their transport error chain.
	if apiStatus, ok := errors.AsType[apiStatusError](err); ok {
		return isRetryableKubernetesError(apiStatus)
	}

	if netErr, ok := errors.AsType[net.Error](err); ok && netErr.Timeout() {
		return true
	}
	if _, ok := errors.AsType[*net.OpError](err); ok {
		return true
	}

	return false
}

func isRetryableKubernetesError(err apiStatusError) bool {
	return errorsK8s.IsTooManyRequests(err) ||
		errorsK8s.IsServiceUnavailable(err) ||
		errorsK8s.IsServerTimeout(err) ||
		errorsK8s.IsTimeout(err) ||
		err.Status().Code == http.StatusBadGateway
}

func (s *syncer) Sync(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error {
	if s.IsDisabled() {
		return nil
	}

	if len(installedPlugins) == 0 {
		return nil
	}

	var syncErr error
	lockErr := s.serverLock.LockExecuteAndRelease(ctx, syncerLockActionName, lockTimeout, func(ctx context.Context) {
		syncErr = s.syncAllNamespaces(ctx, source, installedPlugins)
	})

	if lockErr != nil {
		return lockErr
	}
	return syncErr
}

func (s *syncer) syncAllNamespaces(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error {
	orgs, err := s.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	// a namespace failure must not strand the ones after it: the sync runs
	// once per process, so skipped namespaces stay stale until restart
	var errs []error
	for _, org := range orgs {
		namespace := s.namespaceMapper(org.ID)
		nsCtx := identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)
		if err := s.syncNamespace(nsCtx, namespace, source, installedPlugins); err != nil {
			errs = append(errs, fmt.Errorf("sync namespace %q: %w", namespace, err))
		}
	}

	return errors.Join(errs...)
}

func (s *syncer) syncNamespace(ctx context.Context, namespace string, source install.Source, installedPlugins []pluginstore.Plugin) error {
	primaryPlugins := filterPrimaryPlugins(installedPlugins)
	desired := make([]install.PluginInstall, 0, len(primaryPlugins))
	for _, p := range primaryPlugins {
		desired = append(desired, install.PluginInstall{
			ID:           p.ID,
			Version:      p.Info.Version,
			Source:       source,
			Dependencies: pluginDependencyIDs(p),
		})
	}
	return s.installRegistrar.SyncNamespace(ctx, namespace, source, desired)
}

func pluginDependencyIDs(p pluginstore.Plugin) []string {
	dependencies := p.Dependencies.Plugins
	ids := make([]string, 0, len(dependencies))
	for _, dependency := range dependencies {
		id := strings.TrimSpace(dependency.ID)
		if id != "" && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return ids
}

func filterPrimaryPlugins(plugins []pluginstore.Plugin) []pluginstore.Plugin {
	primaryPlugins := make([]pluginstore.Plugin, 0, len(plugins))
	for _, p := range plugins {
		if p.Parent != nil || p.IncludedInAppID != "" {
			continue
		}
		primaryPlugins = append(primaryPlugins, p)
	}
	return primaryPlugins
}
