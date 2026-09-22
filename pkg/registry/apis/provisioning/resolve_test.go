package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
	clienttesting "k8s.io/client-go/testing"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

type listAccessClient struct {
	authlib.AccessChecker
	check func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)
}

func (c listAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.check(ctx, id, req, folder)
}

func listTestContext(role identity.RoleType) context.Context {
	return request.WithNamespace(identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type: authlib.TypeUser, UserUID: "reader", Namespace: "default", OrgID: 1, OrgRole: role,
	}), "default")
}

func lookupObject(t *testing.T, group, kind, name, path, folder string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": group + "/v1", "kind": kind,
		"metadata": map[string]any{"name": name, "namespace": "default"},
		"spec":     map[string]any{"title": "Current title"},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "repo"})
	meta.SetSourceProperties(utils.SourceProperties{Path: path, Checksum: "current-hash", TimestampMillis: 1234})
	meta.SetFolder(folder)
	return obj
}

func lookupClients(t *testing.T, objects ...runtime.Object) resources.ClientFactory {
	t.Helper()
	client := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), objects...)
	return lookupClientsForDynamic(t, client)
}

func lookupClientsForDynamic(t *testing.T, client *dynamicfake.FakeDynamicClient) resources.ClientFactory {
	t.Helper()
	clients := resources.NewMockResourceClients(t)
	clients.EXPECT().ForResource(mock.Anything, mock.Anything).RunAndReturn(func(_ context.Context, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
		gvr.Version = "v1"
		return client.Resource(gvr).Namespace("default"), schema.GroupVersionKind{}, nil
	}).Maybe()
	factory := resources.NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Maybe()
	return factory
}

type resolveTestResult struct {
	result provisioning.ResourceResolveResult
	err    error
}

func callResourceResolver(t *testing.T, resolver *listConnector, ctx context.Context, path string) resolveTestResult {
	t.Helper()
	result, err := resolver.resolve(ctx, "default", "repo", []string{path})
	if err != nil {
		return resolveTestResult{err: err}
	}
	require.Len(t, result.Results, 1)
	require.Equal(t, path, result.Results[0].Path)
	return resolveTestResult{result: result.Results[0]}
}

func TestResourceResolverRejectsMismatchedCurrentIdentity(t *testing.T) {
	for _, mismatch := range []string{"namespace", "name"} {
		t.Run(mismatch, func(t *testing.T) {
			obj := lookupObject(t, "dashboard.grafana.app", "Dashboard", "target", "team/cpu.json", "folder")
			if mismatch == "namespace" {
				obj.SetNamespace("org-2")
			} else {
				obj.SetName("another-resource")
			}
			client := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
			client.PrependReactor("get", "dashboards", func(action clienttesting.Action) (bool, runtime.Object, error) {
				require.Equal(t, "default", action.GetNamespace())
				return true, obj, nil
			})
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "target", Path: "team/cpu.json"}}}, nil)
			responder := callResourceResolver(t, &listConnector{lister: lister, clients: lookupClientsForDynamic(t, client), access: auth.NewMockAccessChecker(t)}, listTestContext(identity.RoleViewer), "team/cpu.json")
			require.NoError(t, responder.err)
			require.Nil(t, responder.result.Resource)
		})
	}
}

