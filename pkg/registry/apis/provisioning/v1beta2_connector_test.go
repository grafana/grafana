package provisioning

import (
	"context"
	"encoding/json"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
	"k8s.io/utils/ptr"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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

// fakeExtra adds storage and authorizes the subresource it names.
type fakeExtra struct {
	subresource string
	storage     map[string]rest.Storage
}

func (e *fakeExtra) Authorize(_ context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
	if a.GetSubresource() == e.subresource {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionNoOpinion, "", nil
}

func (e *fakeExtra) UpdateStorage(storage map[string]rest.Storage) error {
	maps.Copy(storage, e.storage)
	return nil
}

func (e *fakeExtra) PostProcessOpenAPI(*spec3.OpenAPI) error { return nil }

type fakeV1beta2Extra struct{ fakeExtra }

func (e *fakeV1beta2Extra) ServedOnV1beta2() {}

func TestV1beta2ConnectorStorage(t *testing.T) {
	webhook := &fakeV0alpha1Connector{methods: []string{http.MethodPost}, newObj: &provisioning.WebhookResponse{}}
	inner := &APIBuilder{
		jobHistory: jobs.NewMockHistoryReader(t),
		extras: []Extra{
			&fakeV1beta2Extra{fakeExtra{storage: map[string]rest.Storage{"repositories/webhook": WithTimeout(webhook, time.Second)}}},
			&fakeExtra{storage: map[string]rest.Storage{"repositories/enterprise": &fakeV0alpha1Connector{methods: []string{http.MethodGet}}}},
		},
	}
	b, scheme := newV1beta2TestBuilder(t, inner)
	storage, err := b.connectorStorage(scheme)
	require.NoError(t, err)

	get, post := []string{http.MethodGet}, []string{http.MethodPost}
	expected := map[string]struct {
		obj     runtime.Object
		methods []string
	}{
		"repositories/test":        {&v1beta2.TestResults{}, post},
		"repositories/files":       {&v1beta2.ResourceWrapper{}, []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete}},
		"repositories/refs":        {&v1beta2.RefList{}, get},
		"repositories/resources":   {&v1beta2.ResourceList{}, get},
		"repositories/stats":       {&v1beta2.ResourceCountList{}, get},
		"repositories/history":     {&v1beta2.HistoryList{}, get},
		"repositories/jobs":        {&v1beta2.Repository{}, []string{http.MethodPost, http.MethodGet}},
		"repositories/webhook":     {&v1beta2.WebhookResponse{}, post},
		"connections/repositories": {&v1beta2.ExternalRepositoryList{}, get},
		"connections/authorize":    {&v1beta2.ConnectionAuthorizeRequest{}, post},
	}
	require.Len(t, storage, len(expected), "only the extras v1beta2 serves add connectors")
	for path, e := range expected {
		s, ok := storage[path]
		require.True(t, ok, "missing %s", path)
		assert.IsType(t, e.obj, s.New(), path)
		connector, ok := s.(rest.Connecter)
		require.True(t, ok, path)
		assert.ElementsMatch(t, e.methods, connector.ConnectMethods(), path)
	}

	t.Run("needs the v0alpha1 job history", func(t *testing.T) {
		b, scheme := newV1beta2TestBuilder(t, &APIBuilder{})
		_, err := b.connectorStorage(scheme)
		require.ErrorContains(t, err, "job history")
	})

	t.Run("rejects extra storage that is not a connector", func(t *testing.T) {
		inner := &APIBuilder{
			jobHistory: jobs.NewMockHistoryReader(t),
			extras:     []Extra{&fakeV1beta2Extra{fakeExtra{storage: map[string]rest.Storage{"repositories/plain": &historicJobStorage{}}}}},
		}
		b, scheme := newV1beta2TestBuilder(t, inner)
		_, err := b.connectorStorage(scheme)
		require.ErrorContains(t, err, "not a connector")
	})
}

func TestV1beta2Authorizer(t *testing.T) {
	inner := &APIBuilder{extras: []Extra{
		&fakeV1beta2Extra{fakeExtra{subresource: "webhook"}},
		&fakeExtra{subresource: "enterprise"},
	}}
	b, _ := newV1beta2TestBuilder(t, inner)
	attrs := func(subresource string) authorizer.Attributes {
		return authorizer.AttributesRecord{
			Resource: provisioning.RepositoryResourceInfo.GetName(), Subresource: subresource, Verb: "create", ResourceRequest: true,
		}
	}

	decision, _, err := b.GetAuthorizer().Authorize(context.Background(), attrs("webhook"))
	require.NoError(t, err)
	assert.Equal(t, authorizer.DecisionAllow, decision, "the extras v1beta2 serves authorize first")

	decision, _, _ = b.GetAuthorizer().Authorize(context.Background(), attrs("enterprise"))
	assert.NotEqual(t, authorizer.DecisionAllow, decision, "other extras don't apply to v1beta2")
}

func TestV1beta2RequestConversions(t *testing.T) {
	_, scheme := newV1beta2TestBuilder(t, &APIBuilder{})

	t.Run("job specs convert to v0alpha1", func(t *testing.T) {
		convert := v1beta2JobSpecRequest(scheme)
		out, err := convert([]byte(`{"action":"pr","repository":"repo","pr":{"pr":12,"ref":"main","isFork":false}}`))
		require.NoError(t, err)
		var spec provisioning.JobSpec
		require.NoError(t, json.Unmarshal(out, &spec))
		assert.Equal(t, provisioning.JobActionPullRequest, spec.Action)
		require.NotNil(t, spec.PullRequest)
		assert.Equal(t, 12, spec.PullRequest.PR)
		assert.Equal(t, "main", spec.PullRequest.Ref)

		_, err = convert([]byte(`{"action":"pull","bogus":true}`))
		require.ErrorContains(t, err, "unknown field")
	})

	t.Run("empty test repositories stay empty", func(t *testing.T) {
		convert := v1beta2TestRequest(scheme)
		out, err := convert([]byte(`{}`))
		require.NoError(t, err)
		assert.Equal(t, `{}`, string(out))

		body, err := json.Marshal(testV1beta2Repository())
		require.NoError(t, err)
		out, err = convert(body)
		require.NoError(t, err)
		var repo provisioning.Repository
		require.NoError(t, json.Unmarshal(out, &repo))
		assert.Equal(t, provisioning.APIVERSION, repo.APIVersion)
		assert.Equal(t, "https://github.com/example/test", repo.Spec.GitHub.URL)
	})
}

// The jobs connector reads finished jobs from the history, which Loki or unified storage backs.
func TestV1beta2JobsConnectorHistory(t *testing.T) {
	finished := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "job", Namespace: "default", UID: "abc-123"},
		Spec:       provisioning.JobSpec{Action: provisioning.JobActionPull, Repository: "repo", Pull: &provisioning.SyncJobOptions{Incremental: true}},
		Status: provisioning.JobStatus{
			State: provisioning.JobStateSuccess, Message: "done",
			Summary: []*provisioning.JobResourceSummary{{Group: "dashboard.grafana.app", Kind: "Dashboard", Create: 2}},
		},
	}
	history := jobs.NewMockHistoryReader(t)
	history.EXPECT().GetJob(mock.Anything, "default", "repo", "abc-123").Return(finished.DeepCopy(), nil)
	history.EXPECT().RecentJobs(mock.Anything, "default", "repo").Return(&provisioning.JobList{Items: []provisioning.Job{finished}}, nil)

	b, scheme := newV1beta2TestBuilder(t, &APIBuilder{jobHistory: history})
	storage, err := b.connectorStorage(scheme)
	require.NoError(t, err)
	connector := storage["repositories/jobs"].(rest.Connecter)

	serve := func(path string) *recordingResponder {
		responder := &recordingResponder{}
		ctx := request.WithNamespace(context.Background(), "default")
		handler, err := connector.Connect(ctx, "repo", nil, responder)
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil).WithContext(ctx))
		return responder
	}
	v0, err := json.Marshal(finished)
	require.NoError(t, err)

	rsp := serve("/apis/provisioning.grafana.app/v1beta2/namespaces/default/repositories/repo/jobs/abc-123")
	require.NoError(t, rsp.err)
	job, ok := rsp.obj.(*v1beta2.Job)
	require.True(t, ok, "got %T", rsp.obj)
	job.TypeMeta = metav1.TypeMeta{}
	v1, err := json.Marshal(job)
	require.NoError(t, err)
	assert.JSONEq(t, string(v0), string(v1))

	rsp = serve("/apis/provisioning.grafana.app/v1beta2/namespaces/default/repositories/repo/jobs")
	require.NoError(t, rsp.err)
	list, ok := rsp.obj.(*v1beta2.JobList)
	require.True(t, ok, "got %T", rsp.obj)
	require.Len(t, list.Items, 1)
	assert.Equal(t, ptr.To(v1beta2.JobStateSuccess), list.Items[0].Status.State)
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

