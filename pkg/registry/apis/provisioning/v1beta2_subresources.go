package provisioning

import (
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ builder.APIGroupRouteProvider = (*v1beta2APIBuilder)(nil)

type v1beta2ConnectorRegistration struct {
	path  string
	inner v0alpha1Connector
	opts  []v1beta2ConnectorOption
}

// connectorStorage serves the v0alpha1 connectors on v1beta2 through v1beta2Connector.
func (b *v1beta2APIBuilder) connectorStorage(scheme *runtime.Scheme) (map[string]rest.Storage, error) {
	connectors := []v1beta2ConnectorRegistration{
		{path: v1beta2.RepositoryResourceInfo.StoragePath("refs"), inner: NewRefsConnector(b.inner)},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("resources"), inner: NewListConnector(b.inner, b.inner.resourceLister)},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("stats"), inner: NewStatsConnector(b.inner.resourceLister)},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("history"), inner: NewHistorySubresource(b.inner)},
		{
			path:  v1beta2.RepositoryResourceInfo.StoragePath("files"),
			inner: b.inner.newFilesConnector(),
			opts:  []v1beta2ConnectorOption{withV1beta2Methods(http.MethodGet)},
		},
		{path: v1beta2.ConnectionResourceInfo.StoragePath("repositories"), inner: NewConnectionRepositoriesConnector(b.inner)},
	}

	storage := make(map[string]rest.Storage, len(connectors))
	for _, c := range connectors {
		connector, err := newV1beta2Connector(scheme, c.inner, c.opts...)
		if err != nil {
			return nil, err
		}
		storage[c.path] = WithTimeout(connector, 30*time.Second)
	}
	return storage, nil
}

// GetAPIRoutes serves the v0alpha1 namespace routes with their responses converted to v1beta2.
func (b *v1beta2APIBuilder) GetAPIRoutes(schema.GroupVersion) *builder.APIRoutes {
	stats := b.routeConversion(func() runtime.Object { return &v1beta2.ResourceStats{} })
	settings := b.routeConversion(func() runtime.Object { return &v1beta2.RepositoryViewList{} })
	return namespaceRoutes(
		v1beta2.ResourceStats{}.OpenAPIModelName(),
		func(w http.ResponseWriter, r *http.Request) { b.inner.serveStats(w, r, stats) },
		v1beta2.RepositoryViewList{}.OpenAPIModelName(),
		func(w http.ResponseWriter, r *http.Request) { b.inner.serveSettings(w, r, settings) },
	)
}

// routeConversion converts into the type newOut returns. Route bodies are encoded as plain JSON, so
// they keep the apiVersion and kind the v0alpha1 body sets, if any, with the version replaced.
func (b *v1beta2APIBuilder) routeConversion(newOut func() runtime.Object) routeConversion {
	return func(in runtime.Object) (runtime.Object, error) {
		out := newOut()
		if err := b.scheme.Convert(in, out, nil); err != nil {
			return nil, err
		}
		gvk := in.GetObjectKind().GroupVersionKind()
		if gvk.Version != "" {
			gvk = v1beta2.GroupVersion.WithKind(gvk.Kind)
		}
		out.GetObjectKind().SetGroupVersionKind(gvk)
		return out, nil
	}
}

// documentV1beta2Subresources describes the connectors and namespace routes on top of what
// Kubernetes generates from their v1beta2 types.
func documentV1beta2Subresources(oas *spec3.OpenAPI, root string) {
	paths := oas.Paths.Paths
	repo := root + "namespaces/{namespace}/repositories/{name}"
	connection := root + "namespaces/{namespace}/connections/{name}"
	// The namespace routes reference their models without Kubernetes adding them.
	referenced := []string{v1beta2.ResourceStats{}.OpenAPIModelName(), v1beta2.RepositoryViewList{}.OpenAPIModelName()}
	model := func(m interface{ OpenAPIModelName() string }) *spec3.Responses {
		referenced = append(referenced, m.OpenAPIModelName())
		return getJSONResponse("#/components/schemas/" + m.OpenAPIModelName())
	}

	if sub := paths[repo+"/refs"]; sub != nil && sub.Get != nil {
		sub.Get.Summary = "Repository refs listing"
		sub.Get.Description = "Get the repository references"
		sub.Get.Responses = model(v1beta2.RefList{})
	}
	if sub := paths[repo+"/resources"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Get the resources this repository manages"
		sub.Get.Parameters = resourcesQueryParameters()
		sub.Get.Responses = model(v1beta2.ResourceList{})
	}
	if sub := paths[repo+"/stats"]; sub != nil && sub.Get != nil {
		sub.Get.Summary = "Repository resource stats"
		sub.Get.Description = "Count the resources this repository manages"
		sub.Get.Responses = model(v1beta2.ResourceCountList{})
	}
	if sub := paths[repo+"/history"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Get the history of the repository"
		sub.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
		sub.Get.Responses = model(v1beta2.HistoryList{})
	}
	if sub := paths[repo+"/history/{path}"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Get the history of a path"
		sub.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
		sub.Get.Responses = model(v1beta2.HistoryList{})
	}
	if sub := paths[repo+"/files"]; sub != nil {
		// Listing is a GET with a trailing slash; the other methods need a file path.
		delete(paths, repo+"/files")
		listing := &spec3.Path{PathProps: spec3.PathProps{Get: sub.Get, Parameters: sub.Parameters}}
		paths[repo+"/files/"] = listing
		if listing.Get != nil {
			listing.Get.Summary = "File listing"
			listing.Get.Description = "Get the files and content hash"
			listing.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
			listing.Get.Responses = model(v1beta2.FileList{})
		}
	}
	if sub := paths[repo+"/files/{path}"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Read value from upstream repository"
		sub.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
		sub.Get.Responses = model(v1beta2.ResourceWrapper{})
	}
	if sub := paths[connection+"/repositories"]; sub != nil && sub.Get != nil {
		sub.Get.Summary = "List external repositories"
		sub.Get.Description = "List repositories available from the external git provider through this connection. Returns 501 Not Implemented for connection types that cannot list repositories"
		sub.Get.Responses = model(v1beta2.ExternalRepositoryList{})
	}

	defs := v1beta2.GetOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef("#/components/schemas/" + name)
	})
	addOpenAPIDefinitions(oas.Components.Schemas, defs, referenced...)
}

// addOpenAPIDefinitions adds the named definitions and the definitions they depend on, unless the
// schemas already hold them.
func addOpenAPIDefinitions(schemas map[string]*spec.Schema, defs map[string]common.OpenAPIDefinition, names ...string) {
	for _, name := range names {
		if _, ok := schemas[name]; ok {
			continue
		}
		def, ok := defs[name]
		if !ok {
			continue
		}
		s := def.Schema
		schemas[name] = &s
		addOpenAPIDefinitions(schemas, defs, def.Dependencies...)
	}
}