func TestResourceResolverExactLookup(t *testing.T) {
	for _, resource := range []struct{ group, resource, kind, path string }{
		{"dashboard.grafana.app", "dashboards", "Dashboard", "team/cpu.json"},
		{"folder.grafana.app", "folders", "Folder", "team/nested/"},
		{"playlist.grafana.app", "playlists", "Playlist", "weekly.json"},
	} {
		for _, role := range []identity.RoleType{identity.RoleViewer, identity.RoleEditor, identity.RoleAdmin} {
			for _, allowed := range []bool{true, false} {
				t.Run(resource.resource+"/"+string(role)+"/"+map[bool]string{true: "allowed", false: "denied"}[allowed], func(t *testing.T) {
					obj := lookupObject(t, resource.group, resource.kind, "target", resource.path, "current-folder")
					item := provisioning.ResourceListItem{Group: resource.group, Resource: resource.resource, Name: "target", Path: resource.path, Folder: "stale-folder", Title: "Stale title"}
					lister := resources.NewMockResourceLister(t)
					lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{item, item, {Name: "sibling", Path: "another.json"}}}, nil)
					checks := 0
					access := auth.NewSessionAccessChecker(listAccessClient{check: func(_ context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
						checks++
						require.Equal(t, "user:reader", id.GetUID())
						require.Equal(t, authlib.CheckRequest{Namespace: "default", Group: resource.group, Resource: resource.resource, Name: "target", Verb: utils.VerbGet}, req)
						require.Equal(t, "current-folder", folder)
						return authlib.CheckResponse{Allowed: allowed}, nil
					}})
					connector := &listConnector{lister: lister, clients: lookupClients(t, obj), access: access}
					responder := callResourceResolver(t, connector, listTestContext(role), strings.TrimSuffix(resource.path, "/"))
					require.Equal(t, 1, checks)
					if !allowed {
						require.NoError(t, responder.err)
						require.Nil(t, responder.result.Resource)
						return
					}
					require.NoError(t, responder.err)
					require.Equal(t, &provisioning.ResourceListItem{Group: resource.group, Resource: resource.resource, Name: "target", Path: resource.path, Folder: "current-folder", Title: "Current title", Hash: "current-hash", Time: 1234}, responder.result.Resource)
				})
			}
		}
	}
}

func TestResourceResolverDoesNotResolveStaleObjects(t *testing.T) {
	for _, scenario := range []string{"missing", "moved", "reassigned", "deleted", "unsynced", "prefix-only", "ambiguous"} {
		t.Run(scenario, func(t *testing.T) {
			obj := lookupObject(t, "dashboard.grafana.app", "Dashboard", "target", "team/cpu.json", "folder")
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			items := make([]provisioning.ResourceListItem, 1, 2)
			items[0] = provisioning.ResourceListItem{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "target", Path: "team/cpu.json"}
			objects := make([]runtime.Object, 1, 2)
			objects[0] = obj
			switch scenario {
			case "missing":
				objects = objects[:0]
			case "moved":
				meta.SetSourceProperties(utils.SourceProperties{Path: "other/cpu.json"})
			case "reassigned":
				meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "another-repo"})
			case "deleted":
				now := metav1.Now()
				obj.SetDeletionTimestamp(&now)
			case "unsynced":
				items = items[:0]
			case "prefix-only":
				items[0].Path = "team/cpu.json/child"
			case "ambiguous":
				second := obj.DeepCopy()
				second.SetName("second")
				objects = append(objects, second)
				item := items[0]
				item.Name = "second"
				items = append(items, item)
			}
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: items}, nil)
			access := auth.NewMockAccessChecker(t)
			if scenario == "ambiguous" {
				access.EXPECT().Check(mock.Anything, mock.Anything, "folder").Return(nil).Twice()
			}
			responder := callResourceResolver(t, &listConnector{lister: lister, clients: lookupClients(t, objects...), access: access}, listTestContext(identity.RoleViewer), "team/cpu.json")
			require.NoError(t, responder.err)
			require.Nil(t, responder.result.Resource)
		})
	}
}

func TestResourceResolverHidesLookupFailureDetails(t *testing.T) {
	lister := resources.NewMockResourceLister(t)
	lister.EXPECT().List(mock.Anything, "default", "repo").Return(nil, errors.New("secret-resource-name"))
	responder := callResourceResolver(t, &listConnector{lister: lister}, listTestContext(identity.RoleViewer), "team/cpu.json")
	require.True(t, apierrors.IsInternalError(responder.err))
	require.NotContains(t, responder.err.Error(), "secret-resource-name")
}

