package pluginroute

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"google.golang.org/grpc"
)

func TestDecodeWrite(t *testing.T) {
	for _, mediaType := range []string{"application/json", "application/yaml"} {
		t.Run(mediaType, func(t *testing.T) {
			obj, err := decodeWrite(t.Context(), []byte(`{"spec":{"count":9007199254740993}}`), mediaType, "Strict")
			require.NoError(t, err)
			require.Equal(t, int64(9007199254740993), obj.Object["spec"].(map[string]any)["count"])
			for _, body := range []string{"null", "[]", "42", `"hello"`, "", "{", "{} {}", "{}\n---\n{}"} {
				_, err := decodeWrite(t.Context(), []byte(body), mediaType, "Strict")
				require.Error(t, err, body)
			}
			duplicate := `{"spec":{"foo":"a","foo":"b"}}`
			if mediaType == "application/yaml" {
				duplicate = "spec:\n  foo: a\n  foo: b\n"
			}
			_, err = decodeWrite(t.Context(), []byte(duplicate), mediaType, "Strict")
			require.Error(t, err)
			for _, validation := range []string{"Ignore", "Warn", ""} {
				obj, err = decodeWrite(t.Context(), []byte(duplicate), mediaType, validation)
				require.NoError(t, err)
				require.Equal(t, "b", obj.Object["spec"].(map[string]any)["foo"])
			}
		})
	}
}

func TestHandlerRejectsUnsupportedWriteConversion(t *testing.T) {
	for name, change := range map[string]func(*app.ManifestData){
		"source does not convert": func(m *app.ManifestData) { m.Versions[0].Kinds[0].Conversion = false },
		"target does not convert": func(m *app.ManifestData) { m.Versions[1].Kinds[0].Conversion = false },
		"source is not served":    func(m *app.ManifestData) { m.Versions[0].Served = false },
		"source kind differs": func(m *app.ManifestData) {
			m.Versions[0].Kinds[0].Kind = "OtherKind"
			m.Versions[0].Kinds[0].Schema = nil
		},
	} {
		t.Run(name, func(t *testing.T) {
			plugin := conversionPlugin()
			change(plugin.Manifests[0])
			storage := &resourceClient{}
			converter := &stubConverter{}
			opts := allowAll(testOptions())
			opts.Storage = UnifiedStorage(storage, nil, nil)
			opts.ClientV3 = converter
			handler := withRequester(loadHandler(t, plugin, opts))
			req := httptest.NewRequest(http.MethodPost, "/apis/example.ext.grafana.app/v2alpha1/namespaces/default/testkinds", strings.NewReader(testObjectJSON))
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
			require.Nil(t, storage.created)
			require.Empty(t, converter.requests)
		})
	}
}

func TestHandlerNormalizesWrites(t *testing.T) {
	for _, tc := range []struct {
		name, body, contentType, query string
		status                         int
		converted, warning             bool
	}{
		{name: "missing both", body: `{"metadata":{"name":"example"},"spec":{"testField":"hello"}}`, status: 201},
		{name: "missing version", body: `{"kind":"TestKind","metadata":{"name":"example"},"spec":{"testField":"hello"}}`, status: 201},
		{name: "missing kind and convert", body: `{"apiVersion":"example.ext.grafana.app/v1alpha1","metadata":{"name":"example"},"spec":{"testField":"hello"}}`, status: 201, converted: true},
		{name: "yaml conversion", contentType: "application/yaml", body: "apiVersion: example.ext.grafana.app/v1alpha1\nkind: TestKind\nmetadata:\n  name: example\nspec:\n  testField: hello\n", status: 201, converted: true},
		{name: "wrong kind same version", body: `{"apiVersion":"example.ext.grafana.app/v2alpha1","kind":"OtherKind"}`, status: 400},
		{name: "wrong kind other version", body: `{"apiVersion":"example.ext.grafana.app/v1alpha1","kind":"OtherKind"}`, status: 400},
		{name: "wrong group", body: `{"apiVersion":"other/v1alpha1"}`, status: 400},
		{name: "unknown version", body: `{"apiVersion":"example.ext.grafana.app/v9"}`, status: 400},
		{name: "empty version", body: `{"apiVersion":""}`, status: 400},
		{name: "null kind", body: `{"kind":null}`, status: 400},
		{name: "numeric kind", body: `{"kind":42}`, status: 400},
		{name: "empty kind", body: `{"kind":""}`, status: 400},
		{name: "conflicting namespace", body: `{"apiVersion":"example.ext.grafana.app/v1alpha1","metadata":{"namespace":"other"}}`, status: 400},
		{name: "strict duplicates", body: `{"metadata":{"name":"example"},"spec":{"testField":"a","testField":"hello"}}`, query: "?fieldValidation=Strict", status: 400},
		{name: "warn duplicates", body: `{"metadata":{"name":"example"},"spec":{"testField":"a","testField":"hello"}}`, query: "?fieldValidation=Warn", status: 201, warning: true},
		{name: "unsupported content type", body: `{}`, contentType: "text/plain", status: 415},
	} {
		t.Run(tc.name, func(t *testing.T) {
			storage := &resourceClient{}
			converter := &stubConverter{}
			opts := allowAll(testOptions())
			opts.Storage = UnifiedStorage(storage, nil, nil)
			opts.ClientV3 = converter
			handler := withRequester(loadHandler(t, conversionPlugin(), opts))
			req := httptest.NewRequest(http.MethodPost, "/apis/example.ext.grafana.app/v2alpha1/namespaces/default/testkinds"+tc.query, strings.NewReader(tc.body))
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			require.Equal(t, tc.status, res.Code, res.Body.String())
			require.Equal(t, tc.warning, res.Header().Get("Warning") != "")
			if tc.status != http.StatusCreated {
				require.Nil(t, storage.created)
				require.Empty(t, converter.requests)
				return
			}
			var stored unstructured.Unstructured
			require.NoError(t, stored.UnmarshalJSON(storage.created.Value))
			require.Equal(t, "example.ext.grafana.app/v2alpha1", stored.GetAPIVersion())
			require.Equal(t, "TestKind", stored.GetKind())
			want := "hello"
			if tc.converted {
				require.Len(t, converter.requests, 1)
				require.Equal(t, "default", converter.requests[0].GetNamespace())
				want = "converted:hello"
			} else {
				require.Empty(t, converter.requests)
			}
			require.Equal(t, want, stored.Object["spec"].(map[string]any)["testField"])
		})
	}
}

