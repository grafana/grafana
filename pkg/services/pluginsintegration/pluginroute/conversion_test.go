package pluginroute

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

// stubConverter stands in for a plugin's conversion webhook: it moves each
// object to the target version and marks the field it converted.
type stubConverter struct {
	stubClientV3
	err      error
	requests []*pluginv3.ConvertObjectsRequest
}

func (c *stubConverter) ConvertObjects(_ context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	c.requests = append(c.requests, req)
	if c.err != nil {
		return nil, c.err
	}
	converted := make([]*pluginv3.ConvertObjectsResponse_Object, 0, len(req.GetObjects()))
	for _, in := range req.GetObjects() {
		var obj map[string]any
		if err := json.Unmarshal(in.GetRaw(), &obj); err != nil {
			return nil, err
		}
		obj["apiVersion"] = req.GetApi().GetGroup() + "/" + req.GetTargetVersion()
		spec := obj["spec"].(map[string]any)
		spec["testField"] = "converted:" + spec["testField"].(string)
		raw, err := json.Marshal(obj)
		if err != nil {
			return nil, err
		}
		out := &pluginv3.ConvertObjectsResponse_Object{}
		out.SetRaw(raw)
		converted = append(converted, out)
	}
	rsp := &pluginv3.ConvertObjectsResponse{}
	rsp.SetUid(req.GetUid())
	rsp.SetConverted(converted)
	return rsp, nil
}

// conversionPlugin serves TestKind in v1alpha1 and v2alpha1, both converted by
// the plugin.
func conversionPlugin() definition.PluginDefinition {
	plugin := testPlugin()
	folderScoped := false
	kind := &plugin.Manifests[0].Versions[0].Kinds[0]
	kind.Conversion = true
	kind.FolderScoped = &folderScoped
	plugin.Manifests[0].Versions[1] = app.ManifestVersion{
		Name: "v2alpha1", Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind: "TestKind", Plural: "TestKinds", Scope: "Namespaced",
			Schema: testSchema(), Conversion: true, FolderScoped: &folderScoped,
		}},
	}
	return plugin
}

// An object stored in one version and read in another is converted by the
// plugin, which a manifest asks for with conversion: true.
func TestHandlerConvertsThroughThePlugin(t *testing.T) {
	storage := &resourceClient{}
	converter := &stubConverter{}
	opts := allowAll(testOptions())
	opts.Storage = UnifiedStorage(storage, nil, nil)
	opts.ClientV3 = converter
	handler := withRequester(loadHandler(t, conversionPlugin(), opts))
	path := func(version string) string {
		return "/apis/example.ext.grafana.app/" + version + "/namespaces/default/testkinds"
	}

	req := httptest.NewRequest(http.MethodPost, path("v1alpha1"), strings.NewReader(testObjectJSON))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	require.Equal(t, http.StatusCreated, res.Code, res.Body.String())

	var got map[string]any
	getJSON(t, handler, path("v1alpha1")+"/example", &got)
	require.Equal(t, "hello", got["spec"].(map[string]any)["testField"])
	require.Empty(t, converter.requests, "an object read in the version it is stored in is not converted")

	getJSON(t, handler, path("v2alpha1")+"/example", &got)
	require.Equal(t, "example.ext.grafana.app/v2alpha1", got["apiVersion"])
	require.Equal(t, "converted:hello", got["spec"].(map[string]any)["testField"], "the plugin's conversion is served")
	require.Equal(t, "example", got["metadata"].(map[string]any)["name"], "metadata survives conversion")

	require.Len(t, converter.requests, 1)
	call := converter.requests[0]
	require.Equal(t, "example.ext.grafana.app", call.GetApi().GetGroup())
	require.Equal(t, "v2alpha1", call.GetTargetVersion())
	require.Len(t, call.GetObjects(), 1)
	require.Equal(t, "v1alpha1", call.GetObjects()[0].GetGvk().GetVersion(), "the stored version is the source")
}

// A failed conversion is an error, not the unconverted object.
func TestHandlerConversionFailure(t *testing.T) {
	storage := &resourceClient{}
	converter := &stubConverter{}
	opts := allowAll(testOptions())
	opts.Storage = UnifiedStorage(storage, nil, nil)
	opts.ClientV3 = converter
	handler := withRequester(loadHandler(t, conversionPlugin(), opts))
	root := "/apis/example.ext.grafana.app/"

	req := httptest.NewRequest(http.MethodPost, root+"v1alpha1/namespaces/default/testkinds", strings.NewReader(testObjectJSON))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	require.Equal(t, http.StatusCreated, res.Code, res.Body.String())

	converter.err = errors.New("the plugin cannot convert")
	res = get(t, handler, root+"v2alpha1/namespaces/default/testkinds/example")
	require.NotEqual(t, http.StatusOK, res.Code)
	require.Contains(t, res.Body.String(), "conversion to example.ext.grafana.app/v2alpha1")
	require.NotContains(t, res.Body.String(), `"testField":"hello"`)
}

// A kind cannot ask for conversion without a plugin to do it.
func TestHandlerConversionNeedsAPluginClient(t *testing.T) {
	plugin := conversionPlugin()
	opts := testOptions()
	opts.ClientV3 = nil
	_, err := NewHandler(plugin.JSONData.ID, plugin.Manifests[0], opts)
	require.ErrorContains(t, err, "declares conversion but has no plugin client")
}
