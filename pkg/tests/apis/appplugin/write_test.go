package appplugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	pluginlog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginManifestWrites(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setupHelperWithPlugin(t, rest.Mode5, testAppSetup{manifest: writeManifest(t)}, featuremgmt.FlagGrafanaUseRouterMiddleware)
	ctx := t.Context()
	env := helper.GetEnv()
	original, ok := env.PluginRegistry.Plugin(ctx, testAppID, "")
	if ok {
		require.NoError(t, env.PluginRegistry.Remove(ctx, testAppID, ""))
	} else {
		// The fixture's executable is not available on every test platform.
		original = &plugins.Plugin{JSONData: plugins.JSONData{ID: testAppID, Type: plugins.TypeApp}}
	}
	converter := &writeConverter{}
	replacement := &plugins.Plugin{JSONData: original.JSONData, FS: original.FS, Class: original.Class, Signature: original.Signature}
	replacement.SetLogger(pluginlog.New("test-manifest-writes"))
	replacement.RegisterClient(&writeBackend{Plugin: original, client: converter})
	require.NoError(t, env.PluginRegistry.Add(ctx, replacement))

	client := helper.NewDiscoveryClient().RESTClient()
	path := "/apis/" + testAppGroup + "/v2/namespaces/default/things"
	storageCtx, _ := identity.WithServiceIdentity(ctx, helper.Org1.OrgID)
	readStored := func(t *testing.T, name string) *unstructured.Unstructured {
		t.Helper()
		rsp, err := env.ResourceClient.Read(storageCtx, &resourcepb.ReadRequest{Key: &resourcepb.ResourceKey{
			Namespace: "default", Group: testAppGroup, Resource: "things", Name: name,
		}})
		require.NoError(t, err)
		var obj unstructured.Unstructured
		require.NoError(t, obj.UnmarshalJSON(rsp.Value))
		return &obj
	}
	for _, format := range []string{"json", "yaml"} {
		for _, tc := range []struct {
			name, version, kind string
		}{
			{"missing-both", "", ""},
			{"missing-version", "", "Thing"},
			{"missing-kind", "v2", ""},
			{"same-version", "v2", "Thing"},
			{"convert", "v1", "Thing"},
			{"convert-missing-kind", "v1", ""},
		} {
			t.Run(format+"/"+tc.name, func(t *testing.T) {
				name := format + "-" + tc.name
				var current *unstructured.Unstructured
				for _, method := range []string{http.MethodPost, http.MethodPut} {
					t.Run(method, func(t *testing.T) {
						field := "bar"
						if tc.version == "v1" {
							field = "foo"
						}
						body := newThing(name, map[string]any{field: method, "count": int64(9007199254740993)})
						delete(body.Object, "apiVersion")
						delete(body.Object, "kind")
						if tc.version != "" {
							body.SetAPIVersion(testAppGroup + "/" + tc.version)
						}
						if tc.kind != "" {
							body.SetKind(tc.kind)
						}
						body.SetLabels(map[string]string{"keep": "me"})
						url := path
						if current != nil {
							body.SetResourceVersion(current.GetResourceVersion())
							url += "/" + name
						}
						raw, err := json.Marshal(body.Object)
						require.NoError(t, err)
						if format == "yaml" {
							raw, err = yaml.JSONToYAML(raw)
							require.NoError(t, err)
						}
						calls, reviews := converter.calls.Load(), converter.reviews.Load()
						raw, err = client.Verb(method).AbsPath(url).SetHeader("Content-Type", "application/"+format).Body(raw).DoRaw(ctx)
						require.NoError(t, err, string(raw))
						var returned unstructured.Unstructured
						require.NoError(t, returned.UnmarshalJSON(raw))
						stored := readStored(t, name)
						for _, obj := range []*unstructured.Unstructured{&returned, stored} {
							require.Equal(t, testAppGroup+"/v2", obj.GetAPIVersion())
							require.Equal(t, "Thing", obj.GetKind())
							require.Equal(t, name, obj.GetName())
							require.Equal(t, map[string]string{"keep": "me"}, obj.GetLabels())
							require.Equal(t, map[string]any{"bar": method, "count": int64(9007199254740993)}, obj.Object["spec"])
						}
						if current != nil {
							require.Equal(t, current.GetUID(), returned.GetUID())
							require.NotEqual(t, current.GetResourceVersion(), returned.GetResourceVersion())
						}
						current = &returned
						if tc.version == "v1" {
							calls++
						}
						require.Equal(t, calls, converter.calls.Load(), "conversion happens once per write, before storage")
						require.Greater(t, converter.reviews.Load(), reviews, "admission checked the target version")
					})
				}
			})
		}
	}

	for _, format := range []string{"json", "yaml"} {
		for _, version := range []string{"v1", "v2"} {
			t.Run("invalid-metadata/"+format+"/"+version, func(t *testing.T) {
				before := readStored(t, "json-same-version")
				for _, method := range []string{http.MethodPost, http.MethodPut} {
					name, url := "bad-metadata-"+format+"-"+version, path
					body := newThing(name, map[string]any{"foo": "hello", "bar": "hello"})
					body.SetAPIVersion(testAppGroup + "/" + version)
					if method == http.MethodPut {
						body.SetName(before.GetName())
						body.SetResourceVersion(before.GetResourceVersion())
						url += "/" + before.GetName()
					}
					require.NoError(t, unstructured.SetNestedField(body.Object, int64(42), "metadata", "labels", "invalid"))
					raw, err := body.MarshalJSON()
					require.NoError(t, err)
					if format == "yaml" {
						raw, err = yaml.JSONToYAML(raw)
						require.NoError(t, err)
					}
					calls, reviews := converter.calls.Load(), converter.reviews.Load()
					err = client.Verb(method).AbsPath(url).Param("fieldValidation", "Ignore").SetHeader("Content-Type", "application/"+format).Body(raw).Do(ctx).Error()
					require.True(t, apierrors.IsBadRequest(err), "%s: %v", method, err)
					require.Equal(t, calls, converter.calls.Load())
					require.Equal(t, reviews, converter.reviews.Load())
					_, err = client.Get().AbsPath(path + "/" + name).DoRaw(ctx)
					require.True(t, apierrors.IsNotFound(err))
					require.Equal(t, before.Object, readStored(t, before.GetName()).Object)
				}
			})
		}
	}

	t.Run("dry run converts without saving", func(t *testing.T) {
		body := newThing("dry-run", map[string]any{"foo": "preview"})
		raw, err := body.MarshalJSON()
		require.NoError(t, err)
		raw, err = client.Post().AbsPath(path).Param("dryRun", "All").Body(raw).DoRaw(ctx)
		require.NoError(t, err)
		var obj unstructured.Unstructured
		require.NoError(t, obj.UnmarshalJSON(raw))
		require.Equal(t, testAppGroup+"/v2", obj.GetAPIVersion())
		require.Equal(t, map[string]any{"bar": "preview"}, obj.Object["spec"])
		_, err = client.Get().AbsPath(path + "/dry-run").DoRaw(ctx)
		require.True(t, apierrors.IsNotFound(err), "dry run must not save: %v", err)
	})

	t.Run("invalid options fail before conversion", func(t *testing.T) {
		body := newThing("bad-options", map[string]any{"foo": "hello"})
		raw, err := body.MarshalJSON()
		require.NoError(t, err)
		calls := converter.calls.Load()
		err = client.Post().AbsPath(path).Param("dryRun", "invalid").Body(raw).Do(ctx).Error()
		require.True(t, apierrors.IsInvalid(err), "invalid dryRun must fail: %v", err)
		require.Equal(t, calls, converter.calls.Load())
	})

	t.Run("status update converts while preserving the spec", func(t *testing.T) {
		serviceClient := helper.GetResourceClient(apis.ResourceClientArgs{
			ServiceAccountToken: helper.Org1.AdminServiceAccountToken, Namespace: "default",
			GVR: schema.GroupVersionResource{Group: testAppGroup, Version: "v2", Resource: "things"},
		}).Resource
		current, err := serviceClient.Get(ctx, "json-same-version", metav1.GetOptions{})
		require.NoError(t, err)
		body := current.DeepCopy()
		body.SetAPIVersion(thingAPIVersion)
		body.Object["spec"] = map[string]any{"foo": "must-not-change-the-spec"}
		body.Object["status"] = map[string]any{"state": "running"}
		calls, reviews := converter.calls.Load(), converter.reviews.Load()
		updated, err := serviceClient.UpdateStatus(ctx, body, metav1.UpdateOptions{})
		require.NoError(t, err)
		stored := readStored(t, current.GetName())
		for _, obj := range []*unstructured.Unstructured{updated, stored} {
			require.Equal(t, testAppGroup+"/v2", obj.GetAPIVersion())
			require.Equal(t, current.Object["spec"], obj.Object["spec"])
			require.Equal(t, current.GetGeneration(), obj.GetGeneration())
			require.Equal(t, map[string]any{"state": "running"}, obj.Object["status"])
		}
		require.Equal(t, calls+1, converter.calls.Load())
		require.Equal(t, reviews, converter.reviews.Load(), "status does not run main-resource admission")
	})

	for _, tc := range []struct {
		name, version, kind, value string
		status                     int
	}{
		{"wrong-kind", "v2", "Widget", "hello", 400},
		{"wrong-kind-conversion", "v1", "Widget", "hello", 400},
		{"unknown-version", "v9", "Thing", "hello", 400},
		{"conversion-failure", "v1", "Thing", "fail", 500},
		{"invalid-conversion", "v1", "Thing", "wrong-kind", 500},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := newThing(tc.name, map[string]any{"foo": tc.value})
			body.SetAPIVersion(testAppGroup + "/" + tc.version)
			body.SetKind(tc.kind)
			raw, err := body.MarshalJSON()
			require.NoError(t, err)
			status := 0
			err = client.Post().AbsPath(path).SetHeader("Content-Type", "application/json").Body(raw).Do(ctx).StatusCode(&status).Error()
			require.Error(t, err)
			require.Equal(t, tc.status, status, err)
			_, err = client.Get().AbsPath(path + "/" + tc.name).DoRaw(ctx)
			require.True(t, apierrors.IsNotFound(err), "failed writes must not save: %v", err)

			before := readStored(t, "json-same-version")
			body.SetName(before.GetName())
			raw, err = client.Get().AbsPath(path + "/" + before.GetName()).DoRaw(ctx)
			require.NoError(t, err)
			var current unstructured.Unstructured
			require.NoError(t, current.UnmarshalJSON(raw))
			body.SetResourceVersion(current.GetResourceVersion())
			raw, err = body.MarshalJSON()
			require.NoError(t, err)
			err = client.Put().AbsPath(path+"/"+before.GetName()).SetHeader("Content-Type", "application/json").Body(raw).Do(ctx).StatusCode(&status).Error()
			require.Error(t, err)
			require.Equal(t, tc.status, status, err)
			require.Equal(t, before.Object, readStored(t, before.GetName()).Object, "failed updates must leave storage unchanged")
		})
	}
}

