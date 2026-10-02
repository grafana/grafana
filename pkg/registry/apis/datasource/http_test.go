package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/handlers/negotiation"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

type httpConversionFunc func(context.Context, *backend.ConversionRequest) (*backend.ConversionResponse, error)

func (f httpConversionFunc) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return f(ctx, req)
}

// Tests that construct builders directly still need their startup-initialized handlers.
func testHTTPBuilder(b *DataSourceAPIBuilder) *DataSourceAPIBuilder {
	b.initHTTPHandlers()
	return b
}

const httpQueryBody = `{"from":"1700000000000","to":"1700000060000","queries":[{"refId":"A","datasource":{"uid":"ds","type":"prometheus"},"expr":"up"}]}`

// Use the real apiserver serializer to check the direct HTTP wire format, not a shared fake responder.
type negotiatedResponder struct {
	w      http.ResponseWriter
	r      *http.Request
	gv     schema.GroupVersion
	codecs serializer.CodecFactory
}

func (s negotiatedResponder) Object(code int, obj runtime.Object) {
	responsewriters.WriteObjectNegotiated(s.codecs.WithoutConversion(), negotiation.DefaultEndpointRestrictions, s.gv, s.w, s.r, code, obj, false)
}
func (s negotiatedResponder) Error(err error) {
	responsewriters.ErrorNegotiated(err, s.codecs.WithoutConversion(), s.gv, s.w, s.r)
}

