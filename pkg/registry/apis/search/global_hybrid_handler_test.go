package search

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func globalHybridTargets() map[schema.GroupResource]schema.GroupVersionKind {
	return map[schema.GroupResource]schema.GroupVersionKind{
		{Group: "dashboard.grafana.app", Resource: "dashboards"}: {Group: "dashboard.grafana.app", Version: "v1beta1", Kind: "Dashboard"},
		{Group: "folder.grafana.app", Resource: "folders"}:       {Group: "folder.grafana.app", Version: "v1", Kind: "Folder"},
	}
}

func TestGlobalHybridSearchDefaultResources(t *testing.T) {
	dashboards := searchv0.HybridSearchResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := searchv0.HybridSearchResource{Group: "folder.grafana.app", Resource: "folders"}
	for _, tc := range []struct {
		name       string
		defaults   []searchv0.HybridSearchResource
		resources  []searchv0.HybridSearchResource
		deny       bool
		wantStatus int
		wantRPC    []searchv0.HybridSearchResource
	}{
		{name: "omitted resources use defaults", defaults: []searchv0.HybridSearchResource{dashboards, folders}, wantStatus: http.StatusOK, wantRPC: []searchv0.HybridSearchResource{dashboards, folders}},
		{name: "empty resources use defaults", defaults: []searchv0.HybridSearchResource{dashboards}, resources: []searchv0.HybridSearchResource{}, wantStatus: http.StatusOK, wantRPC: []searchv0.HybridSearchResource{dashboards}},
		{name: "explicit resources override defaults", defaults: []searchv0.HybridSearchResource{dashboards}, resources: []searchv0.HybridSearchResource{folders}, wantStatus: http.StatusOK, wantRPC: []searchv0.HybridSearchResource{folders}},
		{name: "empty defaults retain validation", wantStatus: http.StatusUnprocessableEntity},
		{name: "denied default stops before RPC", defaults: []searchv0.HybridSearchResource{dashboards}, deny: true, wantStatus: http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeHybridIndexClient{response: &resourcepb.HybridSearchResponse{}}
			var checks []string
			auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
				checks = append(checks, attr.GetResource())
				if tc.deny {
					return authorizer.DecisionDeny, "", nil
				}
				return authorizer.DecisionAllow, "", nil
			})
			q := hybridQuery()
			q.Resources = tc.resources
			route := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchRoute(globalHybridTargets(), nil, auth, tc.defaults)
			body := hybridBody(t, q)
			if tc.resources != nil && len(tc.resources) == 0 {
				body = strings.TrimSuffix(body, "}") + `,"resources":[]}`
			}
			w := doHybridRequest(route.Handler, body, "default", "default")
			require.Equal(t, tc.wantStatus, w.Code, w.Body.String())
			if tc.wantRPC == nil {
				assert.Nil(t, client.request)
				return
			}
			require.NotNil(t, client.request)
			require.Len(t, client.request.Resources, len(tc.wantRPC))
			require.Len(t, checks, len(tc.wantRPC))
			for i, target := range tc.wantRPC {
				assert.Equal(t, target.Group, client.request.Resources[i].Group)
				assert.Equal(t, target.Resource, client.request.Resources[i].Resource)
				assert.Equal(t, target.Resource, checks[i])
			}
		})
	}
}

