package router

import (
	"context"
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

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	sdkbackend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// pluginManifestsFixture is a minimal instance of the response shape a real
// plugin-manifests operator emits at GET /plugins -- the
// {"key","plugins":[{"definition":{"jsonData","manifest"},"host"}]} envelope
// definition.PluginDeployments describes, confirmed against a live
// deployment (an earlier check against a stale pinned image wrongly found a
// bare-array mismatch; a fresher image returns exactly this shape).
const pluginManifestsFixture = `{
	"key": "2026-09-16T01:31:44Z",
	"plugins": [
		{
			"definition": {
				"jsonData": {"id": "grafana-appsdktest-app", "type": "app", "name": "Test App"},
				"manifest": {
					"appName": "grafana-appsdktest-app",
					"group": "appsdktest.ext.grafana.app",
					"versions": [{"name": "v1alpha1", "served": true}],
					"preferredVersion": "v1alpha1"
				}
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
	require.NotNil(t, first.Definition.Manifest)
	require.Equal(t, "appsdktest.ext.grafana.app", first.Definition.Manifest.Group)
	require.Equal(t, "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051", first.Host)

	second := deployment.Plugins[1]
	require.Equal(t, "no-manifest-plugin", second.Definition.JSONData.ID)
	require.Nil(t, second.Definition.Manifest)
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
	require.Contains(t, backends[0].Key(), "plugins_url:grafana-appsdktest-app:")
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
		legacy, client, err := plugin.client(t.Context(), plugin.plugin.JSONData.ID)
		require.NoError(t, err)
		require.NotNil(t, legacy)
		require.NotNil(t, client)

		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		defer cancel()
		health, err := legacy.CheckHealth(ctx, &sdkbackend.CheckHealthRequest{
			PluginContext: sdkbackend.PluginContext{PluginID: plugin.plugin.JSONData.ID},
		})
		require.NoError(t, err)
		require.Equal(t, sdkbackend.HealthStatusOk, health.Status)
		require.Equal(t, plugin.plugin.JSONData.ID, health.Message)
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
		_, _, err = plugin.client(t.Context(), plugin.plugin.JSONData.ID)
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

func TestPluginManifestsTargetRejectsEmptyHost(t *testing.T) {
	target := &pluginManifestsTarget{}
	_, _, err := target.pluginClients("")
	require.ErrorContains(t, err, "host is empty")
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