func TestHTTPHandlersMatchREST(t *testing.T) {
	for _, tc := range []struct {
		name, endpoint, body string
		fail, missing        bool
		status               int
		accept, contentType  string
		limit                bool
	}{
		{name: "query", endpoint: "query", body: httpQueryBody},
		{name: "query error", endpoint: "query", body: httpQueryBody, fail: true, status: 500},
		{name: "query missing datasource", endpoint: "query", body: httpQueryBody, missing: true, status: 404},
		{name: "malformed query", endpoint: "query", body: `{`, status: 400},
		{name: "mixed datasource references", endpoint: "query", body: strings.TrimSuffix(httpQueryBody, `]}`) + `,{"refId":"B","datasource":{"uid":"other","type":"prometheus"}}]}`, status: 400},
		{name: "invalid content type", endpoint: "query", body: httpQueryBody, contentType: "text/plain", status: 400},
		{name: "query body limit", endpoint: "query", body: httpQueryBody, limit: true, status: 413},
		{name: "chunked disabled", endpoint: "query", body: httpQueryBody, accept: "application/json, text/jsonl", status: 406},
		{name: "UID mismatch", endpoint: "query", body: strings.ReplaceAll(httpQueryBody, `"uid":"ds"`, `"uid":"other"`), status: 400},
		{name: "health", endpoint: "health"},
		{name: "unhealthy", endpoint: "health", fail: true, status: 400},
		{name: "resource", endpoint: "resources", body: "payload", status: 201},
		{name: "resource error", endpoint: "resources", body: "payload", fail: true, status: 500},
		{name: "resource body limit", endpoint: "resources", body: "payload exceeding limit", limit: true, status: 413},
		{name: "conversion", endpoint: "queryconvert", body: httpQueryBody},
		{name: "empty conversion", endpoint: "queryconvert", body: `{}`, status: 400},
		{name: "malformed conversion", endpoint: "queryconvert", body: `{`, status: 400},
		{name: "conversion mixed types", endpoint: "queryconvert", body: strings.TrimSuffix(httpQueryBody, `]}`) + `,{"refId":"B","datasource":{"uid":"ds","type":"loki"}}]}`, status: 400},
		{name: "conversion mixed UIDs", endpoint: "queryconvert", body: strings.TrimSuffix(httpQueryBody, `]}`) + `,{"refId":"B","datasource":{"uid":"other","type":"prometheus"}}]}`, status: 400},
		{name: "conversion missing reference", endpoint: "queryconvert", body: strings.TrimSuffix(httpQueryBody, `]}`) + `,{"refId":"B"}]}`, status: 400},
		{name: "conversion body limit", endpoint: "queryconvert", body: httpQueryBody, limit: true, status: 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			frame := data.NewFrame("test", data.NewField("value", nil, []float64{1}))
			client, err := backend.HandlerFromMiddlewares(backend.Handlers{
				QueryDataHandler: backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
					require.Equal(t, "stacks-11", request.NamespaceValue(ctx))
					if tc.fail {
						return nil, errors.New("plugin failed")
					}
					return &backend.QueryDataResponse{Responses: map[string]backend.DataResponse{"A": {Frames: data.Frames{frame}}}}, nil
				}),
				CheckHealthHandler: backend.CheckHealthHandlerFunc(func(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
					status := backend.HealthStatusOk
					if tc.fail {
						status = backend.HealthStatusError
					}
					return &backend.CheckHealthResult{Status: status, Message: "health", JSONDetails: []byte(`{"detail":true}`)}, nil
				}),
				CallResourceHandler: backend.CallResourceHandlerFunc(func(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
					require.Equal(t, "nested/resources/path?match=up", req.URL)
					require.Equal(t, []byte("payload"), req.Body)
					if tc.fail {
						return errors.New("resource failed")
					}
					return sender.Send(&backend.CallResourceResponse{Status: 201, Headers: map[string][]string{"X-Upstream": {"test"}}, Body: []byte("resource body")})
				}),
				ConversionHandler: httpConversionFunc(func(context.Context, *backend.ConversionRequest) (*backend.ConversionResponse, error) {
					return &backend.ConversionResponse{Objects: []backend.RawObject{{ContentType: "application/json", Raw: []byte(`{"refId":"A","expr":"converted"}`)}}}, nil
				}),
			})
			require.NoError(t, err)
			provider := &resourceMockDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{UID: "ds", Type: "prometheus"}}
			if tc.missing {
				provider.instanceSettingsErr = datasources.ErrDataSourceNotFound
			}
			pc := &resourceMockContextProvider{pluginCtx: backend.PluginContext{PluginID: "prometheus", DataSourceInstanceSettings: provider.instanceSettings}}
			b, err := NewDataSourceAPIBuilder("prometheus.datasource.grafana.app", plugins.JSONData{ID: "prometheus"}, client, provider, pc, nil, nil, DataSourceAPIBuilderConfig{HandlerOrigin: "remote"}, nil, nil)
			require.NoError(t, err)
			h := NewHTTPHandlers(HTTPHandlerOptions{
				Group:           b.GetGroupVersion().Group,
				PluginID:        "prometheus",
				HandlerOrigin:   "remote",
				Client:          client,
				ContextProvider: pc,
				PluginContext: func(ctx context.Context, uid string) (backend.PluginContext, error) {
					return ResolvePluginContext(ctx, "prometheus", uid, provider.GetInstanceSettings, pc)
				},
			})
			var connector rest.Connecter
			var direct http.HandlerFunc
			switch tc.endpoint {
			case "query":
				connector = &subQueryREST{builder: b}
				direct = h.Query
			case "health":
				connector = &subHealthREST{builder: b}
				direct = h.Health
			case "resources":
				connector = &subResourceREST{builder: b}
				direct = h.Resource
			case "queryconvert":
				connector = &queryConvertREST{client: client, contextProvider: pc}
				direct = h.Convert
			}
			scheme := runtime.NewScheme()
			require.NoError(t, b.InstallSchema(scheme))
			codecs := serializer.NewCodecFactory(scheme)
			responses := make([]*httptest.ResponseRecorder, 2)
			for i := range responses {
				r := httptest.NewRequest("POST", "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-11/datasources/ds/"+tc.endpoint, strings.NewReader(tc.body))
				if tc.endpoint == "resources" {
					r.URL.Path += "/nested/resources/path"
					r.URL.RawQuery = "match=up"
				}
				r.Header.Set("Content-Type", "application/json")
				r.Header.Set("Accept", "application/json")
				if tc.accept != "" {
					r.Header.Set("Accept", tc.accept)
				}
				if tc.contentType != "" {
					r.Header.Set("Content-Type", tc.contentType)
				}
				if tc.limit {
					r.Body = http.MaxBytesReader(nil, r.Body, 10)
				}
				r.SetPathValue("uid", "ds")
				r = r.WithContext(request.WithNamespace(r.Context(), "stacks-11"))
				w := httptest.NewRecorder()
				responses[i] = w
				if i == 0 {
					direct(w, r)
					continue
				}
				reply := negotiatedResponder{w: w, r: r, gv: b.GetGroupVersion(), codecs: codecs}
				uid := "ds"
				if tc.endpoint == "queryconvert" {
					uid = "name"
				}
				handler, err := connector.Connect(r.Context(), uid, nil, reply)
				if err != nil {
					reply.Error(err)
				} else {
					handler.ServeHTTP(w, r)
				}
			}
			a, bresp := responses[0], responses[1]
			status := tc.status
			if status == 0 {
				status = http.StatusOK
			}
			require.Equal(t, status, a.Code, a.Body.String())
			require.Equal(t, bresp.Code, a.Code, a.Body.String())
			require.Equal(t, bresp.Header(), a.Header())
			require.Equal(t, bresp.Flushed, a.Flushed)
			if a.Header().Get("Content-Type") == "application/json" {
				require.JSONEq(t, bresp.Body.String(), a.Body.String())
			} else {
				require.Equal(t, bresp.Body.String(), a.Body.String())
			}
		})
	}
}

