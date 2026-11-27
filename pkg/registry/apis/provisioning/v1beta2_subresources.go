package provisioning

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ builder.APIGroupRouteProvider = (*v1beta2APIBuilder)(nil)

type v1beta2ConnectorRegistration struct {
	path  string
	inner v0alpha1Connector
	opts  []v1beta2ConnectorOption
}

// connectorStorage serves the v0alpha1 connectors, and those of the extras v1beta2 serves, on
// v1beta2 through v1beta2Connector. It needs the v0alpha1 storage to be installed first.
func (b *v1beta2APIBuilder) connectorStorage(scheme *runtime.Scheme) (map[string]rest.Storage, error) {
	if b.inner.jobHistory == nil {
		return nil, fmt.Errorf("serving %s needs the %s job history", v1beta2.GroupVersion, v1beta2StorageVersion)
	}
	extraConnectors, err := b.extraConnectors()
	if err != nil {
		return nil, err
	}
	jobs := b.inner.newJobsConnector()
	connectors := append([]v1beta2ConnectorRegistration{
		{
			path:  v1beta2.RepositoryResourceInfo.StoragePath("test"),
			inner: b.inner.newTestConnector(),
			opts: []v1beta2ConnectorOption{withV1beta2RequestBody(v1beta2RequestConversion{
				MaxBytes: defaultMaxBodySize,
				Convert:  v1beta2TestRequest(scheme),
			}, http.MethodPost)},
		},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("files"), inner: b.inner.newFilesConnector()},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("refs"), inner: NewRefsConnector(b.inner)},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("resources"), inner: NewListConnector(b.inner, b.inner.resourceLister)},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("stats"), inner: NewStatsConnector(b.inner.resourceLister)},
		{path: v1beta2.RepositoryResourceInfo.StoragePath("history"), inner: NewHistorySubresource(b.inner)},
		{
			path:  v1beta2.RepositoryResourceInfo.StoragePath("jobs"),
			inner: jobs,
			opts: []v1beta2ConnectorOption{withV1beta2RequestBody(v1beta2RequestConversion{
				MaxBytes: jobs.maxBodySize,
				Convert:  v1beta2JobSpecRequest(scheme),
			}, http.MethodPost)},
		},
		{path: v1beta2.ConnectionResourceInfo.StoragePath("repositories"), inner: NewConnectionRepositoriesConnector(b.inner)},
		{
			path:  v1beta2.ConnectionResourceInfo.StoragePath("authorize"),
			inner: NewConnectionAuthorizeConnector(b.inner),
			opts: []v1beta2ConnectorOption{withV1beta2RequestBody(v1beta2RequestConversion{
				MaxBytes: defaultMaxBodySize,
				Convert:  v1beta2StrictObjectRequest(scheme, func() runtime.Object { return &v1beta2.ConnectionAuthorizeRequest{} }),
			}, http.MethodPost)},
		},
	}, extraConnectors...)

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

// extraConnectors returns the connectors of the extras v1beta2 serves. The extras bound them with
// their own timeouts already.
func (b *v1beta2APIBuilder) extraConnectors() ([]v1beta2ConnectorRegistration, error) {
	storage := map[string]rest.Storage{}
	for _, extra := range b.extras() {
		if err := extra.UpdateStorage(storage); err != nil {
			return nil, fmt.Errorf("update storage for extra %T: %w", extra, err)
		}
	}
	connectors := make([]v1beta2ConnectorRegistration, 0, len(storage))
	for path, s := range storage {
		inner, ok := s.(v0alpha1Connector)
		if !ok {
			return nil, fmt.Errorf("extra storage %s is %T, not a connector", path, s)
		}
		connectors = append(connectors, v1beta2ConnectorRegistration{path: path, inner: inner})
	}
	return connectors, nil
}

// v1beta2TestRequest converts the Repository to test. An empty object, which tests the stored
// repository, stays empty: converted, it would carry the apiVersion and kind.
func v1beta2TestRequest(scheme *runtime.Scheme) func([]byte) ([]byte, error) {
	convert := v1beta2ObjectRequest(scheme, func() runtime.Object { return &v1beta2.Repository{} })
	return func(body []byte) ([]byte, error) {
		var repo v1beta2.Repository
		if err := json.Unmarshal(body, &repo); err != nil {
			return nil, err
		}
		if reflect.ValueOf(repo).IsZero() {
			return body, nil
		}
		return convert(body)
	}
}