func TestResourceResolverTokenIdentityLookup(t *testing.T) {
	for _, allowed := range []bool{true, false} {
		t.Run(map[bool]string{true: "allowed", false: "denied"}[allowed], func(t *testing.T) {
			caller := &identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "token-user", Namespace: "default"}
			ctx := request.WithNamespace(authlib.WithAuthInfo(context.Background(), caller), "default")
			obj := lookupObject(t, "folder.grafana.app", "Folder", "folder", "team", "parent")
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Group: "folder.grafana.app", Resource: "folders", Name: "folder", Path: "team"}}}, nil)
			access := auth.NewTokenAccessChecker(listAccessClient{check: func(_ context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				require.Same(t, caller, id)
				require.Equal(t, "folder", req.Name)
				require.Equal(t, "parent", folder)
				return authlib.CheckResponse{Allowed: allowed}, nil
			}})
			responder := callResourceResolver(t, &listConnector{lister: lister, clients: lookupClients(t, obj), access: access}, ctx, "team/")
			if allowed {
				require.NoError(t, responder.err)
				require.NotNil(t, responder.result.Resource)
			} else {
				require.NoError(t, responder.err)
				require.Nil(t, responder.result.Resource)
			}
		})
	}
}

func TestResourceResolverRejectsMalformedPathsBeforeListing(t *testing.T) {
	invalidPaths := []string{"", "/", "/folder", "//", "../x", "./x", ".", "a/../x", "a//b", "a\\b", "a\x00b", "%2e%2e/x", "a//", ".hidden"}
	cases := make([][]string, 0, 3+len(invalidPaths))
	cases = append(cases, nil, []string{}, make([]string, maxResourceResolvePaths+1))
	for _, path := range invalidPaths {
		cases = append(cases, []string{"valid.json", path})
	}
	for _, paths := range cases {
		t.Run(strings.Join(paths, ","), func(t *testing.T) {
			resolver := listConnector{lister: resources.NewMockResourceLister(t)}
			result, err := resolver.resolve(listTestContext(identity.RoleViewer), "default", "repo", paths)
			require.True(t, apierrors.IsBadRequest(err), "%v", err)
			require.Nil(t, result)
		})
	}
}

func TestResourceResolverBatch(t *testing.T) {
	paths := []string{"denied.json", "missing.json", "visible.json", "visible.json", "moved.json", "broken.json", "ambiguous.json", "folder/", "folder"}
	names := []string{"visible", "denied", "moved", "broken", "first", "second", "folder"}
	objects := make([]runtime.Object, 0, len(names))
	items := make([]provisioning.ResourceListItem, 0, len(names))
	for _, name := range names {
		group, resource, kind, path := "dashboard.grafana.app", "dashboards", "Dashboard", name+".json"
		if name == "first" || name == "second" {
			path = "ambiguous.json"
		}
		if name == "folder" {
			group, resource, kind, path = "folder.grafana.app", "folders", "Folder", "folder/"
		}
		obj := lookupObject(t, group, kind, name, path, "current-folder")
		if name == "moved" {
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetSourceProperties(utils.SourceProperties{Path: "somewhere-else.json"})
		}
		objects = append(objects, obj)
		items = append(items, provisioning.ResourceListItem{Group: group, Resource: resource, Name: name, Path: path})
	}
	client := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), objects...)
	client.PrependReactor("get", "dashboards", func(action clienttesting.Action) (bool, runtime.Object, error) {
		if action.(clienttesting.GetAction).GetName() == "broken" {
			return true, nil, errors.New("secret-object-error")
		}
		return false, nil, nil
	})
	access := auth.NewSessionAccessChecker(listAccessClient{check: func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
		return authlib.CheckResponse{Allowed: req.Name != "denied"}, nil
	}})
	lister := resources.NewMockResourceLister(t)
	lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: items}, nil).Once()
	resolver := listConnector{lister: lister, clients: lookupClientsForDynamic(t, client), access: access}
	result, err := resolver.resolve(listTestContext(identity.RoleViewer), "default", "repo", paths)
	require.NoError(t, err)
	require.Len(t, result.Results, 8)
	for i, path := range []string{"denied.json", "missing.json", "visible.json", "moved.json", "broken.json", "ambiguous.json", "folder/", "folder"} {
		require.Equal(t, path, result.Results[i].Path)
		if path == "visible.json" || strings.HasPrefix(path, "folder") {
			require.NotNil(t, result.Results[i].Resource)
		} else {
			require.Nil(t, result.Results[i].Resource)
			encoded, err := json.Marshal(result.Results[i])
			require.NoError(t, err)
			require.JSONEq(t, `{"path":"`+path+`"}`, string(encoded))
		}
	}
	require.Equal(t, "visible", result.Results[2].Resource.Name)
	require.Equal(t, "folder", result.Results[6].Resource.Name)
	require.Equal(t, result.Results[6].Resource, result.Results[7].Resource)
}

