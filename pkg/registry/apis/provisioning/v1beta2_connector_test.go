package provisioning

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// fakeV0alpha1Connector responds with respond, or fails with err, and records the body it read.
type fakeV0alpha1Connector struct {
	methods []string
	newObj  runtime.Object
	respond runtime.Object
	err     error
	body    []byte
}

func (f *fakeV0alpha1Connector) New() runtime.Object {
	if f.newObj != nil {
		return f.newObj
	}
	return &provisioning.RefList{}
}
func (f *fakeV0alpha1Connector) Destroy()                 {}
func (f *fakeV0alpha1Connector) ConnectMethods() []string { return f.methods }
func (f *fakeV0alpha1Connector) ProducesMIMETypes(string) []string {
	return []string{"application/json"}
}
func (f *fakeV0alpha1Connector) ProducesObject(verb string) any { return f.New() }
func (f *fakeV0alpha1Connector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (f *fakeV0alpha1Connector) Connect(_ context.Context, _ string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			f.body, _ = io.ReadAll(r.Body)
		}
		if f.err != nil {
			responder.Error(f.err)
			return
		}
		responder.Object(http.StatusOK, f.respond)
	}), nil
}

func serveV1beta2Connector(t *testing.T, c *v1beta2Connector, method, body string) *recordingResponder {
	t.Helper()
	responder := &recordingResponder{}
	handler, err := c.Connect(context.Background(), "repo", nil, responder)
	require.NoError(t, err)
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(method, "/repo/files/a.json", reader))
	return responder
}

