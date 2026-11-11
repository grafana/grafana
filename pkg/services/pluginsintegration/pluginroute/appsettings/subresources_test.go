package appsettings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

type fakeSubresourceClient struct {
	health   *backend.CheckHealthResult
	resource *backend.CallResourceRequest
}

func (c *fakeSubresourceClient) CheckHealth(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return c.health, nil
}

func (c *fakeSubresourceClient) CallResource(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	c.resource = req
	return sender.Send(&backend.CallResourceResponse{Status: http.StatusTeapot})
}

func TestSubresourceHandler(t *testing.T) {
	client := &fakeSubresourceClient{health: &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "fine"}}
	b, err := NewBuilder(definitionFor("example-app"), client, settingsContextFunc(
		func(ctx context.Context, _ string, settings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
			require.Equal(t, "v0alpha1", settings.APIVersion, "the plugin context uses the served version")
			require.Equal(t, "default", request.NamespaceValue(ctx), "the namespace from the request info is in the context")
			return ctx, backend.PluginContext{}, nil
		}), nil, nil, Options{}, nil, nil)
	require.NoError(t, err)
	b.getter = func(context.Context, schema.GroupVersionResource, string) (runtime.Object, error) {
		return &apppluginV0.Settings{Spec: apppluginV0.SettingsSpec{Enabled: true}}, nil
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	handler := b.SubresourceHandler(next)

	serve := func(method, path string, info *request.RequestInfo) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if info != nil {
			req = req.WithContext(request.WithRequestInfo(req.Context(), info))
		}
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}
	info := func(name, subresource string) *request.RequestInfo {
		return &request.RequestInfo{IsResourceRequest: true, APIGroup: "example-app", APIVersion: "v0alpha1",
			Namespace: "default", Resource: apppluginV0.APP_RESOURCE_NAME, Name: name, Subresource: subresource}
	}
	const base = "/apis/example-app/v0alpha1/namespaces/default/app/instance"

	t.Run("health", func(t *testing.T) {
		res := serve(http.MethodGet, base+"/health", info("instance", "health"))
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var result apppluginV0.HealthCheckResult
		require.NoError(t, json.Unmarshal(res.Body.Bytes(), &result))
		require.Equal(t, "example-app/v0alpha1", result.APIVersion)
		require.Equal(t, "HealthCheckResult", result.Kind)
		require.Equal(t, "OK", result.Status)
		require.Equal(t, "fine", result.Message)
	})

	t.Run("resources forward the path below the subresource", func(t *testing.T) {
		res := serve(http.MethodPost, base+"/resources/api/items?limit=1", info("instance", "resources"))
		require.Equal(t, http.StatusTeapot, res.Code, res.Body.String())
		require.Equal(t, "api/items", client.resource.Path)
		require.Equal(t, "api/items?limit=1", client.resource.URL)
		require.Equal(t, http.MethodPost, client.resource.Method)
	})

	t.Run("resources prepare headers like the legacy endpoint", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, base+"/resources/api/items", nil)
		req.Header.Set("Origin", "https://example.com")
		req.Header.Set("Referer", "https://example.com/d/abc")
		req = req.WithContext(request.WithRequestInfo(req.Context(), info("instance", "resources")))
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.Empty(t, client.resource.Headers["Origin"])
		require.Empty(t, client.resource.Headers["Referer"])
		require.Equal(t, []string{"https://example.com/d/abc"}, client.resource.Headers["X-Grafana-Referer"])
		require.Equal(t, "https://example.com", req.Header.Get("Origin"), "the caller's request is not modified")
	})

	t.Run("resources refuse bodies over the limit", func(t *testing.T) {
		limit := maxResourceBodySize
		maxResourceBodySize = 8
		t.Cleanup(func() { maxResourceBodySize = limit })
		client.resource = nil
		req := httptest.NewRequest(http.MethodPost, base+"/resources/api/items", strings.NewReader("more than eight bytes"))
		req = req.WithContext(request.WithRequestInfo(req.Context(), info("instance", "resources")))
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		require.Equal(t, http.StatusRequestEntityTooLarge, res.Code, res.Body.String())
		require.Nil(t, client.resource)
	})

	t.Run("methods outside the allowlist never reach the plugin", func(t *testing.T) {
		client.resource = nil
		for _, method := range []string{http.MethodTrace, http.MethodConnect, "PROPFIND"} {
			res := serve(method, base+"/resources/api/items", info("instance", "resources"))
			require.Equal(t, http.StatusMethodNotAllowed, res.Code, method)
			require.Equal(t, "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS", res.Header().Get("Allow"))
		}
		require.Nil(t, client.resource, "a refused method must not be forwarded")

		res := serve(http.MethodPost, base+"/health", info("instance", "health"))
		require.Equal(t, http.StatusMethodNotAllowed, res.Code)
		require.Equal(t, "GET", res.Header().Get("Allow"))
	})

	t.Run("only the instance has subresources", func(t *testing.T) {
		res := serve(http.MethodGet, "/apis/example-app/v0alpha1/namespaces/default/app/other/health", info("other", "health"))
		require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
	})

	t.Run("proxy is not served without routes", func(t *testing.T) {
		res := serve(http.MethodGet, base+"/proxy", info("instance", "proxy"))
		require.Equal(t, http.StatusNoContent, res.Code)
	})

	t.Run("other requests reach the API server", func(t *testing.T) {
		require.Equal(t, http.StatusNoContent, serve(http.MethodGet, base, info("instance", "")).Code)
		require.Equal(t, http.StatusNoContent, serve(http.MethodGet, base+"/health", nil).Code, "requests without request info")
		other := info("instance", "health")
		other.APIGroup = "other-app"
		require.Equal(t, http.StatusNoContent, serve(http.MethodGet, base+"/health", other).Code)
		for _, sub := range []string{"health", "resources", "proxy"} {
			unserved := info("instance", sub)
			unserved.APIVersion = "v1"
			res := serve(http.MethodGet, "/apis/example-app/v1/namespaces/default/app/instance/"+sub, unserved)
			require.Equal(t, http.StatusNoContent, res.Code, "%s under an unserved version is left to the API server", sub)
		}
	})
}

func definitionFor(id string) definition.PluginDefinition {
	return definition.PluginDefinition{JSONData: plugins.JSONData{ID: id}}
}

func TestSecureValuesCache(t *testing.T) {
	now := time.Unix(0, 0)
	cache := &secureValuesCache{now: func() time.Time { return now }}
	loads := 0
	load := func(context.Context) (map[string]string, error) {
		loads++
		return map[string]string{"key": fmt.Sprint(loads)}, nil
	}
	get := func(namespace, rv string) map[string]string {
		t.Helper()
		values, err := cache.cached(namespace, rv, load)(t.Context())
		require.NoError(t, err)
		return values
	}

	require.Equal(t, "1", get("default", "1")["key"])
	require.Equal(t, "1", get("default", "1")["key"], "the same version is reused")
	require.Equal(t, 1, loads)

	require.Equal(t, "2", get("default", "2")["key"], "a new version is decrypted again")
	require.Equal(t, "3", get("other", "2")["key"], "namespaces are cached apart")

	now = now.Add(secureValuesTTL)
	require.Equal(t, "4", get("default", "2")["key"], "entries expire")
	require.NotContains(t, cache.entries, "other", "expired entries are dropped")

	_, err := cache.cached("default", "5", func(context.Context) (map[string]string, error) {
		return nil, errors.New("decrypt failed")
	})(t.Context())
	require.Error(t, err)
	require.Equal(t, "4", get("default", "2")["key"], "failures are not cached")
}
