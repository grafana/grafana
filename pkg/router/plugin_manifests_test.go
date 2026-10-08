package router

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	sdkbackend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const pluginManifestsFixture = `{
	"key": "2026-09-16T01:31:44Z",
	"plugins": [
		{
			"definition": {
				"jsonData": {"id": "grafana-appsdktest-app", "type": "app", "name": "Test App"},
				"manifests": [{
					"appName": "grafana-appsdktest-app",
					"group": "appsdktest.ext.grafana.app",
					"versions": [{"name": "v1alpha1", "served": true}],
					"preferredVersion": "v1alpha1"
				}]
			},
			"host": "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051"
		},
		{
			"definition": {
				"jsonData": {"id": "no-manifest-plugin", "type": "app", "name": "No Manifest"}
			}
		}
	]
}`

func TestFetchPluginManifests_DecodesDeploymentsEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	deployment, err := fetchPluginManifests(t.Context(), srv.Client(), srv.URL)
	require.NoError(t, err)
	require.Equal(t, "2026-09-16T01:31:44Z", deployment.Key)
	require.Len(t, deployment.Plugins, 2)

	first := deployment.Plugins[0]
	require.Equal(t, "grafana-appsdktest-app", first.Definition.JSONData.ID)
	require.Len(t, first.Definition.Manifests, 1)
	require.Equal(t, "appsdktest.ext.grafana.app", first.Definition.Manifests[0].Group)
	require.Equal(t, "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051", first.Host)

	second := deployment.Plugins[1]
	require.Equal(t, "no-manifest-plugin", second.Definition.JSONData.ID)
	require.Empty(t, second.Definition.Manifests)
}

func TestPluginManifestsTarget_PollsFiltersAndSkipsEntriesWithoutManifest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)
	defer cancel()

	require.Eventually(t, func() bool {
		return len(target.Backends()) == 1
	}, 2*time.Second, 10*time.Millisecond)

	backends := target.Backends()
	require.Equal(t, "appsdktest.ext.grafana.app", backends[0].Group().Name)
	require.Contains(t, backends[0].Key(), "managed:grafana-appsdktest-app:")
}

func TestPluginManifestsTarget_GroupRegexNarrowsToMatchingGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	patterns, err := compileGroupPatterns([]string{"*.internal"})
	require.NoError(t, err)

	target, err := newPluginManifestsTarget(srv.URL, patterns, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	target.poll(t.Context(), make(chan struct{}, 1))
	require.Empty(t, target.Backends(), "appsdktest.ext.grafana.app must not match *.internal")
}

func TestPluginManifestsTarget_SignalsDirtyOnlyOnKeySetChange(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	ctx := t.Context()
	dirty := make(chan struct{}, 1)

	target.poll(ctx, dirty)
	require.Len(t, target.Backends(), 1)
	select {
	case <-dirty:
	default:
		t.Fatal("expected dirty to be signaled on the first poll (empty -> non-empty key set)")
	}

	target.poll(ctx, dirty)
	require.Len(t, target.Backends(), 1)
	select {
	case <-dirty:
		t.Fatal("dirty must not be signaled when the discovered key set is unchanged")
	default:
	}
}

func TestPluginManifestsTarget_FailedPollLeavesLastKnownGoodSnapshot(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	// Seed a snapshot as if a previous poll had succeeded, then confirm a
	// failed poll doesn't clear it -- same last-known-good invariant as
	// aggregateTarget.
	seeded := []Backend{&pluginDeploymentBackend{key: "seeded"}}
	target.snapshot.Store(&seeded)

	target.poll(t.Context(), make(chan struct{}, 1))
	require.Equal(t, seeded, target.Backends())
}

func TestNewPluginManifestsTarget_RejectsNonAbsoluteURL(t *testing.T) {
	for _, badURL := range []string{"", "/just/a/path", "plugins.example.invalid"} {
		t.Run(badURL, func(t *testing.T) {
			_, err := newPluginManifestsTarget(badURL, nil, http.DefaultClient, PluginDependencies{})
			require.ErrorContains(t, err, "must be absolute")
		})
	}
}

func TestPluginManifestsTargetReloadsOnHostChange(t *testing.T) {
	body := pluginManifestsFixture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)
	dirty := make(chan struct{}, 1)
	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	first := target.Backends()[0]
	<-dirty
	body = strings.ReplaceAll(body, "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051", "replacement:50051")
	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	second := target.Backends()[0]
	require.NotEqual(t, first.Key(), second.Key())
	require.Len(t, dirty, 1)
}