func TestResourceResolverBatchReusesDiscovery(t *testing.T) {
	responses := map[string][]byte{
		"/api":                           []byte(`{"kind":"APIVersions","apiVersion":"v1","versions":[]}`),
		"/apis":                          []byte(`{"kind":"APIGroupList","apiVersion":"v1","groups":[{"name":"dashboard.grafana.app","versions":[{"groupVersion":"dashboard.grafana.app/v1","version":"v1"}],"preferredVersion":{"groupVersion":"dashboard.grafana.app/v1","version":"v1"}}]}`),
		"/apis/dashboard.grafana.app/v1": []byte(`{"kind":"APIResourceList","apiVersion":"v1","groupVersion":"dashboard.grafana.app/v1","resources":[{"name":"dashboards","kind":"Dashboard","namespaced":true,"verbs":["get"]}]}`),
	}
	expectedRequests := map[string]int{
		"/api": 1, "/apis": 1, "/apis/dashboard.grafana.app/v1": 1,
	}
	names := []string{"cpu", "memory", "network", "disk", "requests"}
	paths := make([]string, 0, len(names))
	items := make([]provisioning.ResourceListItem, 0, len(names))
	for _, name := range names {
		path := name + ".json"
		obj := lookupObject(t, "dashboard.grafana.app", "Dashboard", name, path, "folder")
		body, err := json.Marshal(obj)
		require.NoError(t, err)
		endpoint := "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/" + name
		responses[endpoint] = body
		expectedRequests[endpoint] = 1
		paths = append(paths, path)
		items = append(items, provisioning.ResourceListItem{Group: "dashboard.grafana.app", Resource: "dashboards", Name: name, Path: path})
	}
	var requestsMu sync.Mutex
	requests := make(map[string]int)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestsMu.Lock()
		requests[r.URL.Path]++
		requestsMu.Unlock()
		body, ok := responses[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	t.Cleanup(server.Close)
	factory := resources.NewClientFactory(apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
		return &rest.Config{Host: server.URL}, nil
	}))
	lister := resources.NewMockResourceLister(t)
	lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: items}, nil).Once()
	access := auth.NewMockAccessChecker(t)
	access.EXPECT().Check(mock.Anything, mock.Anything, "folder").Return(nil).Times(len(names))
	resolver := listConnector{lister: lister, clients: factory, access: access}
	result, err := resolver.resolve(listTestContext(identity.RoleViewer), "default", "repo", paths)
	require.NoError(t, err)
	require.Len(t, result.Results, len(names))
	for i, name := range names {
		require.Equal(t, paths[i], result.Results[i].Path)
		require.NotNil(t, result.Results[i].Resource)
		require.Equal(t, name, result.Results[i].Resource.Name)
	}
	requestsMu.Lock()
	defer requestsMu.Unlock()
	require.Equal(t, expectedRequests, requests)
}