func TestWriteHandlerRejectsMalformedMetadataBeforeConversion(t *testing.T) {
	for _, version := range []string{"v1alpha1", "v2alpha1"} {
		for _, metadata := range []string{`null`, `[]`, `"invalid"`, `{"name":42}`, `{"namespace":42}`, `{"name":"example","labels":{"label":42}}`} {
			t.Run(version+"/"+metadata, func(t *testing.T) {
				storage := &resourceClient{}
				converter := &stubConverter{}
				opts := testOptions()
				opts.Storage = UnifiedStorage(storage, nil, nil)
				opts.ClientV3 = converter
				_, handler := newWriteHandlerForTest(t, opts)
				body := fmt.Sprintf(`{"apiVersion":"example.ext.grafana.app/%s","metadata":%s,"spec":{"testField":"hello"}}`, version, metadata)
				req := httptest.NewRequest(http.MethodPost, "/apis/example.ext.grafana.app/v2alpha1/namespaces/default/testkinds", strings.NewReader(body))
				res := httptest.NewRecorder()
				handler.ServeHTTP(res, req)
				require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
				require.Empty(t, converter.requests)
				require.Nil(t, storage.created)
			})
		}
	}
}

func TestWriteHandlerConversionErrorResponse(t *testing.T) {
	for _, size := range []int{16, 64 * 1024, 128 * 1024} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			storage := &resourceClient{}
			opts := testOptions()
			opts.Storage = UnifiedStorage(storage, nil, nil)
			opts.ClientV3 = &stubConverter{err: errors.New(strings.Repeat("x", size))}
			_, handler := newWriteHandlerForTest(t, opts)
			req := httptest.NewRequest(http.MethodPost, "/apis/example.ext.grafana.app/v2alpha1/namespaces/default/testkinds", strings.NewReader(testObjectJSON))
			req.Header.Set("Accept-Encoding", "gzip")
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			require.Equal(t, http.StatusInternalServerError, res.Code)
			var body io.Reader = res.Body
			if res.Header().Get("Content-Encoding") == "gzip" {
				require.Equal(t, []string{"Accept-Encoding"}, res.Header().Values("Vary"))
				reader, err := gzip.NewReader(body)
				require.NoError(t, err)
				defer reader.Close()
				body = reader
			}
			var status metav1.Status
			require.NoError(t, json.NewDecoder(body).Decode(&status))
			require.Equal(t, int32(http.StatusInternalServerError), status.Code)
			require.Equal(t, metav1.StatusReasonInternalError, status.Reason)
			require.Contains(t, status.Message, strings.Repeat("x", size))
			require.Nil(t, storage.created)
		})
	}
}