func writeManifest(t *testing.T) []byte {
	t.Helper()
	raw, err := os.ReadFile("testdata/app-sdk-manifest.json")
	require.NoError(t, err)
	var manifest map[string]any
	require.NoError(t, json.Unmarshal(raw, &manifest))
	spec := manifest["spec"].(map[string]any)
	versions := spec["versions"].([]any)
	v1 := versions[0].(map[string]any)
	kind := v1["kinds"].([]any)[0].(map[string]any)
	kind["conversion"] = true
	v2Kind := runtime.DeepCopyJSON(kind)
	v2Kind["admission"] = map[string]any{"mutation": map[string]any{"operations": []any{"CREATE", "UPDATE"}}}
	delete(v2Kind, "searchFields")
	properties := v2Kind["schemas"].(map[string]any)["Thing"].(map[string]any)["properties"].(map[string]any)
	v2Spec := properties["spec"].(map[string]any)
	fields := v2Spec["properties"].(map[string]any)
	fields["bar"] = fields["foo"]
	delete(fields, "foo")
	v2Spec["required"] = []any{"bar"}
	spec["versions"] = append(versions, map[string]any{"name": "v2", "kinds": []any{v2Kind}})
	raw, err = json.Marshal(manifest)
	require.NoError(t, err)
	return raw
}