func TestDocumentV1beta2WriteSubresources(t *testing.T) {
	root := "/apis/" + v1beta2.GroupVersion.String() + "/"
	repo := root + "namespaces/{namespace}/repositories/{name}"
	connection := root + "namespaces/{namespace}/connections/{name}"
	pathParam := func() []*spec3.Parameter {
		return []*spec3.Parameter{{ParameterProps: spec3.ParameterProps{Name: "path", In: "path"}}}
	}
	all := func() *spec3.Path {
		return &spec3.Path{PathProps: spec3.PathProps{
			Get: &spec3.Operation{}, Post: &spec3.Operation{}, Put: &spec3.Operation{}, Delete: &spec3.Operation{},
			Parameters: pathParam(),
		}}
	}
	oas := &spec3.OpenAPI{
		Paths: &spec3.Paths{Paths: map[string]*spec3.Path{
			repo + "/files/{path}":    all(),
			repo + "/test":            all(),
			repo + "/jobs":            all(),
			repo + "/jobs/{path}":     all(),
			repo + "/webhook":         all(),
			repo + "/render":          all(),
			repo + "/render/{path}":   all(),
			connection + "/authorize": all(),
		}},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
	}
	documentV1beta2Subresources(oas, root)
	paths := oas.Paths.Paths
	responseRef := func(op *spec3.Operation) string {
		return op.Responses.StatusCodeResponses[200].Content["application/json"].Schema.Ref.String()
	}
	requestRef := func(op *spec3.Operation) string {
		return op.RequestBody.Content["application/json"].Schema.Ref.String()
	}
	ref := func(m interface{ OpenAPIModelName() string }) string {
		return "#/components/schemas/" + m.OpenAPIModelName()
	}

	files := paths[repo+"/files/{path}"]
	for _, op := range []*spec3.Operation{files.Put, files.Post, files.Delete} {
		assert.Equal(t, ref(v1beta2.ResourceWrapper{}), responseRef(op))
		assert.Equal(t, []string{"ref", "message", "skipDryRun", "originalPath"}, parameterNames(op.Parameters))
	}
	assert.Contains(t, files.Post.RequestBody.Content, "application/x-yaml")
	assert.Nil(t, files.Delete.RequestBody)

	test := paths[repo+"/test"].Post
	assert.True(t, test.Deprecated)
	assert.Equal(t, ref(v1beta2.Repository{}), requestRef(test))
	assert.False(t, test.RequestBody.Required)
	assert.Equal(t, ref(v1beta2.TestResults{}), responseRef(test))

	jobs := paths[repo+"/jobs"]
	assert.Equal(t, ref(v1beta2.JobSpec{}), requestRef(jobs.Post))
	assert.Equal(t, ref(v1beta2.Job{}), responseRef(jobs.Post))
	assert.Equal(t, ref(v1beta2.JobList{}), responseRef(jobs.Get))
	assert.NotContains(t, paths, repo+"/jobs/{path}")
	job := paths[repo+"/jobs/{uid}"]
	require.NotNil(t, job)
	assert.Nil(t, job.Post)
	assert.Equal(t, "uid", job.Parameters[0].Name)
	assert.Equal(t, ref(v1beta2.Job{}), responseRef(job.Get))

	webhook := paths[repo+"/webhook"]
	assert.Nil(t, webhook.Get)
	assert.Equal(t, ref(v1beta2.WebhookResponse{}), responseRef(webhook.Post))

	assert.NotContains(t, paths, repo+"/render")
	assert.NotContains(t, paths, repo+"/render/{path}")
	render := paths[repo+"/render/{guid}"]
	require.NotNil(t, render)
	assert.Equal(t, "guid", render.Parameters[0].Name)
	assert.Contains(t, render.Get.Responses.StatusCodeResponses[200].Content, "image/png")

	authorize := paths[connection+"/authorize"].Post
	assert.True(t, authorize.RequestBody.Required)
	assert.Equal(t, ref(v1beta2.ConnectionAuthorizeRequest{}), requestRef(authorize))
	assert.Equal(t, ref(v1beta2.ConnectionAuthorizeRequest{}), responseRef(authorize))

	for _, model := range []string{
		v1beta2.TestResults{}.OpenAPIModelName(),
		v1beta2.JobSpec{}.OpenAPIModelName(),
		v1beta2.WebhookResponse{}.OpenAPIModelName(),
		v1beta2.ConnectionAuthorizeRequest{}.OpenAPIModelName(),
		v1beta2.ResourceWrapper{}.OpenAPIModelName(),
	} {
		assert.Contains(t, oas.Components.Schemas, model)
	}
}

func parameterNames(params []*spec3.Parameter) []string {
	names := make([]string, 0, len(params))
	for _, p := range params {
		names = append(names, p.Name)
	}
	return names
}