// v1beta2StrictObjectRequest converts a JSON body holding the v1beta2 object newObj returns into
// its storage version, rejecting unknown fields as connectors that decode strictly do.
func v1beta2StrictObjectRequest(scheme *runtime.Scheme, newObj func() runtime.Object) func([]byte) ([]byte, error) {
	return func(body []byte) ([]byte, error) {
		obj := newObj()
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(obj); err != nil {
			return nil, err
		}
		out, err := toStorageVersion(scheme, obj)
		if err != nil {
			return nil, err
		}
		return json.Marshal(out)
	}
}

// v1beta2JobSpecRequest converts a v1beta2 JobSpec body into the v0alpha1 JobSpec the jobs
// connector reads, rejecting unknown fields as that connector does.
func v1beta2JobSpecRequest(scheme *runtime.Scheme) func([]byte) ([]byte, error) {
	return func(body []byte) ([]byte, error) {
		job := &v1beta2.Job{}
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&job.Spec); err != nil {
			return nil, err
		}
		out, err := toStorageVersion(scheme, job)
		if err != nil {
			return nil, err
		}
		stored, ok := out.(*provisioning.Job)
		if !ok {
			return nil, fmt.Errorf("expected a %s Job, got %T", v1beta2StorageVersion, out)
		}
		return json.Marshal(stored.Spec)
	}
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
	models := &v1beta2Models{referenced: []string{v1beta2.ResourceStats{}.OpenAPIModelName(), v1beta2.RepositoryViewList{}.OpenAPIModelName()}}

	if sub := paths[repo+"/refs"]; sub != nil && sub.Get != nil {
		sub.Get.Summary = "Repository refs listing"
		sub.Get.Description = "Get the repository references"
		sub.Get.Responses = models.response(v1beta2.RefList{})
	}
	if sub := paths[repo+"/resources"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Get the resources this repository manages"
		sub.Get.Parameters = resourcesQueryParameters()
		sub.Get.Responses = models.response(v1beta2.ResourceList{})
	}
	if sub := paths[repo+"/stats"]; sub != nil && sub.Get != nil {
		sub.Get.Summary = "Repository resource stats"
		sub.Get.Description = "Count the resources this repository manages"
		sub.Get.Responses = models.response(v1beta2.ResourceCountList{})
	}
	if sub := paths[repo+"/history"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Get the history of the repository"
		sub.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
		sub.Get.Responses = models.response(v1beta2.HistoryList{})
	}
	if sub := paths[repo+"/history/{path}"]; sub != nil && sub.Get != nil {
		sub.Get.Description = "Get the history of a path"
		sub.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
		sub.Get.Responses = models.response(v1beta2.HistoryList{})
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
			listing.Get.Responses = models.response(v1beta2.FileList{})
		}
	}
	documentV1beta2RepositoryWrites(paths, repo, models)
	if sub := paths[connection+"/repositories"]; sub != nil && sub.Get != nil {
		sub.Get.Summary = "List external repositories"
		sub.Get.Description = "List repositories available from the external git provider through this connection. Returns 501 Not Implemented for connection types that cannot list repositories"
		sub.Get.Responses = models.response(v1beta2.ExternalRepositoryList{})
	}
	if sub := paths[connection+"/authorize"]; sub != nil && sub.Post != nil {
		sub.Post.Description = "Complete the OAuth authorization of this connection by exchanging an authorization code"
		sub.Post.RequestBody = models.requestBody(v1beta2.ConnectionAuthorizeRequest{}, true)
		sub.Post.Responses = models.response(v1beta2.ConnectionAuthorizeRequest{})
	}

	defs := v1beta2.GetOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef("#/components/schemas/" + name)
	})
	addOpenAPIDefinitions(oas.Components.Schemas, defs, models.referenced...)
}