func TestPluginManifestsTargetRemoteClient(t *testing.T) {
	body := pluginManifestsFixture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)
	t.Cleanup(target.closeConnections)

	for range 2 {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		require.NoError(t, err)
		server := grpc.NewServer()
		backend := &manifestTestPluginServer{calls: make(chan string, 3)}
		pluginv3.RegisterAdmissionServiceServer(server, backend)
		pluginv3.RegisterConversionServiceServer(server, backend)
		pluginv3.RegisterRouteServiceServer(server, backend)
		legacyBackend := &manifestTestLegacyPluginServer{}
		pluginv2.RegisterDiagnosticsServer(server, legacyBackend)
		pluginv2.RegisterResourceServer(server, legacyBackend)
		go func() { _ = server.Serve(listener) }()
		t.Cleanup(server.Stop)

		host := listener.Addr().String()
		body = strings.ReplaceAll(pluginManifestsFixture, "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051", host)
		target.poll(t.Context(), make(chan struct{}, 1))
		require.Len(t, target.Backends(), 1)
		plugin := target.Backends()[0].(*pluginDeploymentBackend).Backend.(*PluginBackend)
		legacy, client, err := plugin.client(t.Context(), plugin.pluginID)
		require.NoError(t, err)
		require.NotNil(t, legacy)
		require.NotNil(t, client)

		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		defer cancel()
		health, err := legacy.CheckHealth(ctx, &sdkbackend.CheckHealthRequest{
			PluginContext: sdkbackend.PluginContext{PluginID: plugin.pluginID},
		})
		require.NoError(t, err)
		require.Equal(t, sdkbackend.HealthStatusOk, health.Status)
		require.Equal(t, plugin.pluginID, health.Message)
		var responses []*sdkbackend.CallResourceResponse
		err = legacy.CallResource(ctx, &sdkbackend.CallResourceRequest{
			Path: "test-resource",
			Body: []byte("request body"),
		}, sdkbackend.CallResourceResponseSenderFunc(func(response *sdkbackend.CallResourceResponse) error {
			responses = append(responses, response)
			return nil
		}))
		require.NoError(t, err)
		require.Len(t, responses, 2)
		require.Equal(t, http.StatusOK, responses[0].Status)
		require.Equal(t, []byte("test-resource"), responses[0].Body)
		require.Equal(t, []byte("request body"), responses[1].Body)

		_, err = client.AdmissionReview(ctx, &pluginv3.AdmissionReviewRequest{})
		require.NoError(t, err)
		_, err = client.ConvertObjects(ctx, &pluginv3.ConvertObjectsRequest{})
		require.NoError(t, err)
		stream, err := client.CallRoute(ctx, &pluginv3.CallRouteRequest{})
		require.NoError(t, err)
		_, err = stream.Recv()
		require.NoError(t, err)
		_, err = stream.Recv()
		require.ErrorIs(t, err, io.EOF)
		require.Equal(t, "admission", <-backend.calls)
		require.Equal(t, "conversion", <-backend.calls)
		require.Equal(t, "route", <-backend.calls)

		conn := target.connections[host]
		target.poll(t.Context(), make(chan struct{}, 1))
		plugin = target.Backends()[0].(*pluginDeploymentBackend).Backend.(*PluginBackend)
		_, _, err = plugin.client(t.Context(), plugin.pluginID)
		require.NoError(t, err)
		require.Same(t, conn, target.connections[host])
	}

	connections := target.connections
	target.closeConnections()
	for _, conn := range connections {
		require.Equal(t, connectivity.Shutdown, conn.GetState())
	}
	_, _, err = target.pluginClients("localhost:50051")
	require.ErrorContains(t, err, "closed")
}

func TestPluginManifestsTargetWithoutBackendClient(t *testing.T) {
	target := &pluginManifestsTarget{}
	clientV2, clientV3, err := target.pluginClients("")
	require.NoError(t, err)
	require.Nil(t, clientV2)
	require.Nil(t, clientV3)
	require.Empty(t, target.connections)
}

type manifestTestPluginServer struct {
	pluginv3.UnimplementedAdmissionServiceServer
	pluginv3.UnimplementedConversionServiceServer
	pluginv3.UnimplementedRouteServiceServer
	calls chan string
}