func TestGlobalHybridSearchRoute(t *testing.T) {
	client := &fakeHybridIndexClient{response: &resourcepb.HybridSearchResponse{Results: []*resourcepb.HybridSearchResult{
		{Key: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "same-uid"}, Title: "Operations dashboard", Score: 0.9},
		{Key: &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Name: "same-uid"}, Title: "Operations folder", Score: 0.8},
	}}}
	var checks []authorizer.Attributes
	auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		checks = append(checks, attr)
		return authorizer.DecisionAllow, "", nil
	})
	route := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchRoute(globalHybridTargets(), nil, auth, nil)
	assert.Equal(t, "global/search/hybrid", route.Path)
	assert.Equal(t, "listGlobalHybridSearchV0alpha1", route.Spec.Post.OperationId)
	assert.Nil(t, route.Spec.Get)
	for name, s := range route.Schemas {
		for _, ref := range collectRefs(&s) {
			assert.Contains(t, route.Schemas, ref, "%s references an unpublished schema", name)
		}
	}
	query := httptest.NewRequest(http.MethodPost, "/apis/search.grafana.app/v0alpha1/namespaces/default/global/search/hybrid", strings.NewReader(requestExample(t, route)))
	caller := &user.DefaultInfo{Name: "viewer"}
	ctx := request.WithUser(request.WithNamespace(query.Context(), "default"), caller)
	w := httptest.NewRecorder()
	route.Handler(w, query.WithContext(ctx))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.NotNil(t, client.request)
	assert.Equal(t, "default", client.request.Namespace)
	assert.True(t, client.request.RequireHybridEnabled)
	assert.Equal(t, "production", client.request.Query)
	assert.Equal(t, int64(10), client.request.Limit)
	assert.Equal(t, []*resourcepb.HybridSearchRequest_Resource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "folder.grafana.app", Resource: "folders"},
	}, client.request.Resources)
	require.Len(t, checks, 2)
	for i, target := range client.request.Resources {
		gr := schema.GroupResource{Group: target.Group, Resource: target.Resource}
		gvk := globalHybridTargets()[gr]
		assert.Equal(t, authorizer.AttributesRecord{
			User: caller, Verb: "list", Namespace: "default", APIGroup: gr.Group,
			APIVersion: gvk.Version, Resource: gr.Resource, ResourceRequest: true,
			Path: "/apis/" + gr.Group + "/" + gvk.Version + "/namespaces/default/" + gr.Resource + "/search/hybrid",
		}, checks[i])
	}
	var response searchv0.HybridSearchResults
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	require.Len(t, response.Items, 2)
	assert.Equal(t, searchv0.ResourceRef{Group: "dashboard.grafana.app", Resource: "dashboards", Kind: "Dashboard", Name: "same-uid"}, response.Items[0].Resource)
	assert.Equal(t, searchv0.ResourceRef{Group: "folder.grafana.app", Resource: "folders", Kind: "Folder", Name: "same-uid"}, response.Items[1].Resource)
	assert.Equal(t, 0.9, response.Items[0].Score)
}

func TestGlobalHybridSearchUsesKindsReportedByServer(t *testing.T) {
	client := &fakeHybridIndexClient{response: &resourcepb.HybridSearchResponse{
		Results: []*resourcepb.HybridSearchResult{
			{Key: &resourcepb.ResourceKey{Group: "example.grafana.app", Resource: "widgets", Name: "widget-a"}},
			{Key: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a"}},
			{Key: &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Name: "folder-a"}},
			{Key: &resourcepb.ResourceKey{Group: "external.ext.grafana.app", Resource: "documents", Name: "doc-a"}},
		},
		Kinds: map[string]string{
			"example.grafana.app/widgets":      "Widget",
			"dashboard.grafana.app/dashboards": "DisplayDashboard",
		},
	}}
	auth := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	})
	h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchFor(globalHybridTargets(), nil, auth, nil)
	q := hybridQuery()
	q.Resources = []searchv0.HybridSearchResource{
		{Group: "example.grafana.app", Resource: "widgets"},
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "folder.grafana.app", Resource: "folders"},
		{Group: "external.ext.grafana.app", Resource: "documents"},
	}
	kinds := func() []string {
		t.Helper()
		w := doHybridRequest(h, hybridBody(t, q), "default", "default")
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var out searchv0.HybridSearchResults
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
		require.Len(t, out.Items, 4)
		got := make([]string, 0, len(out.Items))
		for _, item := range out.Items {
			got = append(got, item.Resource.Kind)
		}
		return got
	}
	assert.Equal(t, []string{"Widget", "DisplayDashboard", "Folder", ""}, kinds())
	client.response.Kinds = nil
	assert.Equal(t, []string{"", "Dashboard", "Folder", ""}, kinds())
	client.response.Kinds = map[string]string{}
	assert.Equal(t, []string{"", "Dashboard", "Folder", ""}, kinds())
}