type writeBackend struct {
	backendplugin.Plugin
	client appclientv3.Client
}

func (b *writeBackend) ClientV3(context.Context) (appclientv3.Client, bool) { return b.client, true }

type writeConverter struct {
	appclientv3.Client
	calls, reviews atomic.Int64
}

func (c *writeConverter) ConvertObjects(_ context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	c.calls.Add(1)
	if req.GetTarget().GetVersion() != "v2" || req.GetNamespace() != "default" {
		return nil, fmt.Errorf("unexpected conversion target or namespace")
	}
	var converted []*pluginv3.ConvertObjectsResponse_Object
	for _, raw := range req.GetObjects() {
		var obj unstructured.Unstructured
		if err := obj.UnmarshalJSON(raw); err != nil {
			return nil, err
		}
		spec := obj.Object["spec"].(map[string]any)
		if spec["foo"] == "fail" {
			return nil, fmt.Errorf("conversion failed")
		}
		if spec["foo"] == "wrong-kind" {
			obj.SetKind("Widget")
		}
		spec["bar"] = spec["foo"]
		delete(spec, "foo")
		obj.SetAPIVersion(testAppGroup + "/v2")
		obj.SetName("converter-must-not-change-identity")
		obj.SetLabels(nil)
		raw, err := obj.MarshalJSON()
		if err != nil {
			return nil, err
		}
		converted = append(converted, pluginv3.ConvertObjectsResponse_Object_builder{Raw: raw}.Build())
	}
	return pluginv3.ConvertObjectsResponse_builder{Converted: converted}.Build(), nil
}

func (c *writeConverter) AdmissionReview(_ context.Context, req *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	c.reviews.Add(1)
	var obj unstructured.Unstructured
	if err := obj.UnmarshalJSON(req.GetObjectBytes()); err != nil {
		return nil, err
	}
	spec := obj.Object["spec"].(map[string]any)
	if obj.GetAPIVersion() != testAppGroup+"/v2" || spec["bar"] == nil || spec["foo"] != nil {
		return nil, fmt.Errorf("admission must receive the v2 object")
	}
	rsp := &pluginv3.AdmissionReviewResponse{}
	rsp.SetAllowed(true)
	return rsp, nil
}