func TestV1beta2Connector(t *testing.T) {
	_, scheme := newV1beta2TestBuilder(t, &APIBuilder{})
	get := []string{http.MethodGet}

	t.Run("declares the v1beta2 types", func(t *testing.T) {
		c, err := newV1beta2Connector(scheme, &fakeV0alpha1Connector{methods: get, newObj: &provisioning.ResourceWrapper{}})
		require.NoError(t, err)
		assert.IsType(t, &v1beta2.ResourceWrapper{}, c.New())
		assert.IsType(t, &v1beta2.ResourceWrapper{}, c.ProducesObject(http.MethodGet))
		assert.Nil(t, c.ProducesObject(http.MethodPost))
		assert.Equal(t, []string{"application/json"}, c.ProducesMIMETypes(http.MethodGet))
		_, path, _ := c.NewConnectOptions()
		assert.True(t, path)
	})

	t.Run("documents connectors without produced objects as Kubernetes does", func(t *testing.T) {
		c, err := newV1beta2Connector(scheme, NewHistorySubresource(nil))
		require.NoError(t, err)
		assert.IsType(t, &v1beta2.HistoryList{}, c.New())
		assert.Nil(t, c.ProducesObject(http.MethodGet))
		assert.Nil(t, c.ProducesMIMETypes(http.MethodGet))
	})

	t.Run("converts responses", func(t *testing.T) {
		inner := &fakeV0alpha1Connector{methods: get, respond: &provisioning.RefList{
			Items: []provisioning.RefItem{{Name: "main", Hash: "abc", RefURL: "https://example.com/main", Protected: true}},
		}}
		c, err := newV1beta2Connector(scheme, inner)
		require.NoError(t, err)

		rsp := serveV1beta2Connector(t, c, http.MethodGet, "")
		require.NoError(t, rsp.err)
		assert.Equal(t, http.StatusOK, rsp.code)
		refs, ok := rsp.obj.(*v1beta2.RefList)
		require.True(t, ok, "got %T", rsp.obj)
		assert.Equal(t, v1beta2.GroupVersion.WithKind("RefList"), refs.GroupVersionKind())

		v0, err := json.Marshal(inner.respond.(*provisioning.RefList).Items)
		require.NoError(t, err)
		v1, err := json.Marshal(refs.Items)
		require.NoError(t, err)
		assert.JSONEq(t, string(v0), string(v1))
	})

	t.Run("converts every type a connector responds with", func(t *testing.T) {
		inner := &fakeV0alpha1Connector{methods: get, newObj: &provisioning.ResourceWrapper{}, respond: &provisioning.FileList{
			Items: []provisioning.FileItem{{Path: "a.json", Hash: "abc"}},
		}}
		c, err := newV1beta2Connector(scheme, inner)
		require.NoError(t, err)
		rsp := serveV1beta2Connector(t, c, http.MethodGet, "")
		require.NoError(t, rsp.err)
		assert.IsType(t, &v1beta2.FileList{}, rsp.obj)
	})

	t.Run("passes errors and non-provisioning objects through", func(t *testing.T) {
		notFound := apierrors.NewNotFound(provisioning.RepositoryResourceInfo.GroupResource(), "repo")
		c, err := newV1beta2Connector(scheme, &fakeV0alpha1Connector{methods: get, err: notFound})
		require.NoError(t, err)
		assert.Equal(t, notFound, serveV1beta2Connector(t, c, http.MethodGet, "").err)

		status := &metav1.Status{Status: metav1.StatusSuccess}
		c, err = newV1beta2Connector(scheme, &fakeV0alpha1Connector{methods: get, respond: status})
		require.NoError(t, err)
		assert.Same(t, status, serveV1beta2Connector(t, c, http.MethodGet, "").obj)
	})

	t.Run("fails responses without a v1beta2 counterpart", func(t *testing.T) {
		scheme := runtime.NewScheme()
		require.NoError(t, v1beta2.AddToScheme(scheme))
		require.NoError(t, v1beta2.RegisterConversions(scheme))
		require.NoError(t, provisioning.AddKnownTypes(provisioning.SchemeGroupVersion, scheme))
		scheme.AddKnownTypeWithName(provisioning.SchemeGroupVersion.WithKind("Unserved"), &provisioning.RepositoryViewList{})

		c, err := newV1beta2Connector(scheme, &fakeV0alpha1Connector{methods: get, respond: &provisioning.RepositoryViewList{}})
		require.NoError(t, err)
		rsp := serveV1beta2Connector(t, c, http.MethodGet, "")
		assert.True(t, apierrors.IsInternalError(rsp.err), "got %v", rsp.err)
		assert.Nil(t, rsp.obj)
	})

	t.Run("serves only the selected methods", func(t *testing.T) {
		inner := &fakeV0alpha1Connector{methods: []string{http.MethodGet, http.MethodPost}}
		c, err := newV1beta2Connector(scheme, inner, withV1beta2Methods(http.MethodGet))
		require.NoError(t, err)
		assert.Equal(t, get, c.ConnectMethods())

		_, err = newV1beta2Connector(scheme, inner, withV1beta2Methods(http.MethodDelete))
		require.ErrorContains(t, err, "does not serve DELETE")
	})

	t.Run("rejects inner types without a v1beta2 counterpart", func(t *testing.T) {
		_, err := newV1beta2Connector(scheme, &fakeV0alpha1Connector{methods: get, newObj: &metav1.Status{}})
		require.ErrorContains(t, err, "has no "+v1beta2.GroupVersion.String()+" counterpart")
	})

	t.Run("passes request bodies through by default", func(t *testing.T) {
		inner := &fakeV0alpha1Connector{methods: []string{http.MethodPost}, respond: &provisioning.RefList{}}
		c, err := newV1beta2Connector(scheme, inner)
		require.NoError(t, err)
		serveV1beta2Connector(t, c, http.MethodPost, "raw: yaml")
		assert.Equal(t, "raw: yaml", string(inner.body))
	})

	t.Run("converts typed request bodies", func(t *testing.T) {
		repositoryBody := v1beta2RequestConversion{
			MaxBytes: 1 << 20,
			Convert:  v1beta2ObjectRequest(scheme, func() runtime.Object { return &v1beta2.Repository{} }),
		}
		post := []string{http.MethodPost}
		newConnector := func(t *testing.T) (*v1beta2Connector, *fakeV0alpha1Connector) {
			inner := &fakeV0alpha1Connector{methods: post, respond: &provisioning.TestResults{Code: 200, Success: true}}
			c, err := newV1beta2Connector(scheme, inner, withV1beta2RequestBody(repositoryBody, http.MethodPost))
			require.NoError(t, err)
			return c, inner
		}

		t.Run("as the storage version", func(t *testing.T) {
			c, inner := newConnector(t)
			body, err := json.Marshal(testV1beta2Repository())
			require.NoError(t, err)
			rsp := serveV1beta2Connector(t, c, http.MethodPost, string(body))
			require.NoError(t, rsp.err)
			assert.IsType(t, &v1beta2.TestResults{}, rsp.obj)

			var received provisioning.Repository
			require.NoError(t, json.Unmarshal(inner.body, &received))
			assert.Equal(t, provisioning.APIVERSION, received.APIVersion)
			assert.Equal(t, "https://github.com/example/test", received.Spec.GitHub.URL)
		})

		t.Run("keeping empty bodies empty", func(t *testing.T) {
			c, inner := newConnector(t)
			require.NoError(t, serveV1beta2Connector(t, c, http.MethodPost, "").err)
			assert.Empty(t, inner.body)
		})

		t.Run("rejecting invalid bodies", func(t *testing.T) {
			c, inner := newConnector(t)
			err := serveV1beta2Connector(t, c, http.MethodPost, "{not json").err
			assert.True(t, apierrors.IsBadRequest(err), "got %v", err)
			assert.Nil(t, inner.body)
		})

		t.Run("rejecting bodies over the limit", func(t *testing.T) {
			inner := &fakeV0alpha1Connector{methods: post}
			small := repositoryBody
			small.MaxBytes = 4
			c, err := newV1beta2Connector(scheme, inner, withV1beta2RequestBody(small, http.MethodPost))
			require.NoError(t, err)
			err = serveV1beta2Connector(t, c, http.MethodPost, `{"spec":{}}`).err
			assert.True(t, apierrors.IsRequestEntityTooLargeError(err), "got %v", err)
			assert.Nil(t, inner.body)
		})

		t.Run("only for served methods with a limit", func(t *testing.T) {
			inner := &fakeV0alpha1Connector{methods: post}
			_, err := newV1beta2Connector(scheme, inner, withV1beta2RequestBody(repositoryBody, http.MethodPut))
			require.ErrorContains(t, err, "not served")
			_, err = newV1beta2Connector(scheme, inner, withV1beta2RequestBody(v1beta2RequestConversion{Convert: repositoryBody.Convert}, http.MethodPost))
			require.ErrorContains(t, err, "positive MaxBytes")
		})
	})
}

