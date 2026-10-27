// Package app describes the provisioning app for the grafana-app-sdk: its kinds, manifest and custom routes.
package app

import (
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/kube-openapi/pkg/spec3"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const (
	AppName = "provisioning"

	KindRepository = "Repository"
	KindConnection = "Connection"
	KindJob        = "Job"
	KindHistoric   = "HistoricJob"

	// VersionBeta is served next to the preferred version; both share one storage version and Go types.
	VersionBeta = "v1beta1"
)

// Versions lists every version the app serves, preferred first.
var Versions = []string{provisioning.VERSION, VersionBeta}

// Route is a custom route served by the app as a kind subresource.
type Route struct {
	Kind    string
	Path    string
	Methods []string
	// Subpath routes accept trailing path segments, e.g. files/{path}.
	Subpath bool
	// Response is the Go type returned for every method of the route.
	Response any
}

// Routes is the single source of truth for the manifest, the OpenAPI wiring and the handler registration.
var Routes = []Route{
	{Kind: KindRepository, Path: "test", Methods: []string{http.MethodPost}, Response: &provisioning.TestResults{}},
	{Kind: KindRepository, Path: "files", Methods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete}, Subpath: true, Response: &provisioning.ResourceWrapper{}},
	{Kind: KindRepository, Path: "refs", Methods: []string{http.MethodGet}, Response: &provisioning.RefList{}},
	{Kind: KindRepository, Path: "resources", Methods: []string{http.MethodGet}, Response: &provisioning.ResourceList{}},
	{Kind: KindRepository, Path: "history", Methods: []string{http.MethodGet}, Subpath: true, Response: ""},
	{Kind: KindRepository, Path: "jobs", Methods: []string{http.MethodPost, http.MethodGet}, Subpath: true, Response: &provisioning.Job{}},
	{Kind: KindRepository, Path: "webhook", Methods: []string{http.MethodPost}, Response: &provisioning.WebhookResponse{}},
	{Kind: KindRepository, Path: "render", Methods: []string{http.MethodGet}, Subpath: true, Response: &provisioning.Repository{}},
	{Kind: KindConnection, Path: "repositories", Methods: []string{http.MethodGet}, Response: &provisioning.ExternalRepositoryList{}},
	{Kind: KindConnection, Path: "authorize", Methods: []string{http.MethodPost}, Response: &provisioning.ConnectionAuthorizeRequest{}},
}

// RoutesFor returns the custom routes attached to the given kind.
func RoutesFor(kind string) []Route {
	var out []Route
	for _, r := range Routes {
		if r.Kind == kind {
			out = append(out, r)
		}
	}
	return out
}

func pathProps(r Route) spec3.PathProps {
	op := func(method string) *spec3.Operation {
		return &spec3.Operation{OperationProps: spec3.OperationProps{
			OperationId: r.Path + method,
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
				Default: &spec3.Response{ResponseProps: spec3.ResponseProps{
					Content: map[string]*spec3.MediaType{"application/json": {}},
				}},
			}},
		}}
	}
	var props spec3.PathProps
	for _, m := range r.Methods {
		switch m {
		case http.MethodGet:
			props.Get = op("Get")
		case http.MethodPost:
			props.Post = op("Post")
		case http.MethodPut:
			props.Put = op("Put")
		case http.MethodDelete:
			props.Delete = op("Delete")
		}
	}
	return props
}

type kindDef struct {
	kind, plural string
	obj          resource.Object
	list         resource.ListObject
	subresources bool
	selectable   []resource.SelectableField
}

func kindDefs(version string) []kindDef {
	apiVersion := provisioning.GROUP + "/" + version
	tm := func(kind string) metav1.TypeMeta { return metav1.TypeMeta{APIVersion: apiVersion, Kind: kind} }
	return []kindDef{
		{
			kind: KindRepository, plural: "repositories", subresources: true,
			obj:  &provisioning.Repository{TypeMeta: tm(KindRepository)},
			list: &provisioning.RepositoryList{TypeMeta: tm(KindRepository + "List")},
			selectable: []resource.SelectableField{{
				FieldSelector: "spec.connection.name",
				FieldValueFunc: func(o resource.Object) (string, error) {
					repo, ok := o.(*provisioning.Repository)
					if !ok || repo.Spec.Connection == nil {
						return "", nil
					}
					return repo.Spec.Connection.Name, nil
				},
			}},
		},
		{
			kind: KindConnection, plural: "connections", subresources: true,
			obj:  &provisioning.Connection{TypeMeta: tm(KindConnection)},
			list: &provisioning.ConnectionList{TypeMeta: tm(KindConnection + "List")},
		},
		{
			kind: KindJob, plural: "jobs",
			obj:  &provisioning.Job{TypeMeta: tm(KindJob)},
			list: &provisioning.JobList{TypeMeta: tm(KindJob + "List")},
		},
		{
			kind: KindHistoric, plural: "historicjobs",
			obj:  &provisioning.HistoricJob{TypeMeta: tm(KindHistoric)},
			list: &provisioning.HistoricJobList{TypeMeta: tm(KindHistoric + "List")},
		},
	}
}

// Kinds returns the resource.Kind for every kind served at the given version.
func Kinds(version string) []resource.Kind {
	defs := kindDefs(version)
	kinds := make([]resource.Kind, 0, len(defs))
	for _, d := range defs {
		kinds = append(kinds, resource.Kind{
			Schema: resource.NewSimpleSchema(provisioning.GROUP, version, d.obj, d.list,
				resource.WithKind(d.kind),
				resource.WithPlural(d.plural),
				resource.WithScope(resource.NamespacedScope),
				resource.WithSelectableFields(d.selectable),
			),
			Codecs: map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()},
		})
	}
	return kinds
}

// KindFor returns the resource.Kind for a kind name and version.
func KindFor(kind, version string) (resource.Kind, bool) {
	for _, k := range Kinds(version) {
		if k.Kind() == kind {
			return k, true
		}
	}
	return resource.Kind{}, false
}

// WithRoutes adds the custom subresource routes to the generated manifest, which only declares the kinds.
func WithRoutes(m sdkapp.ManifestData) sdkapp.ManifestData {
	versions := make([]sdkapp.ManifestVersion, len(m.Versions))
	for i, v := range m.Versions {
		kinds := make([]sdkapp.ManifestVersionKind, len(v.Kinds))
		for j, k := range v.Kinds {
			routes := RoutesFor(k.Kind)
			if len(routes) > 0 {
				k.Routes = make(map[string]spec3.PathProps, len(routes))
				for _, r := range routes {
					k.Routes[r.Path] = pathProps(r)
				}
			}
			kinds[j] = k
		}
		v.Kinds = kinds
		versions[i] = v
	}
	m.Versions = versions
	return m
}

// GoTypeAssociator resolves manifest kinds and custom route responses to Go types.
type GoTypeAssociator struct{}

func (GoTypeAssociator) KindToGoType(kind, version string) (resource.Kind, bool) {
	return KindFor(kind, version)
}

func (GoTypeAssociator) CustomRouteReturnGoType(kind, _, path, verb string) (any, bool) {
	for _, r := range RoutesFor(kind) {
		if r.Path != path {
			continue
		}
		for _, m := range r.Methods {
			if m == verb {
				return r.Response, true
			}
		}
	}
	return nil, false
}

func (GoTypeAssociator) CustomRouteQueryGoType(string, string, string, string) (runtime.Object, bool) {
	return nil, false
}

func (GoTypeAssociator) CustomRouteRequestBodyGoType(string, string, string, string) (any, bool) {
	return nil, false
}