func TestGlobalHybridSearchUnknownResources(t *testing.T) {
	remote := searchv0.HybridSearchResource{Group: "example.grafana.app", Resource: "widgets"}
	dashboards := searchv0.HybridSearchResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	for _, tc := range []struct {
		name       string
		resources  []searchv0.HybridSearchResource
		err        error
		wantStatus int
		wantChecks int
	}{
		{name: "remote manifest resource", resources: []searchv0.HybridSearchResource{remote}, wantStatus: http.StatusOK},
		{name: "mixed resources", resources: []searchv0.HybridSearchResource{remote, dashboards}, wantStatus: http.StatusOK, wantChecks: 1},
		{name: "backend rejects target", resources: []searchv0.HybridSearchResource{remote}, err: status.Error(codes.NotFound, "collection not found"), wantStatus: http.StatusNotFound},
		{name: "storage denies access", resources: []searchv0.HybridSearchResource{remote}, err: status.Error(codes.PermissionDenied, "access denied"), wantStatus: http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeHybridIndexClient{err: tc.err, response: &resourcepb.HybridSearchResponse{Results: []*resourcepb.HybridSearchResult{
				{Key: &resourcepb.ResourceKey{Group: remote.Group, Resource: remote.Resource, Name: "cpu"}, Title: "High CPU", Score: 0.9},
			}}}
			checks := 0
			auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
				checks++
				assert.Equal(t, dashboards.Group, attr.GetAPIGroup())
				assert.Equal(t, dashboards.Resource, attr.GetResource())
				return authorizer.DecisionAllow, "", nil
			})
			q := hybridQuery()
			q.Resources = tc.resources
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchFor(globalHybridTargets(), nil, auth, nil)
			w := doHybridRequest(h, hybridBody(t, q), "default", "default")
			require.Equal(t, tc.wantStatus, w.Code, w.Body.String())
			assert.Equal(t, tc.wantChecks, checks)
			require.NotNil(t, client.request)
			assert.Equal(t, "default", client.request.Namespace)
			assert.True(t, client.request.RequireHybridEnabled)
			require.Len(t, client.request.Resources, len(tc.resources))
			for i, target := range tc.resources {
				assert.Equal(t, target.Group, client.request.Resources[i].Group)
				assert.Equal(t, target.Resource, client.request.Resources[i].Resource)
			}
			if tc.err != nil {
				return
			}
			var response searchv0.HybridSearchResults
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
			require.Len(t, response.Items, 1)
			assert.Equal(t, searchv0.ResourceRef{Group: remote.Group, Resource: remote.Resource, Name: "cpu"}, response.Items[0].Resource)
		})
	}
}

func TestGlobalHybridSearchRejectsBeforeRPC(t *testing.T) {
	for _, tc := range []struct {
		name       string
		resource   string
		namespace  string
		decision   authorizer.Decision
		err        error
		wantStatus int
		wantChecks int
		field      string
	}{
		{name: "missing namespace", resource: "folders", wantStatus: http.StatusBadRequest},
		{name: "wildcard namespace", resource: "folders", namespace: "*", wantStatus: http.StatusBadRequest},
		{name: "case variant cannot skip authorization", resource: "Folders", namespace: "default", decision: authorizer.DecisionDeny, wantStatus: http.StatusUnprocessableEntity, field: "resources[2].resource"},
		{name: "padded resource", resource: " folders ", namespace: "default", wantStatus: http.StatusUnprocessableEntity, field: "resources[2].resource"},
		{name: "target denied", resource: "folders", namespace: "default", decision: authorizer.DecisionDeny, wantStatus: http.StatusForbidden, wantChecks: 2},
		{name: "target no opinion", resource: "folders", namespace: "default", decision: authorizer.DecisionNoOpinion, wantStatus: http.StatusForbidden, wantChecks: 2},
		{name: "authorization error", resource: "folders", namespace: "default", err: errors.New("authorization unavailable"), wantStatus: http.StatusInternalServerError, wantChecks: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeHybridIndexClient{}
			checks := 0
			auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
				checks++
				if attr.GetResource() == "dashboards" {
					return authorizer.DecisionAllow, "", nil
				}
				return tc.decision, "", tc.err
			})
			q := hybridQuery()
			q.Resources = []searchv0.HybridSearchResource{
				{Group: "assistant.alertrules.ext.grafana.app", Resource: "alertrules"},
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: "folder.grafana.app", Resource: tc.resource},
			}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchFor(globalHybridTargets(), nil, auth, nil)
			w := doHybridRequest(h, hybridBody(t, q), tc.namespace, tc.namespace)
			assert.Equal(t, tc.wantStatus, w.Code, w.Body.String())
			assert.Equal(t, tc.wantChecks, checks)
			assert.Nil(t, client.request)
			if tc.field != "" {
				var apiStatus metav1.Status
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &apiStatus))
				require.NotNil(t, apiStatus.Details)
				require.Len(t, apiStatus.Details.Causes, 1)
				assert.Equal(t, tc.field, apiStatus.Details.Causes[0].Field)
			}
		})
	}
}

func TestGlobalHybridSearchAuthorizesKnownExtApp(t *testing.T) {
	gr := schema.GroupResource{Group: "example.ext.grafana.app", Resource: "widgets"}
	client := &fakeHybridIndexClient{}
	auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		assert.Equal(t, gr.Group, attr.GetAPIGroup())
		assert.Equal(t, gr.Resource, attr.GetResource())
		return authorizer.DecisionDeny, "", nil
	})
	q := hybridQuery()
	q.Resources = []searchv0.HybridSearchResource{{Group: gr.Group, Resource: gr.Resource}}
	targets := map[schema.GroupResource]schema.GroupVersionKind{gr: {Group: gr.Group, Version: "v1", Kind: "Widget"}}
	h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchFor(targets, nil, auth, nil)
	w := doHybridRequest(h, hybridBody(t, q), "default", "default")
	assert.Equal(t, http.StatusForbidden, w.Code, w.Body.String())
	assert.Nil(t, client.request)
}