func TestNormalizeWritesBodyLimitAndBypass(t *testing.T) {
	opts := testOptions()
	opts.Storage = UnifiedStorage(&resourceClient{}, nil, nil)
	b, _ := newWriteHandlerForTest(t, opts)
	for _, endpoint := range b.writes {
		endpoint.scope.MaxRequestBodyBytes = 8
	}
	gvr := schema.GroupVersionResource{Group: b.group, Version: "v1alpha1", Resource: "testkinds"}
	for _, tc := range []struct {
		verb, name, subresource string
		status                  int
	}{
		{"create", "", "", http.StatusRequestEntityTooLarge},
		{"update", "example", "", http.StatusRequestEntityTooLarge},

		{"patch", "example", "", http.StatusNoContent},
		{"create", "example", "custom", http.StatusNoContent},
		{"create", "search", "", http.StatusNoContent},
		{"update", "", "", http.StatusNoContent},
	} {
		t.Run(tc.verb+"/"+tc.name+"/"+tc.subresource, func(t *testing.T) {
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
			handler := b.serveWrites(next)
			parts := []string{"testkinds"}
			if tc.name != "" {
				parts = append(parts, tc.name)
			}
			if tc.subresource != "" {
				parts = append(parts, tc.subresource)
			}
			ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{
				IsResourceRequest: true, Verb: tc.verb, APIGroup: gvr.Group, APIVersion: gvr.Version, Resource: gvr.Resource, Name: tc.name, Subresource: tc.subresource, Namespace: "default", Parts: parts,
			})
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"spec":{}}`)).WithContext(ctx)
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			require.Equal(t, tc.status, res.Code, res.Body.String())
		})
	}
}

func newWriteHandlerForTest(t *testing.T, opts Options) (*manifestBuilder, http.Handler) {
	t.Helper()
	plugin := conversionPlugin()
	b, err := newManifestBuilder(plugin.JSONData.ID, plugin.Manifests[0], allowAll(opts))
	require.NoError(t, err)
	authz, err := b.unionAuthorizer()
	require.NoError(t, err)
	server, err := newServerHandler(b, opts, prometheus.NewRegistry(), authz, b.buildHandlerChain)
	require.NoError(t, err)
	t.Cleanup(server.Destroy)
	return b, withRequester(server)
}

func TestWriteHandlerUsesItsDecoderAndKeepsRequestContextsSeparate(t *testing.T) {
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	opts := testOptions()
	opts.Storage = UnifiedStorage(&concurrentWriteStorage{}, nil, nil)
	opts.ClientV3 = &contextWriteConverter{entered: entered, release: release}
	b, handler := newWriteHandlerForTest(t, opts)
	var fallbackDecodes atomic.Int64
	for _, endpoint := range b.writes {
		endpoint.scope.Serializer = countingWriteSerializer{endpoint.scope.Serializer, &fallbackDecodes}
	}
	responses := make(chan *httptest.ResponseRecorder, 2)
	for _, name := range []string{"first", "second"} {
		go func() {
			ctx := context.WithValue(t.Context(), writeContextKey{}, name)
			body := fmt.Sprintf(`{"apiVersion":"example.ext.grafana.app/v1alpha1","metadata":{"name":%q},"spec":{"testField":%q}}`, name, name)
			req := httptest.NewRequest(http.MethodPost, "/apis/example.ext.grafana.app/v2alpha1/namespaces/default/testkinds", strings.NewReader(body)).WithContext(ctx)
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			responses <- res
		}()
	}
	for range 2 {
		select {
		case <-entered:
		case res := <-responses:
			t.Fatalf("request completed before reaching conversion: %d %s", res.Code, res.Body.String())
		case <-t.Context().Done():
			t.Fatal(t.Context().Err())
		}
	}
	close(release)
	for range 2 {
		res := <-responses
		require.Equal(t, http.StatusCreated, res.Code, res.Body.String())
	}
	require.Zero(t, fallbackDecodes.Load(), "the native handler must not decode the object a second time")
}

type writeContextKey struct{}

type contextWriteConverter struct {
	stubClientV3
	entered chan<- struct{}
	release <-chan struct{}
}

func (c *contextWriteConverter) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	c.entered <- struct{}{}
	select {
	case <-c.release:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	var obj map[string]any
	if err := json.Unmarshal(req.GetObjects()[0], &obj); err != nil {
		return nil, err
	}
	if ctx.Value(writeContextKey{}) != obj["spec"].(map[string]any)["testField"] {
		return nil, fmt.Errorf("conversion received another request's context")
	}
	if _, ok := ctx.Deadline(); !ok {
		return nil, fmt.Errorf("conversion must have a deadline")
	}
	return (&stubConverter{}).ConvertObjects(ctx, req)
}

type concurrentWriteStorage struct {
	resourceClient
	mu sync.Mutex
}

func (c *concurrentWriteStorage) Create(ctx context.Context, req *resourcepb.CreateRequest, opts ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.resourceClient.Create(ctx, req, opts...)
}

type countingWriteSerializer struct {
	runtime.NegotiatedSerializer
	calls *atomic.Int64
}

func (s countingWriteSerializer) SupportedMediaTypes() []runtime.SerializerInfo {
	infos := append([]runtime.SerializerInfo(nil), s.NegotiatedSerializer.SupportedMediaTypes()...)
	for i := range infos {
		infos[i].Serializer = countingWriteDecoder{infos[i].Serializer, s.calls}
		infos[i].StrictSerializer = countingWriteDecoder{infos[i].StrictSerializer, s.calls}
	}
	return infos
}

type countingWriteDecoder struct {
	runtime.Serializer
	calls *atomic.Int64
}

func (d countingWriteDecoder) Decode(raw []byte, gvk *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	d.calls.Add(1)
	return d.Serializer.Decode(raw, gvk, into)
}
