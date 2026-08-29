// Package pluginrouter runs the Grafana router over the app plugins installed
// locally: it discovers them, serves each one's API group in process, and puts
// an HTTP listener in front of the result.
//
// The router itself is generic and knows nothing about plugins (see
// pkg/router/AGENTS.md); this package is one RoutesLoader for it, plus the
// serving the router deliberately leaves to its caller.
package pluginrouter

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/logging"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin/pluginroute"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// pluginSources lists where plugins may be found. It is the part of the plugin
// source registry this package uses, named so tests can stand in for it.
type pluginSources interface {
	List(context.Context) []plugins.PluginSource
}

// LoaderOptions are the collaborators every group this loader serves is built
// with. They are the same for all of them: one process, one storage backend,
// one set of feature toggles.
type LoaderOptions struct {
	Sources pluginSources

	// ClientV3Loader hands out a plugin's protocol v3 client. Each group gets a
	// lazy one, resolved per request, because the store may still be loading
	// the plugin when the router first builds its backend.
	ClientV3Loader v3.ClientV3Loader

	// PluginClient and ContextProvider serve the settings subresources.
	PluginClient    appplugin.PluginClient
	ContextProvider appplugin.PluginContextWrapper

	Storage         pluginroute.StorageProvider
	Search          resourcepb.ResourceIndexClient
	Tracer          tracing.Tracer
	Features        featuremgmt.FeatureToggles
	MetricsRegister prometheus.Registerer
	BuildVersion    string
	ExternalAddress string

	// Authorizer replaces each group's own authorizer, which asks Grafana's
	// access control whether the caller may reach that plugin. This process has
	// no access control to ask, so without a replacement every group denies
	// every request -- see the service's service_identity option.
	Authorizer authorizer.Authorizer

	// SearchAPIEnabled and TrashAPIEnabled mirror the apiserver settings of the
	// same name.
	SearchAPIEnabled bool
	TrashAPIEnabled  bool
}

// Loader serves every app plugin it finds on disk. It implements
// router.RoutesLoader.
type Loader struct {
	opts LoaderOptions
	log  log.Logger
}

var _ router.RoutesLoader = (*Loader)(nil)

func NewLoader(opts LoaderOptions) (*Loader, error) {
	if opts.Sources == nil {
		return nil, fmt.Errorf("plugin sources are required")
	}
	if opts.Storage == nil {
		return nil, fmt.Errorf("a StorageProvider is required to serve plugin kinds")
	}
	return &Loader{opts: opts, log: log.New("plugin-router.loader")}, nil
}

// Load rescans the plugin sources and returns one backend per app plugin that
// carries a manifest.
//
// It rescans rather than serving a set captured at construction because the
// router is level triggered: every reconcile asks for the full desired state,
// and answering from a snapshot would mean a plugin installed after startup
// could never appear, even once something did signal.
//
// A plugin that cannot be turned into a backend is logged and dropped rather
// than failing the whole load, which would take every other group down with it.
func (l *Loader) Load(ctx context.Context) ([]router.Backend, error) {
	found, err := definition.LoadPluginDefinition(ctx, l.opts.Sources, definition.Options{
		Filter:      isAppPlugin,
		Schemas:     true,
		AppManifest: true,
	})
	if err != nil {
		return nil, fmt.Errorf("listing app plugins: %w", err)
	}

	backends := make([]router.Backend, 0, len(found))
	for _, plugin := range found {
		// Plugin mode routes by group, and the group comes from the manifest.
		// A plugin without one still serves its settings API inside Grafana,
		// but there is nothing here for the router to route.
		if plugin.Manifest == nil || plugin.Manifest.IsEmpty() {
			l.log.Debug("skipping app plugin with no manifest", "pluginId", plugin.JSONData.ID)
			continue
		}

		rv, err := resourceVersion(plugin)
		if err != nil {
			l.log.Error("skipping app plugin", "pluginId", plugin.JSONData.ID, "error", err)
			continue
		}

		backend, err := pluginroute.New(plugin, pluginroute.Options{
			ResourceVersion:  rv,
			BuildVersion:     l.opts.BuildVersion,
			Storage:          l.opts.Storage,
			Search:           l.opts.Search,
			SearchAPIEnabled: l.opts.SearchAPIEnabled,
			TrashAPIEnabled:  l.opts.TrashAPIEnabled,
			Tracer:           l.opts.Tracer,
			Features:         l.opts.Features,
			MetricsRegister:  l.opts.MetricsRegister,
			ExternalAddress:  l.opts.ExternalAddress,
			Authorizer:       l.opts.Authorizer,

			// Lazy, like the in-process API builder's: the client is resolved
			// on the request that needs it, not when the group is built, so a
			// plugin whose backend is still starting is not written off.
			ClientV3:        l.clientV3(plugin.JSONData.ID),
			PluginClient:    l.opts.PluginClient,
			ContextProvider: l.opts.ContextProvider,
		})
		if err != nil {
			l.log.Error("skipping app plugin", "pluginId", plugin.JSONData.ID, "error", err)
			continue
		}
		backends = append(backends, backend)
	}
	return backends, nil
}