func (s *manifestTestPluginServer) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	s.calls <- "admission"
	return &pluginv3.AdmissionReviewResponse{}, nil
}

func (s *manifestTestPluginServer) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	s.calls <- "conversion"
	return &pluginv3.ConvertObjectsResponse{}, nil
}

func (s *manifestTestPluginServer) CallRoute(_ *pluginv3.CallRouteRequest, stream grpc.ServerStreamingServer[pluginv3.CallRouteResponse]) error {
	s.calls <- "route"
	return stream.Send(&pluginv3.CallRouteResponse{})
}

type manifestTestLegacyPluginServer struct {
	pluginv2.UnimplementedDiagnosticsServer
	pluginv2.UnimplementedResourceServer
}

func (s *manifestTestLegacyPluginServer) CheckHealth(_ context.Context, req *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	return &pluginv2.CheckHealthResponse{
		Status:  pluginv2.CheckHealthResponse_OK,
		Message: req.PluginContext.PluginId,
	}, nil
}

func (s *manifestTestLegacyPluginServer) CallResource(req *pluginv2.CallResourceRequest, stream pluginv2.Resource_CallResourceServer) error {
	if err := stream.Send(&pluginv2.CallResourceResponse{Code: http.StatusOK, Body: []byte(req.Path)}); err != nil {
		return err
	}
	return stream.Send(&pluginv2.CallResourceResponse{Body: req.Body})
}

func TestPluginManifestsTargetServesKindsWithoutBackendClient(t *testing.T) {
	var deployment definition.PluginDeployments
	require.NoError(t, json.Unmarshal([]byte(pluginManifestsFixture), &deployment))
	entry := &deployment.Plugins[0]
	entry.Host = ""
	folderScoped := false
	entry.Definition.Manifests[0].Versions[0].Kinds = []app.ManifestVersionKind{{
		Kind: "Thing", Plural: "things", Scope: "Namespaced", FolderScoped: &folderScoped,
	}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(deployment))
	}))
	defer srv.Close()
	storage := &manifestKindResourceClient{}
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{Unified: storage})
	require.NoError(t, err)
	target.poll(t.Context(), make(chan struct{}, 1))
	require.Len(t, target.Backends(), 1)
	handler, err := target.Backends()[0].Load(t.Context())
	require.NoError(t, err)
	t.Cleanup(handler.(interface{ Destroy() }).Destroy)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := newAuthenticatedRequest(method, path, strings.NewReader(body))
		req.Header.Set("X-Access-Token", "test-token")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	root := "/apis/appsdktest.ext.grafana.app/v1alpha1"
	res := request(http.MethodGet, root, "")
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var discovery metav1.APIResourceList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &discovery))
	require.Len(t, discovery.APIResources, 1)
	require.Equal(t, "Thing", discovery.APIResources[0].Kind)
	require.Equal(t, "things", discovery.APIResources[0].Name)
	root += "/namespaces/default/things"
	res = request(http.MethodPost, root, `{"apiVersion":"appsdktest.ext.grafana.app/v1alpha1","kind":"Thing","metadata":{"name":"example"}}`)
	require.Equal(t, http.StatusCreated, res.Code, res.Body.String())
	require.NotNil(t, storage.created)
	require.Equal(t, "things", storage.created.Key.Resource)
	res = request(http.MethodGet, root+"/example", "")
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.Contains(t, res.Body.String(), `"name":"example"`)
	res = request(http.MethodGet, root+"/example/reload", "")
	require.Equal(t, http.StatusNotFound, res.Code, res.Body.String())
	require.Empty(t, target.connections)

	for _, tc := range []struct {
		name         string
		capabilities *app.AdmissionCapabilities
	}{
		{"mutation", &app.AdmissionCapabilities{Mutation: &app.MutationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationCreate}}}},
		{"validation", &app.AdmissionCapabilities{Validation: &app.ValidationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationCreate}}}},
	} {
		t.Run(tc.name+" requires a backend client", func(t *testing.T) {
			entry.Definition.Manifests[0].Versions[0].Kinds[0].Admission = tc.capabilities
			target.poll(t.Context(), make(chan struct{}, 1))
			require.Len(t, target.Backends(), 1)
			_, err := target.Backends()[0].Load(t.Context())
			require.ErrorContains(t, err, "declares admission capabilities but has no plugin client")
		})
	}
}

