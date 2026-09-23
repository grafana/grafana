package router

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	sdkbackend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiserverauthenticator "github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
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

	authenticator := manifestTokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
		return &identity.StaticRequester{UserUID: "test-user"}, nil
	})
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{}, &authenticator)
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
	require.Same(t, &authenticator, backends[0].(*pluginDeploymentBackend).authn)
}

type manifestTokenAuthenticatorFunc func(context.Context, string) (identity.Requester, error)

func (f manifestTokenAuthenticatorFunc) AuthenticateToken(ctx context.Context, token string) (identity.Requester, error) {
	return f(ctx, token)
}

type manifestHandlerBackend struct {
	Backend
	handler http.Handler
}

func (b manifestHandlerBackend) Load(context.Context) (http.Handler, error) {
	return b.handler, nil
}

func TestPluginDeploymentBackendAuthentication(t *testing.T) {
	const token = "Bearer obo-token"
	info := &identity.StaticRequester{Type: types.TypeUser, UserUID: "test-user", Namespace: "stacks-123"}
	authCalls, handlerCalls := 0, 0
	req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(t.Context())
	req.Header.Set("X-Access-Token", token)
	backend := &pluginDeploymentBackend{
		Backend: manifestHandlerBackend{handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handlerCalls++
			got, ok := types.AuthInfoFrom(r.Context())
			require.True(t, ok)
			require.Same(t, info, got)
			authenticated, accepted, err := apiserverauthenticator.NewAuthenticator().AuthenticateRequest(r)
			require.NoError(t, err)
			require.True(t, accepted)
			require.Same(t, info, authenticated.User)
			require.Equal(t, req.URL, r.URL)
			w.WriteHeader(http.StatusNoContent)
		})},
		authn: manifestTokenAuthenticatorFunc(func(ctx context.Context, got string) (identity.Requester, error) {
			authCalls++
			require.Equal(t, 1, authCalls, "authentication must not recurse")
			require.Equal(t, token, got)
			require.Equal(t, req.Context(), ctx)
			return info, nil
		}),
	}
	handler, err := backend.Load(t.Context())
	require.NoError(t, err)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	require.Equal(t, http.StatusNoContent, response.Code)
	require.Equal(t, 1, authCalls)
	require.Equal(t, 1, handlerCalls)
	_, ok := types.AuthInfoFrom(req.Context())
	require.False(t, ok, "original request must not be mutated")
}

func TestAuthenticatingWrapperRejectsMissingAccessToken(t *testing.T) {
	for _, header := range []string{"", "Authorization"} {
		t.Run("header="+header, func(t *testing.T) {
			wrapper := &authenticatingWrapper{
				Handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
					t.Fatal("handler must not run without an access token")
				}),
				authn: manifestTokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
					t.Fatal("authenticator must not run without an access token")
					return nil, nil
				}),
			}
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if header != "" {
				req.Header.Set(header, "Bearer obo-token")
			}
			response := httptest.NewRecorder()
			wrapper.ServeHTTP(response, req)
			require.Equal(t, http.StatusUnauthorized, response.Code)
			require.Contains(t, response.Body.String(), "missing access token header")
		})
	}
}

func TestAuthenticatingWrapperRejectsAuthenticationError(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		status int
	}{
		{name: "unauthorized", err: apierrors.NewUnauthorized("invalid token"), status: http.StatusUnauthorized},
		{name: "internal", err: errors.New("authentication unavailable"), status: http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			authCalls := 0
			wrapper := &authenticatingWrapper{
				Handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
					t.Fatal("handler must not run after authentication fails")
				}),
				authn: manifestTokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
					authCalls++
					return nil, tc.err
				}),
			}
			response := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("X-Access-Token", "Bearer invalid-token")
			wrapper.ServeHTTP(response, req)
			require.Equal(t, tc.status, response.Code)
			require.Equal(t, 1, authCalls)
		})
	}
}

func TestPluginDeploymentBackendLoadErrors(t *testing.T) {
	backend := &pluginDeploymentBackend{}
	_, err := backend.Load(t.Context())
	require.ErrorContains(t, err, "requires a token authenticator")
	backend.authn = manifestTokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
		return nil, apierrors.NewUnauthorized("invalid token")
	})
	backend.Backend = failingBackend{}
	_, err = backend.Load(t.Context())
	require.ErrorContains(t, err, "load failed")
}

func TestPluginManifestsTarget_GroupRegexNarrowsToMatchingGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	patterns, err := compileGroupPatterns([]string{"*.internal"})
	require.NoError(t, err)

	target, err := newPluginManifestsTarget(srv.URL, patterns, srv.Client(), PluginDependencies{}, nil)
	require.NoError(t, err)

	target.poll(t.Context(), make(chan struct{}, 1))
	require.Empty(t, target.Backends(), "appsdktest.ext.grafana.app must not match *.internal")
}

func TestPluginManifestsTarget_SignalsDirtyOnlyOnKeySetChange(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{}, nil)
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

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{}, nil)
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
			_, err := newPluginManifestsTarget(badURL, nil, http.DefaultClient, PluginDependencies{}, nil)
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
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{}, nil)
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
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{}, nil)
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