func TestV1beta2ConnectorStorage(t *testing.T) {
	b, scheme := newV1beta2TestBuilder(t, &APIBuilder{})
	storage, err := b.connectorStorage(scheme)
	require.NoError(t, err)

	expected := map[string]runtime.Object{
		"repositories/refs":        &v1beta2.RefList{},
		"repositories/resources":   &v1beta2.ResourceList{},
		"repositories/stats":       &v1beta2.ResourceCountList{},
		"repositories/history":     &v1beta2.HistoryList{},
		"repositories/files":       &v1beta2.ResourceWrapper{},
		"connections/repositories": &v1beta2.ExternalRepositoryList{},
	}
	require.Len(t, storage, len(expected))
	for path, obj := range expected {
		s, ok := storage[path]
		require.True(t, ok, "missing %s", path)
		assert.IsType(t, obj, s.New(), path)
		connector, ok := s.(rest.Connecter)
		require.True(t, ok, path)
		assert.Equal(t, []string{http.MethodGet}, connector.ConnectMethods(), path)
	}
}

func TestV1beta2RouteConversion(t *testing.T) {
	b, _ := newV1beta2TestBuilder(t, &APIBuilder{})

	settings := &provisioning.RepositoryViewList{
		AllowedTargets:           []provisioning.SyncTargetType{provisioning.SyncTargetTypeFolder},
		AvailableRepositoryTypes: []provisioning.RepositoryType{provisioning.GitHubRepositoryType},
		AvailableResources:       []provisioning.SupportedResource{{Group: "dashboard.grafana.app", Kind: "Dashboard"}},
		MaxRepositories:          10,
		Items: []provisioning.RepositoryView{{
			Name: "repo", Title: "Repo", Type: provisioning.GitHubRepositoryType, Target: provisioning.SyncTargetTypeFolder,
			Branch: "main", Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
		}},
	}
	stats := &provisioning.ResourceStats{
		TypeMeta: metav1.TypeMeta{Kind: "ResourceStats"},
		Instance: []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 3}},
		Managed: []provisioning.ManagerStats{{
			Kind: utils.ManagerKindRepo, Identity: "repo",
			Stats: []provisioning.ResourceCount{{Group: "folder.grafana.app", Resource: "folders", Count: 1}},
		}},
	}

	for name, tc := range map[string]struct {
		in     runtime.Object
		newOut func() runtime.Object
	}{
		"settings": {in: settings, newOut: func() runtime.Object { return &v1beta2.RepositoryViewList{} }},
		"stats":    {in: stats, newOut: func() runtime.Object { return &v1beta2.ResourceStats{} }},
	} {
		t.Run("converts "+name+" to the same JSON", func(t *testing.T) {
			out, err := b.routeConversion(tc.newOut)(tc.in)
			require.NoError(t, err)
			assert.IsType(t, tc.newOut(), out)

			v0, err := json.Marshal(tc.in)
			require.NoError(t, err)
			v1, err := json.Marshal(out)
			require.NoError(t, err)
			assert.JSONEq(t, string(v0), string(v1))
		})
	}

	t.Run("moves a versioned body to v1beta2", func(t *testing.T) {
		in := &provisioning.ResourceStats{TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceStats"}}
		out, err := b.routeConversion(func() runtime.Object { return &v1beta2.ResourceStats{} })(in)
		require.NoError(t, err)
		assert.Equal(t, v1beta2.GroupVersion.WithKind("ResourceStats"), out.GetObjectKind().GroupVersionKind())
	})

	t.Run("names v1beta2 models", func(t *testing.T) {
		routes := b.GetAPIRoutes(v1beta2.GroupVersion)
		require.Len(t, routes.Namespace, 2)
		for i, model := range []string{v1beta2.ResourceStats{}.OpenAPIModelName(), v1beta2.RepositoryViewList{}.OpenAPIModelName()} {
			schema := routes.Namespace[i].Spec.Get.Responses.StatusCodeResponses[200].Content["application/json"].Schema
			assert.Equal(t, "#/components/schemas/"+model, schema.Ref.String())
		}
	})
}