// Notify returns a signal that never fires.
//
// The plugins this loader serves are files on disk, read once at startup by a
// process that does not install or update them, so there is no event to report.
// The channel is left open rather than closed: closing means "no further
// signal", which the router handles by parking the case after one more
// reconcile, and there is no reason to spend that reconcile.
func (l *Loader) Notify(ctx context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

// clientV3 is how a group reaches its plugin's backend.
//
// It resolves per request rather than at build time (see v3.NewLazyClient): the
// plugin store loads plugins and starts their backends on its own schedule, and
// the router may well build a group's backend first. Resolving early would
// write the plugin off for the life of the process.
//
// Without a loader there is no backend to reach, and the stand-in reports that
// rather than being nil -- a kind that declares admission is refused a nil
// client when its storage is built, which would cost the plugin its whole API
// group over a hook, when everything else in the group is servable.
func (l *Loader) clientV3(pluginID string) v3.ClientV3 {
	if l.opts.ClientV3Loader == nil {
		return unavailableClient{}
	}
	return v3.NewLazyClient(l.opts.ClientV3Loader, pluginID)
}

// unavailableClient stands in when no plugin backend is reachable. See
// clientV3.
type unavailableClient struct{}

var _ v3.ClientV3 = unavailableClient{}

var errNoPluginBackend = apierrors.NewServiceUnavailable(
	"the plugin backend is not running in this process")

func (unavailableClient) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest, ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	return nil, errNoPluginBackend
}

func (unavailableClient) CallRoute(context.Context, *pluginv3.CallRouteRequest, ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return nil, errNoPluginBackend
}

func (unavailableClient) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest, ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	return nil, errNoPluginBackend
}

// isAppPlugin selects the app plugins whose id can be a Kubernetes API group
// segment, the same rule the in-process API builder applies.
func isAppPlugin(jsonData plugins.JSONData) bool {
	if jsonData.Type != plugins.TypeApp {
		return false
	}
	if !strings.Contains(jsonData.ID, "-") || strings.Contains(jsonData.ID, ".") || jsonData.ID == "v1" {
		logging.DefaultLogger.Warn("invalid app plugin id", "pluginId", jsonData.ID)
		return false
	}
	return true
}

// resourceVersion fingerprints what the backend is built from, which is what
// the router compares to decide whether a group needs rebuilding and what it
// keys its discovery and OpenAPI caches on.
//
// It hashes the manifest rather than using the plugin version, because a plugin
// under development is rebuilt far more often than its version changes -- and a
// manifest edit that did not move the version would otherwise be served from
// the caches of the manifest before it.
func resourceVersion(plugin definition.PluginDefinition) (string, error) {
	manifest, err := json.Marshal(plugin.Manifest)
	if err != nil {
		return "", fmt.Errorf("fingerprinting manifest: %w", err)
	}
	sum := sha256.Sum256(append([]byte(plugin.JSONData.Info.Version+"\x00"), manifest...))
	return hex.EncodeToString(sum[:])[:16], nil
}
