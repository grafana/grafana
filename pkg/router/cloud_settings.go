package router

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	appv0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
)

func cloudSettingsAccessChecker(client legacyclient.LegacyAccessClient) pluginaccesscontrol.AppAccessChecker {
	if client == nil {
		return nil
	}
	return func(ctx context.Context, user identity.Requester, id string) (authorizer.Decision, string, error) {
		ns := request.NamespaceValue(ctx)
		if ns == "" {
			if info, ok := request.RequestInfoFrom(ctx); ok {
				ns = info.Namespace
			}
		}
		if ns == "" || ns == "*" {
			return authorizer.DecisionDeny, "a concrete namespace is required", nil
		}
		verb := "get"
		if info, ok := request.RequestInfoFrom(ctx); ok {
			verb = info.Verb
		}
		service := authzlib.CheckServicePermissions(user, id, appv0.APP_RESOURCE_NAME, verb)
		if !service.Allowed {
			return authorizer.DecisionDeny, "token does not allow settings reads", nil
		}
		if service.ServiceCall {
			return authorizer.DecisionAllow, "", nil
		}
		orgID := user.GetOrgID()
		allowed, err := client.LegacyCheck(ctx, legacyclient.LegacyCheckRequest{
			Namespace: ns, Subject: user.GetUID(),
			RequesterOrgID: &orgID, Teams: user.GetGroups(),
			Evaluator: accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginaccesscontrol.ScopeProvider.GetResourceScope(id)),
		})
		if err != nil || !allowed {
			return authorizer.DecisionDeny, "app access denied", err
		}
		return authorizer.DecisionAllow, "", nil
	}
}

func cloudSettingsNamespaceAuthorizer(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "a requester is required", nil
	}
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}
	ns, err := types.ParseNamespace(attr.GetNamespace())
	if err != nil || ns.StackID < 1 || (!types.NamespaceMatches(user.GetNamespace(), ns.Value) && !user.GetIsGrafanaAdmin()) {
		return authorizer.DecisionDeny, "a matching stack namespace is required", nil
	}
	return authorizer.DecisionNoOpinion, "", nil
}

// cloudSettingsBackend owns the settings group while retaining its previous
// HTTP backend for v2 execution. Neither path calls the raw managed v2 client.
type cloudSettingsBackend struct {
	*PluginBackend
	fallback Backend
}

func newCloudSettingsBackend(ctx context.Context, entry definition.PluginDeployment, deps PluginDependencies) (*cloudSettingsBackend, error) {
	plugin := entry.Definition
	loadSettingsManifest(ctx, &plugin)
	b, err := newPluginSettingsBackend(plugin, nil, deps)
	if err != nil {
		return nil, err
	}
	key, err := pluginDeploymentKey(sourcePlugins+":settings", entry, nil)
	if err != nil {
		return nil, err
	}
	b.key, b.source = key, sourcePlugins
	return &cloudSettingsBackend{PluginBackend: b}, nil
}

func (b *cloudSettingsBackend) Key() string {
	if b.fallback != nil {
		return b.PluginBackend.Key() + ":" + b.fallback.Key()
	}
	return b.PluginBackend.Key()
}

func (b *cloudSettingsBackend) Manifest() (*app.ManifestData, bool) {
	if b.fallback != nil {
		return b.PluginBackend.Manifest()
	}
	// A deployment without an HTTP fallback serves only settings reads.
	plugin := *b.settings
	plugin.Settings, plugin.JSONData.Routes = nil, nil
	manifest, _ := definition.NewSettingsManifest(plugin, nil)
	return manifest, manifest != nil
}

func (b *cloudSettingsBackend) Load(ctx context.Context) (http.Handler, error) {
	store, err := b.deps.LegacySettingsStore(ctx, b.pluginID)
	if err != nil {
		return nil, fmt.Errorf("plugin %q: legacy settings store: %w", b.pluginID, err)
	}
	if store == nil {
		return nil, fmt.Errorf("plugin %q: legacy settings store provider returned no store", b.pluginID)
	}
	var fallback http.Handler
	loaded := false
	defer func() {
		if !loaded {
			destroyHandler(fallback)
			store.Destroy()
		}
	}()
	if b.fallback != nil {
		fallback, err = b.fallback.Load(ctx)
		if err != nil {
			return nil, err
		}
	}
	opts := pluginroute.Options{
		PluginInfo:          b.info,
		Storage:             pluginroute.UnifiedStorage(b.deps.Unified, b.deps.SecureValues, b.deps.RESTConfigProvider),
		AccessChecker:       b.deps.SettingsAccessChecker,
		NamespaceAuthorizer: authorizer.AuthorizerFunc(cloudSettingsNamespaceAuthorizer),
		Tracer:              b.deps.Tracer, Features: b.deps.Features, MetricsRegister: b.deps.MetricsRegister,
		Settings: appsettings.Options{
			ReadOnly: true, LegacyStore: store, ExternalSubresources: fallback, RegisterProxy: fallback != nil,
		},
	}
	handler, err := pluginroute.NewAppSettingsHandler(*b.settings, opts)
	if err != nil {
		return nil, err
	}
	local := &tracedPluginHandler{Handler: handler, pluginID: b.pluginID, group: b.pluginID}
	loaded = true
	return &cloudSettingsHandler{local: local, fallback: fallback, group: b.pluginID}, nil
}

type cloudSettingsHandler struct {
	local, fallback http.Handler
	group           string
	once            sync.Once
}

func (h *cloudSettingsHandler) handlerFor(req *http.Request) http.Handler {
	parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
	if h.fallback != nil && len(parts) >= 8 && parts[0] == "apis" && parts[1] == h.group && parts[2] == appv0.VERSION &&
		parts[3] == "namespaces" && parts[4] != "" && parts[5] == "app" && parts[6] == "instance" &&
		slices.Contains([]string{"health", "resources", "proxy"}, parts[7]) {
		return h.fallback
	}
	return h.local
}

func (h *cloudSettingsHandler) groupHandler() http.Handler { return h.local }
func (h *cloudSettingsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.handlerFor(r).ServeHTTP(w, r)
}
func (h *cloudSettingsHandler) Destroy() {
	h.once.Do(func() {
		destroyHandler(h.local)
		destroyHandler(h.fallback)
	})
}

func destroyHandler(h http.Handler) {
	if d, ok := h.(interface{ Destroy() }); ok {
		d.Destroy()
	}
}
