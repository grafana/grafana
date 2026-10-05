package pluginroute

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	secretv1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/plugins/definition"
	apiserverauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func examplePlugin(t *testing.T) definition.PluginDefinition {
	t.Helper()
	path := os.Getenv("PLUGIN_ROUTE_TEST_MANIFEST")
	if path == "" {
		path = "testdata/appsdktest-manifest.json"
	}
	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	manifest, err := definition.ParseManifest(raw)
	require.NoError(t, err)
	plugin := testPlugin()
	plugin.JSONData.ID = "example-appsdktest-app"
	plugin.Manifest = manifest
	// Exercise only the new declarations, without the deprecated route copies.
	for i := range plugin.Manifest.Versions {
		plugin.Manifest.Versions[i].Routes.Cluster = nil
		plugin.Manifest.Versions[i].Routes.Namespaced = nil
		for j := range plugin.Manifest.Versions[i].Kinds {
			plugin.Manifest.Versions[i].Kinds[j].Routes = nil
		}
	}
	return plugin
}

type recordingRouteClient struct {
	stubClientV3
	calls []*pluginv3.CallRouteRequest
}

func (c *recordingRouteClient) CallRoute(_ context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.calls = append(c.calls, req)
	return nil, errStubRoute
}

func TestExampleOpenAPIRoutes(t *testing.T) {
	plugin := examplePlugin(t)
	client := &recordingRouteClient{}
	opts := allowAll(testOptions())
	opts.ClientV3 = client
	var attrs []authorizer.Attributes
	opts.RouteAuthorizer = authorizer.AuthorizerFunc(func(_ context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
		attrs = append(attrs, a)
		return authorizer.DecisionAllow, "", nil
	})
	handler := withRequester(loadHandler(t, plugin, opts))
	root := "/apis/appsdktest.ext.grafana.app/v1alpha1"
	for _, path := range []string{"/foo", "/namespaces/default/bar", "/namespaces/default/apitest", "/namespaces/default/apitestjob"} {
		res := get(t, handler, root+path+"?input=hello")
		require.Contains(t, res.Body.String(), errStubRoute.Error())
		req := client.calls[len(client.calls)-1]
		require.Equal(t, plugin.Manifest.Group, req.GetGroup())
		require.Equal(t, "v1alpha1", req.GetVersion())
		require.Contains(t, req.GetUrl(), "?input=hello")
	}
	require.Len(t, attrs, 1)
	require.Equal(t, "create", attrs[0].GetVerb())
	require.Equal(t, "testresources", attrs[0].GetResource())
	require.Equal(t, "default", attrs[0].GetNamespace())
	require.Empty(t, client.calls[0].GetNamespace())
	require.Equal(t, "foo", client.calls[0].GetPath())
	require.Equal(t, "default", client.calls[1].GetNamespace())
	require.Equal(t, "bar", client.calls[1].GetPath())
	require.Equal(t, http.StatusNotFound, get(t, handler, "/apis/appsdktest.ext.grafana.app/v2alpha1/foo").Code)
}

func TestExampleRouteAuthorization(t *testing.T) {
	for _, tc := range []struct {
		name                               string
		decision                           authorizer.Decision
		err                                error
		missing, anonymous, noPluginAccess bool
		status                             int
	}{
		{name: "denied", decision: authorizer.DecisionDeny, status: 403},
		{name: "no opinion", decision: authorizer.DecisionNoOpinion, status: 403},
		{name: "error", decision: authorizer.DecisionAllow, err: errors.New("check failed"), status: 500},
		{name: "missing authorizer", missing: true, status: 503},
		{name: "anonymous", anonymous: true, status: 401},
		{name: "no plugin access", noPluginAccess: true, status: 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &recordingRouteClient{}
			opts := allowAll(testOptions())
			opts.ClientV3 = client
			if tc.noPluginAccess {
				opts.AccessChecker = nil
			}
			if !tc.missing {
				opts.RouteAuthorizer = authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
					return tc.decision, "test", tc.err
				})
			}
			handler := loadHandler(t, examplePlugin(t), opts)
			if !tc.anonymous {
				handler = withRequester(handler)
			}
			res := get(t, handler, "/apis/appsdktest.ext.grafana.app/v1alpha1/foo")
			require.Equal(t, tc.status, res.Code, res.Body.String())
			require.Empty(t, client.calls)
		})
	}
}

