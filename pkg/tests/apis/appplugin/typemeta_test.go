package appplugin

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const thingsPath = "/apis/" + testAppGroup + "/v1/namespaces/default/things"

// TestIntegrationPluginManifestKindTypeMetaDefaulting covers writes whose body
// leaves out apiVersion or kind. The URL already names both, and typed Grafana
// APIs accept such bodies, so clients written against them must also work when
// the same resource is served as a manifest kind.
func TestIntegrationPluginManifestKindTypeMetaDefaulting(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5, featuremgmt.FlagGrafanaUseRouterMiddleware)
	client := thingsClient(t, helper)
	ctx := context.Background()

	write := func(t *testing.T, method, path, contentType, query, body string) apis.K8sResponse[map[string]any] {
		t.Helper()
		return apis.DoRequest(helper, apis.RequestParams{
			User:        helper.Org1.Admin,
			Method:      method,
			Path:        path + query,
			Body:        []byte(body),
			ContentType: contentType,
		}, &map[string]any{})
	}
	requireTyped := func(t *testing.T, obj map[string]any) {
		t.Helper()
		require.Equal(t, thingAPIVersion, obj["apiVersion"])
		require.Equal(t, "Thing", obj["kind"])
	}

	t.Run("create", func(t *testing.T) {
		for _, tc := range []struct{ name, contentType, body string }{
			{"json without apiVersion or kind", "application/json",
				`{"metadata":{"name":"bare-json"},"spec":{"foo":"bar","count":2}}`},
			{"yaml without apiVersion or kind", "application/yaml",
				"metadata:\n  name: bare-yaml\nspec:\n  foo: bar\n  count: 2\n"},
			{"json with only kind", "application/json",
				`{"kind":"Thing","metadata":{"name":"kind-only"},"spec":{"foo":"bar","count":2}}`},
			{"json with only apiVersion", "application/json",
				`{"apiVersion":"` + thingAPIVersion + `","metadata":{"name":"version-only"},"spec":{"foo":"bar","count":2}}`},
		} {
			t.Run(tc.name, func(t *testing.T) {
				rsp := write(t, http.MethodPost, thingsPath, tc.contentType, "", tc.body)
				require.Equal(t, http.StatusCreated, rsp.Response.StatusCode, string(rsp.Body))
				requireTyped(t, *rsp.Result)

				name := (*rsp.Result)["metadata"].(map[string]any)["name"].(string)
				t.Cleanup(func() { _ = client.Delete(ctx, name, metav1.DeleteOptions{}) })

				stored, err := client.Get(ctx, name, metav1.GetOptions{})
				require.NoError(t, err)
				require.Equal(t, thingAPIVersion, stored.GetAPIVersion())
				require.Equal(t, "Thing", stored.GetKind())
				require.Equal(t, map[string]any{"foo": "bar", "count": int64(2)}, stored.Object["spec"])
				require.NotEmpty(t, stored.GetManagedFields(), "managed fields are still tracked")
			})
		}
	})

	t.Run("update without apiVersion or kind", func(t *testing.T) {
		created, err := client.Create(ctx, newThing("bare-update", map[string]any{"foo": "before"}), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Delete(ctx, "bare-update", metav1.DeleteOptions{}) })

		for _, tc := range []struct{ contentType, body, foo string }{
			{"application/json", `{"metadata":{"name":"bare-update","resourceVersion":"%s"},"spec":{"foo":"json"}}`, "json"},
			{"application/yaml", "metadata:\n  name: bare-update\n  resourceVersion: \"%s\"\nspec:\n  foo: yaml\n", "yaml"},
		} {
			t.Run(tc.contentType, func(t *testing.T) {
				current, err := client.Get(ctx, "bare-update", metav1.GetOptions{})
				require.NoError(t, err)
				body := fmt.Sprintf(tc.body, current.GetResourceVersion())

				rsp := write(t, http.MethodPut, thingsPath+"/bare-update", tc.contentType, "", body)
				require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
				requireTyped(t, *rsp.Result)

				stored, err := client.Get(ctx, "bare-update", metav1.GetOptions{})
				require.NoError(t, err)
				require.Equal(t, created.GetUID(), stored.GetUID())
				require.Equal(t, map[string]any{"foo": tc.foo}, stored.Object["spec"])
			})
		}
	})

	t.Run("a body naming another version is rejected, not relabelled", func(t *testing.T) {
		rsp := write(t, http.MethodPost, thingsPath, "application/json", "",
			`{"apiVersion":"`+testAppGroup+`/v9","metadata":{"name":"other-version"},"spec":{"foo":"bar"}}`)
		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode, string(rsp.Body))
		require.Contains(t, string(rsp.Body), "does not match the expected API version")

		_, err := client.Get(ctx, "other-version", metav1.GetOptions{})
		require.Truef(t, apierrors.IsNotFound(err), "nothing is stored: %v", err)
	})

	t.Run("field validation still sees the body as sent", func(t *testing.T) {
		duplicate := `{"metadata":{"name":"%s"},"spec":{"foo":"a","foo":"b"}}`

		rsp := write(t, http.MethodPost, thingsPath, "application/json", "?fieldValidation=Strict", fmt.Sprintf(duplicate, "dup-strict"))
		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode, string(rsp.Body))
		require.Contains(t, string(rsp.Body), "duplicate field")

		rsp = write(t, http.MethodPost, thingsPath, "application/json", "?fieldValidation=Warn", fmt.Sprintf(duplicate, "dup-warn"))
		require.Equal(t, http.StatusCreated, rsp.Response.StatusCode, string(rsp.Body))
		t.Cleanup(func() { _ = client.Delete(ctx, "dup-warn", metav1.DeleteOptions{}) })
		require.Contains(t, rsp.Response.Header.Get("Warning"), "duplicate field")
		requireTyped(t, *rsp.Result)
	})

	t.Run("a body that is not an object is a 400", func(t *testing.T) {
		rsp := write(t, http.MethodPost, thingsPath, "application/json", "", `["not", "an", "object"]`)
		require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode, string(rsp.Body))
	})
}