func TestHTTPErrorStatusCompatibility(t *testing.T) {
	for _, err := range []error{
		errors.New("ordinary error"), apierrors.NewUnauthorized("invalid token"),
		apierrors.NewForbidden(schema.GroupResource{Group: "test", Resource: "datasources"}, "ds", errors.New("denied")),
		apierrors.NewNotFound(schema.GroupResource{Group: "test", Resource: "datasources"}, "ds"),
		apierrors.NewTooManyRequests("busy", 1), apierrors.NewRequestEntityTooLargeError("too large"), apierrors.NewTimeoutError("timed out", 0),
	} {
		t.Run(err.Error(), func(t *testing.T) {
			r := httptest.NewRequest("POST", "/", nil)
			direct, legacy := httptest.NewRecorder(), httptest.NewRecorder()
			WriteHTTPError(direct, r, err)
			scheme := runtime.NewScheme()
			scheme.AddKnownTypes(schema.GroupVersion{Version: "v1"}, &metav1.Status{})
			codecs := serializer.NewCodecFactory(scheme)
			responsewriters.ErrorNegotiated(err, codecs, schema.GroupVersion{Version: "v1"}, legacy, r)
			require.Equal(t, legacy.Code, direct.Code)
			require.Equal(t, legacy.Header().Get("Retry-After"), direct.Header().Get("Retry-After"))
			require.JSONEq(t, legacy.Body.String(), direct.Body.String())
		})
	}
}

func TestHTTPJSONDoesNotMutateEnvelope(t *testing.T) {
	frame := data.NewFrame("test", data.NewField("value", nil, []float64{1}))
	obj := &dsV0.QueryDataResponse{TypeMeta: metav1.TypeMeta{Kind: "Original"}, QueryDataResponse: backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{"A": {Frames: data.Frames{frame}}},
	}}
	for _, group := range []string{"prometheus.datasource.grafana.app", "alias.datasource.grafana.app"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "/", nil)
		jsonResponder{w: w, r: r, group: group}.Object(200, obj)
		require.True(t, json.Valid(w.Body.Bytes()))
		require.Equal(t, metav1.TypeMeta{Kind: "Original"}, obj.TypeMeta)
		require.Same(t, frame, obj.Responses["A"].Frames[0])
	}
}