func callResolveHandler(t *testing.T, resolver *listConnector, ctx context.Context, namespace, body string) *httptest.ResponseRecorder {
	t.Helper()
	ctx = request.WithNamespace(ctx, namespace)
	req := httptest.NewRequest(http.MethodPost, "/apis/provisioning.grafana.app/v0alpha1/namespaces/"+namespace+"/repositories/repo/resources/resolve", strings.NewReader(body)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	connector := NewListConnector(resolver.lister, resolver.clients, resolver.access)
	responder := &testResponder{}
	handler, err := connector.Connect(ctx, "repo", nil, responder)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	require.NoError(t, responder.err)
	return recorder
}

func TestResourceResolverHidesClientInitializationFailureDetails(t *testing.T) {
	lister := resources.NewMockResourceLister(t)
	lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "cpu", Path: "cpu.json"},
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "memory", Path: "memory.json"},
	}}, nil).Once()
	factory := resources.NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(nil, errors.New("secret-client-configuration")).Once()
	resolver := &listConnector{lister: lister, clients: factory, access: auth.NewMockAccessChecker(t)}
	recorder := callResolveHandler(t, resolver, listTestContext(identity.RoleViewer), "default", `{"paths":["cpu.json","memory.json"]}`)
	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	require.Contains(t, recorder.Body.String(), "unable to resolve resources")
	require.NotContains(t, recorder.Body.String(), "secret-client-configuration")
}