type parentRouteStore struct {
	resourceClient
	failure error
	reads   int
}

func (s *parentRouteStore) Read(ctx context.Context, req *resourcepb.ReadRequest, opts ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	s.reads++
	if s.failure != nil {
		return nil, s.failure
	}
	return s.resourceClient.Read(ctx, req, opts...)
}

type routeDecrypter func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error)

func (d routeDecrypter) Decrypt(ctx context.Context, g, n string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return d(ctx, g, n, names...)
}

func TestExampleRouteParent(t *testing.T) {
	for _, failure := range []string{"", "read", "decrypt"} {
		t.Run("failure="+failure, func(t *testing.T) {
			client := &recordingRouteClient{}
			store := &parentRouteStore{}
			store.created = &resourcepb.CreateRequest{Value: []byte(`{"apiVersion":"appsdktest.ext.grafana.app/v1alpha1","kind":"TestResource","metadata":{"name":"example","namespace":"default","uid":"abc","resourceVersion":"1"},"spec":{"title":"hello","description":"test","dummy":"ok"},"secure":{"token":{"name":"secret-token"}}}`)}
			if failure == "read" {
				store.failure = apierrors.NewNotFound(schema.GroupResource{Group: "appsdktest.ext.grafana.app", Resource: "testresources"}, "example")
			}
			decryptCalls := 0
			opts := allowAll(testOptions())
			opts.ClientV3 = client
			opts.Storage = UnifiedStorage(store, nil, nil)
			opts.Decrypter = routeDecrypter(func(_ context.Context, g, n string, names ...string) (map[string]decrypt.DecryptResult, error) {
				decryptCalls++
				require.Equal(t, "appsdktest.ext.grafana.app", g)
				require.Equal(t, "default", n)
				require.Equal(t, []string{"secret-token"}, names)
				if failure == "decrypt" {
					return nil, errors.New("decrypt failed")
				}
				value := secretv1.NewExposedSecureValue("plaintext")
				return map[string]decrypt.DecryptResult{"secret-token": decrypt.NewDecryptResultValue(&value)}, nil
			})
			handler := withRequester(loadHandler(t, examplePlugin(t), opts))
			res := get(t, handler, "/apis/appsdktest.ext.grafana.app/v1alpha1/namespaces/default/testresources/example/baz")
			require.Equal(t, 1, store.reads)
			if failure != "" {
				require.Empty(t, client.calls)
				require.GreaterOrEqual(t, res.Code, 400)
				if failure == "read" {
					require.Zero(t, decryptCalls)
				}
				return
			}
			require.Contains(t, res.Body.String(), errStubRoute.Error())
			require.Len(t, client.calls, 1)
			parent := client.calls[0].GetParent()
			require.Equal(t, "testresources", parent.GetResource())
			require.Equal(t, "example", parent.GetName())
			require.Equal(t, "1", parent.GetRv())
			require.Equal(t, map[string]string{"token": "plaintext"}, parent.GetDecryptedSecureValues())
			require.Contains(t, string(parent.GetRaw()), `"title":"hello"`)
			require.Equal(t, "baz", client.calls[0].GetPath())
		})
	}
}

func TestExampleOpenAPIDiscovery(t *testing.T) {
	handler := withRequester(loadHandler(t, examplePlugin(t), allowAll(testOptions())))
	var doc spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/appsdktest.ext.grafana.app/v1alpha1", &doc)
	require.Contains(t, doc.Paths.Paths, "/apis/appsdktest.ext.grafana.app/v1alpha1/foo")
}

func TestOpenAPIRoutesWithoutKinds(t *testing.T) {
	plugin := examplePlugin(t)
	version := &plugin.Manifest.Versions[0]
	version.Kinds = nil
	version.OpenAPI.Paths = map[string]spec3.PathProps{"/ping": {Get: testOperation("ping")}}
	handler := withRequester(loadHandler(t, plugin, allowAll(testOptions())))
	root := "/apis/appsdktest.ext.grafana.app/v1alpha1"
	require.Contains(t, get(t, handler, root+"/ping").Body.String(), errStubRoute.Error())
	var doc spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/appsdktest.ext.grafana.app/v1alpha1", &doc)
	require.Contains(t, doc.Paths.Paths, root+"/ping")
}