func TestDocumentV1beta2Subresources(t *testing.T) {
	root := "/apis/" + v1beta2.GroupVersion.String() + "/"
	repo := root + "namespaces/{namespace}/repositories/{name}"
	get := func() *spec3.Path {
		return &spec3.Path{PathProps: spec3.PathProps{Get: &spec3.Operation{}}}
	}
	oas := &spec3.OpenAPI{
		Paths: &spec3.Paths{Paths: map[string]*spec3.Path{
			repo + "/refs":         get(),
			repo + "/history":      get(),
			repo + "/files":        {PathProps: spec3.PathProps{Get: &spec3.Operation{}, Post: &spec3.Operation{}}},
			repo + "/files/{path}": get(),
		}},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
	}
	documentV1beta2Subresources(oas, root)

	paths := oas.Paths.Paths
	assert.NotContains(t, paths, repo+"/files")
	require.Contains(t, paths, repo+"/files/")
	assert.Nil(t, paths[repo+"/files/"].Post, "only GET lists files")
	assert.Equal(t, "#/components/schemas/"+v1beta2.FileList{}.OpenAPIModelName(),
		paths[repo+"/files/"].Get.Responses.StatusCodeResponses[200].Content["application/json"].Schema.Ref.String())
	assert.Equal(t, "#/components/schemas/"+v1beta2.HistoryList{}.OpenAPIModelName(),
		paths[repo+"/history"].Get.Responses.StatusCodeResponses[200].Content["application/json"].Schema.Ref.String())
	assert.Equal(t, "ref", paths[repo+"/files/{path}"].Get.Parameters[0].Name)

	for _, model := range []string{
		v1beta2.ResourceStats{}.OpenAPIModelName(),
		v1beta2.ManagerStats{}.OpenAPIModelName(),
		v1beta2.ResourceCount{}.OpenAPIModelName(),
		v1beta2.RepositoryViewList{}.OpenAPIModelName(),
		v1beta2.RepositoryView{}.OpenAPIModelName(),
		v1beta2.SupportedResource{}.OpenAPIModelName(),
		v1beta2.FileList{}.OpenAPIModelName(),
		v1beta2.FileItem{}.OpenAPIModelName(),
		v1beta2.HistoryList{}.OpenAPIModelName(),
		v1beta2.RefList{}.OpenAPIModelName(),
	} {
		assert.Contains(t, oas.Components.Schemas, model)
	}
	items := oas.Components.Schemas[v1beta2.ResourceStats{}.OpenAPIModelName()].Properties["instance"].Items.Schema
	assert.Equal(t, "#/components/schemas/"+v1beta2.ResourceCount{}.OpenAPIModelName(), items.Ref.String())
}
