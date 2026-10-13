package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/plugin/appadapter"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	playlistapp "github.com/grafana/grafana/apps/playlist/pkg/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

const coreAppKeyPrefix = "coreapp"

// coreApp is a core API that the router serves in middleware mode, in place of
// the embedded API server. It is served like a plugin manifest, but its
// admission and conversion hooks run in-process, so it needs no plugin client.
type coreApp struct {
	id       string
	manifest app.ManifestData
	// notFolderScoped kinds are stored without a folder. Manifest kinds are
	// folder scoped unless they say otherwise, and the generated manifests of
	// core apps don't.
	notFolderScoped bool
	newApp          func(app.ManifestData) (app.App, error)
}

// coreApps are served in middleware mode. Each group must be one of
// routableCoreGroups.
func coreApps() []coreApp {
	return []coreApp{{
		id:              "playlist",
		manifest:        *manifestdata.LocalManifest().ManifestData,
		notFolderScoped: true,
		newApp: func(manifest app.ManifestData) (app.App, error) {
			// Reconcilers run in the embedded server's app installer; the router
			// only serves requests.
			return playlistapp.New(app.Config{
				ManifestData:   manifest,
				SpecificConfig: &playlistapp.PlaylistConfig{},
			})
		},
	}}
}

// coreAppBackends builds a backend for each core app. One that fails is skipped
// and logged, like a bad plugin manifest.
func coreAppBackends(ctx context.Context, apps []coreApp, deps PluginDependencies) []Backend {
	// Core apps are not plugins: they have no plugin settings, plugin client or
	// app-access permission (see pluginManifestsTarget.poll).
	deps.PluginClient = nil
	deps.ContextProvider = nil
	deps.PluginSettings = nil
	deps.DualWrite = nil
	deps.AccessControl = pluginManifestAccessControl{}

	backends := make([]Backend, 0, len(apps))
	for _, a := range apps {
		backend, err := newCoreAppBackend(a, deps)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping core app", "app", a.id, "err", err)
			continue
		}
		backends = append(backends, backend)
	}
	return backends
}

func newCoreAppBackend(a coreApp, deps PluginDependencies) (Backend, error) {
	// Copy the versions and kinds: the manifest is shared with the embedded server.
	manifest := a.manifest
	manifest.Versions = slices.Clone(manifest.Versions)
	for i := range manifest.Versions {
		manifest.Versions[i].Kinds = slices.Clone(manifest.Versions[i].Kinds)
		if a.notFolderScoped {
			for j := range manifest.Versions[i].Kinds {
				manifest.Versions[i].Kinds[j].FolderScoped = new(bool)
			}
		}
	}
	definition.MigrateDeprecatedRoutes(&manifest)

	body, err := json.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("core app %q: fingerprinting manifest: %w", a.id, err)
	}
	client := func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
		instance, err := a.newApp(manifest)
		if err != nil {
			return nil, nil, fmt.Errorf("core app %q: %w", a.id, err)
		}
		return nil, newInProcessClientV3(instance), nil
	}
	backend, err := newPluginBackend(a.id, &manifest, client, deps, body)
	if err != nil {
		return nil, err
	}
	backend.inProcess = true

	sum := sha256.Sum256(body)
	return &pluginDeploymentBackend{
		Backend: backend,
		key:     coreAppKeyPrefix + ":" + a.id + ":" + hex.EncodeToString(sum[:])[:16],
		source:  sourceCoreApp,
	}, nil
}

// inProcessClientV3 calls an app's admission and conversion hooks directly,
// through the same adapters a plugin process serves them with.
type inProcessClientV3 struct {
	admission  *appadapter.AdmissionAdapter
	conversion *appadapter.ConversionAdapter
}

var _ appclientv3.Client = (*inProcessClientV3)(nil)

func newInProcessClientV3(a app.App) *inProcessClientV3 {
	return &inProcessClientV3{
		admission:  appadapter.NewAdmissionAdapter(a),
		conversion: appadapter.NewConversionAdapter(a),
	}
}

func (c *inProcessClientV3) AdmissionReview(ctx context.Context, req *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	return c.admission.AdmissionReview(ctx, req)
}

func (c *inProcessClientV3) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	return c.conversion.ConvertObjects(ctx, req)
}

// CallRoute is not supported: the route service streams its response, and no
// core app served by the router declares custom routes.
func (c *inProcessClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return nil, status.Error(codes.Unimplemented, "core apps do not serve custom routes")
}