func TestOpenAPIParentAuthorizationBeforeRead(t *testing.T) {
	plugin := examplePlugin(t)
	op := plugin.Manifest.Versions[0].OpenAPI.Paths["/namespaces/{namespace}/testresources/{name}/baz"].Get
	op.Extensions = map[string]interface{}{
		"x-grafana-declared-authz-resource":    "testresources",
		"x-grafana-declared-authz-subresource": "baz",
	}
	client := &recordingRouteClient{}
	store := &parentRouteStore{}
	opts := allowAll(testOptions())
	opts.ClientV3 = client
	opts.Storage = UnifiedStorage(store, nil, nil)
	opts.RouteAuthorizer = authorizer.AuthorizerFunc(func(_ context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
		require.Equal(t, "get", a.GetVerb())
		require.Equal(t, "testresources", a.GetResource())
		require.Equal(t, "baz", a.GetSubresource())
		require.Equal(t, "default", a.GetNamespace())
		require.Equal(t, "example", a.GetName())
		return authorizer.DecisionDeny, "denied", nil
	})
	handler := withRequester(loadHandler(t, plugin, opts))
	res := get(t, handler, "/apis/appsdktest.ext.grafana.app/v1alpha1/namespaces/default/testresources/example/baz")
	require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
	require.Zero(t, store.reads)
	require.Empty(t, client.calls)
	res = get(t, handler, "/apis/appsdktest.ext.grafana.app/v1alpha1/namespaces/other/testresources/example/baz")
	require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
	require.Zero(t, store.reads)
}

func TestOpenAPIRejectsStorageShadowing(t *testing.T) {
	for _, path := range []string{"/namespaces/{namespace}/testresources", "/namespaces/{namespace}/testresources/{name}/status", "/namespaces/{namespace}/unknown/{name}/run", "/namespaces/{namespace}/app/{name}/run"} {
		t.Run(path, func(t *testing.T) {
			plugin := examplePlugin(t)
			plugin.Manifest.Versions[0].OpenAPI.Paths = map[string]spec3.PathProps{path: {Get: testOperation("shadow")}}
			_, err := NewHandler(plugin, allowAll(testOptions()))
			require.Error(t, err)
		})
	}
}

func TestClusterRouteDeclaredAuthorizationUsesCallerTenant(t *testing.T) {
	for _, allowed := range []bool{true, false} {
		t.Run(fmt.Sprint(allowed), func(t *testing.T) {
			client := &recordingRouteClient{}
			opts := allowAll(testOptions())
			opts.ClientV3 = client
			checked := false
			opts.RouteAuthorizer = apiserverauthorizer.NewResourceAuthorizer(routeAccessChecker(func(_ context.Context, ident claims.AuthInfo, req claims.CheckRequest, _ string) (claims.CheckResponse, error) {
				checked = true
				require.Equal(t, "default", req.Namespace)
				require.True(t, claims.NamespaceMatches(ident.GetNamespace(), req.Namespace))
				require.Equal(t, "create", req.Verb)
				require.Equal(t, "testresources", req.Resource)
				return claims.CheckResponse{Allowed: allowed}, nil
			}))
			handler := withRequester(loadHandler(t, examplePlugin(t), opts))
			res := get(t, handler, "/apis/appsdktest.ext.grafana.app/v1alpha1/foo")
			require.True(t, checked)
			if !allowed {
				require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
				require.Empty(t, client.calls)
				return
			}
			require.Contains(t, res.Body.String(), errStubRoute.Error())
			require.Len(t, client.calls, 1)
			require.Empty(t, client.calls[0].GetNamespace())
		})
	}
}

type routeAccessChecker func(context.Context, claims.AuthInfo, claims.CheckRequest, string) (claims.CheckResponse, error)

func (f routeAccessChecker) Check(ctx context.Context, ident claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	return f(ctx, ident, req, folder)
}