// documentV1beta2RepositoryWrites describes the repository connectors that write or act, and the
// file reads that share their path.
func documentV1beta2RepositoryWrites(paths map[string]*spec3.Path, repo string, models *v1beta2Models) {
	if sub := paths[repo+"/files/{path}"]; sub != nil {
		if sub.Get != nil {
			sub.Get.Description = "Read value from upstream repository"
			sub.Get.Parameters = []*spec3.Parameter{refQueryParameter()}
			sub.Get.Responses = models.response(v1beta2.ResourceWrapper{})
		}
		for _, op := range []*spec3.Operation{sub.Put, sub.Post, sub.Delete} {
			if op != nil {
				op.Parameters = filesWriteParameters(refQueryParameter())
				op.Responses = models.response(v1beta2.ResourceWrapper{})
			}
		}
		for _, op := range []*spec3.Operation{sub.Put, sub.Post} {
			if op != nil {
				op.RequestBody = filesRequestBody()
			}
		}
	}
	if sub := paths[repo+"/test"]; sub != nil && sub.Post != nil {
		sub.Post.Description = "Check if the configuration is valid. Deprecated: this will go away in favour of fieldErrors from status"
		sub.Post.Deprecated = true
		sub.Post.RequestBody = models.requestBody(v1beta2.Repository{}, false)
		sub.Post.Responses = models.response(v1beta2.TestResults{})
	}
	if sub := paths[repo+"/jobs"]; sub != nil {
		if sub.Post != nil {
			sub.Post.Description = "Register a job for this repository"
			sub.Post.RequestBody = models.requestBody(v1beta2.JobSpec{}, false)
			sub.Post.RequestBody.Content["application/json"].Examples = map[string]*spec3.Example{
				"incremental": {ExampleProps: spec3.ExampleProps{
					Summary:     "Pull (incremental)",
					Description: "look for changes since the last sync",
					Value:       v1beta2.JobSpec{Action: v1beta2.JobActionPull, Pull: &v1beta2.JobSyncJobOptions{Incremental: true}},
				}},
				"pull": {ExampleProps: spec3.ExampleProps{
					Summary:     "Pull from repository",
					Description: "pull all files",
					Value:       v1beta2.JobSpec{Action: v1beta2.JobActionPull, Pull: &v1beta2.JobSyncJobOptions{Incremental: false}},
				}},
			}
			sub.Post.Responses = models.response(v1beta2.Job{})
		}
		if sub.Get != nil {
			sub.Get.Description = "List recent jobs"
			sub.Get.Responses = models.response(v1beta2.JobList{})
		}
	}
	if sub := paths[repo+"/jobs/{path}"]; sub != nil {
		// The path is the UID of the job, and jobs are only created on the repository.
		delete(paths, repo+"/jobs/{path}")
		paths[repo+"/jobs/{uid}"] = sub
		sub.Post = nil
		renamePathParameter(sub, "uid", "Original Job UID")
		if sub.Get != nil {
			sub.Get.Description = "Get job by UID"
			sub.Get.Responses = models.response(v1beta2.Job{})
		}
	}
	if sub := paths[repo+"/webhook"]; sub != nil {
		sub.Get = nil
		if sub.Post != nil {
			sub.Post.Description = "Currently only supports github webhooks"
			sub.Post.Responses = models.response(v1beta2.WebhookResponse{})
		}
	}
	// Images are only read by GUID.
	delete(paths, repo+"/render")
	if sub := paths[repo+"/render/{path}"]; sub != nil {
		delete(paths, repo+"/render/{path}")
		paths[repo+"/render/{guid}"] = sub
		renamePathParameter(sub, "guid", "Image GUID")
		if sub.Get != nil {
			sub.Get.Description = "get a rendered preview image"
			sub.Get.Responses = &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{200: {ResponseProps: spec3.ResponseProps{
					Description: "OK",
					Content:     map[string]*spec3.MediaType{"image/png": {}},
				}}},
			}}
		}
	}
}

type openAPIModel interface{ OpenAPIModelName() string }

// v1beta2Models references models in the OpenAPI and records them, so their definitions can be
// added.
type v1beta2Models struct {
	referenced []string
}

func (m *v1beta2Models) ref(model openAPIModel) string {
	m.referenced = append(m.referenced, model.OpenAPIModelName())
	return "#/components/schemas/" + model.OpenAPIModelName()
}

func (m *v1beta2Models) response(model openAPIModel) *spec3.Responses {
	return getJSONResponse(m.ref(model))
}

func (m *v1beta2Models) requestBody(model openAPIModel, required bool) *spec3.RequestBody {
	return &spec3.RequestBody{RequestBodyProps: spec3.RequestBodyProps{
		Required: required,
		Content: map[string]*spec3.MediaType{"application/json": {MediaTypeProps: spec3.MediaTypeProps{
			Schema: &spec.Schema{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef(m.ref(model))}},
		}}},
	}}
}

// renamePathParameter renames the path parameter Kubernetes calls "path".
func renamePathParameter(sub *spec3.Path, name, description string) {
	for _, p := range sub.Parameters {
		if p.Name == "path" {
			p.Name = name
			p.Description = description
			return
		}
	}
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