func TestResourceResolverHandlerValidation(t *testing.T) {
	for _, body := range []string{"", "null", `{}`, `{"paths":null}`, `{"paths":[]}`, `{"paths":[null]}`, `{"paths":["/"]}`, `{"paths":["valid.json","../hidden"]}`, `{"paths":"file.json"}`, `{"paths":["file.json"],"unknown":true}`, `{"paths":["file.json"]} {}`, `{"paths":["file.json"]}]`, `{"paths":["file.json"]}}`} {
		t.Run(body, func(t *testing.T) {
			recorder := callResolveHandler(t, &listConnector{lister: resources.NewMockResourceLister(t)}, listTestContext(identity.RoleViewer), "default", body)
			require.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
	t.Run("missing identity", func(t *testing.T) {
		recorder := callResolveHandler(t, &listConnector{}, context.Background(), "default", `{"paths":["file.json"]}`)
		require.Equal(t, http.StatusUnauthorized, recorder.Code)
	})
	for _, namespace := range []string{"", "org-2"} {
		t.Run("namespace="+namespace, func(t *testing.T) {
			recorder := callResolveHandler(t, &listConnector{}, listTestContext(identity.RoleAdmin), namespace, `{"paths":["file.json"]}`)
			require.Equal(t, http.StatusForbidden, recorder.Code)
		})
	}
}

func TestResourceResolverServiceIdentity(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	obj := lookupObject(t, "dashboard.grafana.app", "Dashboard", "target", "cpu.json", "folder")
	lister := resources.NewMockResourceLister(t)
	lister.EXPECT().List(mock.Anything, "default", "repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "target", Path: "cpu.json"}}}, nil).Once()
	resolver := &listConnector{lister: lister, clients: lookupClients(t, obj), access: auth.NewMockAccessChecker(t)}
	recorder := callResolveHandler(t, resolver, ctx, "default", `{"paths":["cpu.json"]}`)
	require.Equal(t, http.StatusOK, recorder.Code)
	var result provisioning.ResourceResolveResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &result))
	require.Len(t, result.Results, 1)
	require.Equal(t, "target", result.Results[0].Resource.Name)
}

func TestResourceResolveOpenAPI(t *testing.T) {
	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run(version, func(t *testing.T) {
			gv := schema.GroupVersion{Group: provisioning.GROUP, Version: version}
			prefix := strings.Replace(provisioning.OpenAPIPrefix, provisioning.VERSION, version, 1)
			b := &APIBuilder{gv: gv}
			for _, route := range b.GetAPIRoutes(gv).Namespace {
				require.NotEqual(t, "repositories/{name}/resources/resolve", route.Path)
			}

			path := "/apis/" + gv.String() + "/namespaces/{namespace}/repositories/{name}/resources"
			get := &spec3.Operation{OperationProps: spec3.OperationProps{
				OperationId: "getRepositoryResources",
				Description: "Existing resource list",
				Parameters:  []*spec3.Parameter{{ParameterProps: spec3.ParameterProps{Name: "existing", In: "query", Schema: spec.StringProperty()}}},
				Responses:   getJSONResponse("#/components/schemas/" + prefix + "ResourceList"),
			}}
			originalGet, err := json.Marshal(get)
			require.NoError(t, err)
			oas := &spec3.OpenAPI{
				Info: &spec.Info{},
				Paths: &spec3.Paths{Paths: map[string]*spec3.Path{
					path:             {PathProps: spec3.PathProps{Get: get, Post: &spec3.Operation{}}},
					path + "/{path}": {PathProps: spec3.PathProps{Get: &spec3.Operation{}, Post: &spec3.Operation{}}},
				}},
				Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
			}
			result, err := b.PostProcessOpenAPI(oas)
			require.NoError(t, err)
			updatedGet, err := json.Marshal(result.Paths.Paths[path].Get)
			require.NoError(t, err)
			require.JSONEq(t, string(originalGet), string(updatedGet))
			require.Nil(t, result.Paths.Paths[path].Post)
			require.NotContains(t, result.Paths.Paths, path+"/{path}")

			resolve := result.Paths.Paths[path+"/resolve"]
			require.NotNil(t, resolve)
			require.Nil(t, resolve.Get)
			require.Nil(t, resolve.Put)
			require.Nil(t, resolve.Patch)
			require.Nil(t, resolve.Delete)
			require.NotNil(t, resolve.Post)
			require.Equal(t, "resolveRepositoryResources", resolve.Post.OperationId)
			require.Equal(t, []string{"Provisioning", "Repository"}, resolve.Post.Tags)
			require.Len(t, resolve.Post.Parameters, 2)
			for i, name := range []string{"namespace", "name"} {
				require.Equal(t, name, resolve.Post.Parameters[i].Name)
				require.Equal(t, "path", resolve.Post.Parameters[i].In)
				require.True(t, resolve.Post.Parameters[i].Required)
			}
			require.True(t, resolve.Post.RequestBody.Required)
			require.Equal(t, "#/components/schemas/"+prefix+"ResourceResolveRequest", resolve.Post.RequestBody.Content["application/json"].Schema.Ref.String())
			require.Equal(t, "#/components/schemas/"+prefix+"ResourceResolveResponse", resolve.Post.Responses.StatusCodeResponses[http.StatusOK].Content["application/json"].Schema.Ref.String())

			requestSchema := result.Components.Schemas[prefix+"ResourceResolveRequest"]
			require.NotNil(t, requestSchema)
			require.Equal(t, []string{"paths"}, requestSchema.Required)
			require.EqualValues(t, 1, *requestSchema.Properties["paths"].MinItems)
			require.EqualValues(t, 100, *requestSchema.Properties["paths"].MaxItems)
			require.Equal(t, "#/components/schemas/"+prefix+"ResourceResolveResult", result.Components.Schemas[prefix+"ResourceResolveResponse"].Properties["results"].Items.Schema.Ref.String())
			resourceSchema := result.Components.Schemas[prefix+"ResourceResolveResult"].Properties["resource"]
			require.Equal(t, "#/components/schemas/"+prefix+"ResourceListItem", resourceSchema.Ref.String())
		})
	}
}
