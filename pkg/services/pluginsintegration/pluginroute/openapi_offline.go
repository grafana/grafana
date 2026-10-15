package pluginroute

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
)

// OpenAPIOptions are the parts of a running server's configuration that are
// visible in a rendered spec.
type OpenAPIOptions struct {
	// PluginInfo fills the spec description and its x-grafana-plugin extension.
	PluginInfo plugins.Info

	// BuildVersion stamps the spec info version, the same way the server does.
	BuildVersion string
}

// ServedVersions returns the versions a manifest serves, preferred version first.
func ServedVersions(manifest *app.ManifestData) []string {
	if manifest == nil {
		return nil
	}
	group := APIGroup(manifest)
	out := make([]string, len(group.Versions))
	for i, v := range group.Versions {
		out[i] = v.Version
	}
	return out
}

// BuildOpenAPI renders the OpenAPI v3 spec the router serves for one version of
// a plugin manifest, without storage or a running plugin backend. An empty
// version renders the preferred one.
//
// The spec is requested from the same handler NewHandler builds for the router,
// so the two cannot drift. Search, trash, hybrid and list-keys routes are always
// registered, as the generated contract describes every route a plugin can get.
func BuildOpenAPI(pluginID string, manifest *app.ManifestData, version string, opts OpenAPIOptions) (*spec3.OpenAPI, error) {
	if err := ValidateManifest(pluginID, manifest); err != nil {
		return nil, err
	}
	versions := ServedVersions(manifest)
	if len(versions) == 0 {
		return nil, fmt.Errorf("plugin %s has no served versions", pluginID)
	}
	if version == "" {
		version = versions[0]
	}
	if !slices.Contains(versions, version) {
		return nil, fmt.Errorf("plugin %s does not serve version %q (available: %s)",
			pluginID, version, strings.Join(versions, ", "))
	}

	handler, err := NewHandler(pluginID, manifest, Options{
		PluginInfo:   opts.PluginInfo,
		BuildVersion: opts.BuildVersion,
		// The resource handlers must be installed for their paths to be in the
		// spec, but no request ever reaches storage.
		Storage: func(*runtime.Scheme, serializer.CodecFactory, []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
			return appinstaller.NewNoopRESTOptionsGetter(), nil
		},
		PluginClient:    offlinePluginClient{},
		ClientV3:        offlineClientV3{},
		ContextProvider: offlinePluginContext{},
		AccessChecker: func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
		Search:           offlineSearchClient{},
		Store:            offlineStoreClient{},
		HybridAPIEnabled: true,
		KeysAPIEnabled:   true,
		MetricsRegister:  prometheus.NewRegistry(),
	})
	if err != nil {
		return nil, err
	}
	defer handler.Destroy()

	path := "/openapi/v3/apis/" + manifest.Group + "/" + version
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	res := &bufferedResponse{header: http.Header{}, code: http.StatusOK}
	handler.ServeHTTP(res, req)
	if res.code != http.StatusOK {
		return nil, fmt.Errorf("rendering %s: %d %s", path, res.code, strings.TrimSpace(res.body.String()))
	}

	oas := &spec3.OpenAPI{}
	if err := json.Unmarshal(res.body.Bytes(), oas); err != nil {
		return nil, fmt.Errorf("rendering %s: %w", path, err)
	}
	return oas, nil
}

// bufferedResponse holds the one response BuildOpenAPI reads back, without
// pulling net/http/httptest into the server binary.
type bufferedResponse struct {
	header      http.Header
	code        int
	wroteHeader bool
	body        bytes.Buffer
}

func (r *bufferedResponse) Header() http.Header { return r.header }

func (r *bufferedResponse) WriteHeader(code int) {
	if !r.wroteHeader {
		r.code, r.wroteHeader = code, true
	}
}

func (r *bufferedResponse) Write(b []byte) (int, error) {
	r.wroteHeader = true
	return r.body.Write(b)
}
