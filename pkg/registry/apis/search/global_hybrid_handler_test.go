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
	route := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchRoute(globalHybridTargets(), auth)
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

func TestGlobalHybridSearchExternalResources(t *testing.T) {
	external := searchv0.HybridSearchResource{Group: "assistant.alertrules.ext.grafana.app", Resource: "alertrules"}
	dashboards := searchv0.HybridSearchResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	for _, tc := range []struct {
		name       string
		resources  []searchv0.HybridSearchResource
		err        error
		wantStatus int
		wantChecks int
	}{
		{name: "external only", resources: []searchv0.HybridSearchResource{external}, wantStatus: http.StatusOK},
		{name: "mixed resources", resources: []searchv0.HybridSearchResource{external, dashboards}, wantStatus: http.StatusOK, wantChecks: 1},
		{name: "external not enrolled", resources: []searchv0.HybridSearchResource{external}, err: status.Error(codes.NotFound, "collection not found"), wantStatus: http.StatusNotFound},
		{name: "storage denies access", resources: []searchv0.HybridSearchResource{external}, err: status.Error(codes.PermissionDenied, "access denied"), wantStatus: http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeHybridIndexClient{err: tc.err, response: &resourcepb.HybridSearchResponse{Results: []*resourcepb.HybridSearchResult{
				{Key: &resourcepb.ResourceKey{Group: external.Group, Resource: external.Resource, Name: "cpu"}, Title: "High CPU", Score: 0.9},
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
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchFor(globalHybridTargets(), auth)
			w := doHybridRequest(h, hybridBody(t, q), "default", "default")
			require.Equal(t, tc.wantStatus, w.Code, w.Body.String())
			assert.Equal(t, tc.wantChecks, checks)
			require.NotNil(t, client.request)
			assert.Equal(t, "default", client.request.Namespace)
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
			assert.Equal(t, searchv0.ResourceRef{Group: external.Group, Resource: external.Resource, Name: "cpu"}, response.Items[0].Resource)
		})
	}
}

func TestGlobalHybridSearchRejectsBeforeRPC(t *testing.T) {
	for _, tc := range []struct {
		name       string
		group      string
		resource   string
		namespace  string
		decision   authorizer.Decision
		err        error
		wantStatus int
		wantChecks int
	}{
		{name: "target not exposed", resource: "private", namespace: "default", wantStatus: http.StatusUnprocessableEntity},
		{name: "suffix must be at end", group: "test.ext.grafana.app.other", resource: "private", namespace: "default", wantStatus: http.StatusUnprocessableEntity},
		{name: "suffix requires dot boundary", group: "testext.grafana.app", resource: "private", namespace: "default", wantStatus: http.StatusUnprocessableEntity},
		{name: "missing namespace", resource: "folders", wantStatus: http.StatusBadRequest},
		{name: "wildcard namespace", resource: "folders", namespace: "*", wantStatus: http.StatusBadRequest},
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
			group := tc.group
			if group == "" {
				group = "folder.grafana.app"
			}
			q := hybridQuery()
			q.Resources = []searchv0.HybridSearchResource{
				{Group: "assistant.alertrules.ext.grafana.app", Resource: "alertrules"},
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: group, Resource: tc.resource},
			}
			h := NewHybridHandler(client, noop.NewTracerProvider().Tracer("")).GlobalHybridSearchFor(globalHybridTargets(), auth)
			w := doHybridRequest(h, hybridBody(t, q), tc.namespace, tc.namespace)
			assert.Equal(t, tc.wantStatus, w.Code, w.Body.String())
			assert.Equal(t, tc.wantChecks, checks)
			assert.Nil(t, client.request)
		})
	}
}