type manifestKindResourceClient struct {
	resource.ResourceClient
	created *resourcepb.CreateRequest
}

func (c *manifestKindResourceClient) Create(_ context.Context, req *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.created = req
	return &resourcepb.CreateResponse{ResourceVersion: 1}, nil
}

func (c *manifestKindResourceClient) Read(_ context.Context, _ *resourcepb.ReadRequest, _ ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return &resourcepb.ReadResponse{ResourceVersion: 1, Value: c.created.Value}, nil
}

func TestPluginManifestsTargetMultipleManifests(t *testing.T) {
	var deployment definition.PluginDeployments
	require.NoError(t, json.Unmarshal([]byte(pluginManifestsFixture), &deployment))
	first := deployment.Plugins[0].Definition.Manifests[0]
	second := *first
	second.Group = "second.ext.grafana.app"
	deployment.Plugins[0].Definition.Manifests = []*app.ManifestData{
		first, nil, {Group: "dashboard.grafana.app"}, &second,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(deployment))
	}))
	defer srv.Close()
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)
	dirty := make(chan struct{}, 1)
	target.poll(t.Context(), dirty)
	backends := target.Backends()
	require.Len(t, backends, 2)
	require.Equal(t, first.Group, backends[0].Group().Name)
	require.Equal(t, second.Group, backends[1].Group().Name)
	require.NotEqual(t, backends[0].Key(), backends[1].Key())
	require.Len(t, dirty, 1)
	<-dirty
	target.poll(t.Context(), dirty)
	require.Empty(t, dirty)
	second.Versions = append(append([]app.ManifestVersion(nil), second.Versions...), app.ManifestVersion{Name: "v2", Served: true})
	target.poll(t.Context(), dirty)
	updated := target.Backends()
	require.Equal(t, backends[0].Key(), updated[0].Key(), "a sibling change must preserve this group's handler and watches")
	require.NotEqual(t, backends[1].Key(), updated[1].Key())

	deployment.Plugins[0].Definition.JSONData.Info.Version = "2"
	target.poll(t.Context(), dirty)
	for i, backend := range target.Backends() {
		require.NotEqual(t, updated[i].Key(), backend.Key(), "shared metadata changes affect every group")
		require.Equal(t, "2", backend.(*pluginDeploymentBackend).Backend.(*PluginBackend).info.Version)
	}
}

func TestFetchPluginManifestsMigratesSingularManifest(t *testing.T) {
	var payload map[string]any
	require.NoError(t, json.Unmarshal([]byte(pluginManifestsFixture), &payload))
	plugin := payload["plugins"].([]any)[0].(map[string]any)["definition"].(map[string]any)
	plugin["manifest"] = plugin["manifests"].([]any)[0]
	delete(plugin, "manifests")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(payload))
	}))
	defer srv.Close()
	deployment, err := fetchPluginManifests(t.Context(), srv.Client(), srv.URL)
	require.NoError(t, err)
	require.Len(t, deployment.Plugins[0].Definition.Manifests, 1)
	require.Equal(t, "appsdktest.ext.grafana.app", deployment.Plugins[0].Definition.Manifests[0].Group)
	require.Nil(t, deployment.Plugins[0].Definition.Manifest) //nolint:staticcheck

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)
	target.poll(t.Context(), make(chan struct{}, 1))
	require.Len(t, target.Backends(), 1)
}

func TestFetchPluginManifestsPrefersPluralEntry(t *testing.T) {
	var payload map[string]any
	require.NoError(t, json.Unmarshal([]byte(pluginManifestsFixture), &payload))
	plugin := payload["plugins"].([]any)[0].(map[string]any)["definition"].(map[string]any)
	current := plugin["manifests"].([]any)[0].(map[string]any)
	legacy := map[string]any{}
	for key, value := range current {
		legacy[key] = value
	}
	legacy["versions"] = []any{map[string]any{"name": "v0alpha1", "served": true}}
	plugin["manifest"] = legacy
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(payload))
	}))
	defer srv.Close()
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)
	target.poll(t.Context(), make(chan struct{}, 1))
	backends := target.Backends()
	require.Len(t, backends, 1)
	require.Equal(t, "v1alpha1", backends[0].Group().Versions[0].Version)
}
