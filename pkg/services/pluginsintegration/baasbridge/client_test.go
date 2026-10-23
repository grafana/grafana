package baasbridge

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-app-sdk/resource"
)

const httpTestGroup = "widgets.ext.grafana.app"

type httpTestSpec struct {
	Size string `json:"size"`
}

func httpTestKind(kind, version string) resource.Kind {
	return resource.Kind{
		Schema: resource.NewSimpleSchema(httpTestGroup, version, &resource.TypedSpecObject[httpTestSpec]{}, &resource.UntypedList{},
			resource.WithKind(kind), resource.WithScope(resource.NamespacedScope)),
		Codecs: map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()},
	}
}

type httpTestConverter struct{}

func (httpTestConverter) Convert(obj k8s.RawKind, target string) ([]byte, error) {
	out := map[string]any{}
	if err := json.Unmarshal(obj.Raw, &out); err != nil {
		return nil, err
	}
	out["apiVersion"] = target
	return json.Marshal(out)
}

// newHTTPTestOperator serves the app-sdk webhook handler, as an operator
// written for apiextensions-apiserver does. Widgets are mutated and validated;
// gadgets are only validated, so a /mutate call for one fails.
func newHTTPTestOperator(t *testing.T) (*httptest.Server, *[]string) {
	t.Helper()
	var calls []string
	handler := k8s.NewWebhookHandler(k8s.WebhookHandlerConfig{})
	validator := &resource.SimpleValidatingAdmissionController{ValidateFunc: func(_ context.Context, req *resource.AdmissionRequest) error {
		if req.Object.GetName() == "notallowed" {
			return errors.New("name 'notallowed' is not allowed")
		}
		if req.Kind == "Widget" && req.Object.GetAnnotations()["mutated"] != "true" {
			return errors.New("validation did not see the mutated object")
		}
		return nil
	}}
	handler.AddValidatingAdmissionController(validator, httpTestKind("Widget", "v1"))
	handler.AddValidatingAdmissionController(validator, httpTestKind("Gadget", "v1"))
	handler.AddMutatingAdmissionController(&resource.SimpleMutatingAdmissionController{MutateFunc: func(_ context.Context, req *resource.AdmissionRequest) (*resource.MutatingResponse, error) {
		req.Object.SetAnnotations(map[string]string{"mutated": "true"})
		return &resource.MutatingResponse{UpdatedObject: req.Object}, nil
	}}, httpTestKind("Widget", "v1"))
	handler.AddConverter(httpTestConverter{}, metav1.GroupKind{Group: httpTestGroup, Kind: "Widget"})

	mux := http.NewServeMux()
	handler.Register(mux)
	mux.HandleFunc("GET /apis/"+httpTestGroup+"/v1/namespaces/default/widgets/{name}/render", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Seen-Name", r.PathValue("name"))
		w.Header().Set("X-Seen-Extra", r.Header.Get("X-Remote-Extra-Scopes"))
		w.Header().Set("X-Seen-Upgrade", r.Header.Get("Upgrade"))
		w.Header().Set("X-Seen-Token", r.Header.Get("X-Access-Token"))
		w.Header().Set("X-Seen-Id", r.Header.Get("X-Grafana-Id"))
		w.Header().Set("X-Seen-Query", r.URL.RawQuery)
		w.Header().Set("X-Seen-Remote-User", r.Header.Get("X-Remote-User"))
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"message":"success"}`))
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.Path)
		if r.Header.Get("X-Access-Token") != "" || r.Header.Get("X-Grafana-Id") != "" {
			if !strings.HasPrefix(r.URL.Path, "/apis/") {
				http.Error(w, "webhooks get no caller credentials", http.StatusBadRequest)
				return
			}
		}
		mux.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	return server, &calls
}

func newHTTPTestClient(t *testing.T, host string) appclientv3.Client {
	t.Helper()
	ops := []app.AdmissionOperation{app.AdmissionOperationCreate, app.AdmissionOperationUpdate}
	manifest := &app.ManifestData{Group: httpTestGroup, Versions: []app.ManifestVersion{{
		Name: "v1",
		Kinds: []app.ManifestVersionKind{{
			Kind:   "Widget",
			Plural: "widgets",
			Admission: &app.AdmissionCapabilities{
				Validation: &app.ValidationCapability{Operations: ops},
				Mutation:   &app.MutationCapability{Operations: ops},
			},
		}, {
			Kind:   "Gadget",
			Plural: "gadgets",
			Admission: &app.AdmissionCapabilities{
				Validation: &app.ValidationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationAny}},
			},
		}},
	}}}
	client, err := NewClient(host, manifest, Options{RouteCredentials: httpTestCredentials})
	require.NoError(t, err)
	return client
}

// httpTestCredentials sets the headers the router sends a route for a requester.
func httpTestCredentials(ctx context.Context, header http.Header) error {
	if ctx.Value(httpTestNoCredentials{}) != nil {
		return errors.New("no requester")
	}
	header.Set("X-Access-Token", "caller-token")
	header.Set("X-Grafana-Id", "caller-id")
	return nil
}

type httpTestNoCredentials struct{}

func httpTestAdmissionRequest(kind, name string) *pluginv3.AdmissionReviewRequest {
	gvk := &pluginv3.GroupVersionKind{}
	gvk.SetGroup(httpTestGroup)
	gvk.SetVersion("v1")
	gvk.SetKind(kind)
	req := &pluginv3.AdmissionReviewRequest{}
	req.SetKind(gvk)
	req.SetOperation(pluginv3.AdmissionReviewRequest_OPERATION_CREATE)
	req.SetObjectBytes([]byte(`{"apiVersion":"` + httpTestGroup + `/v1","kind":"` + kind + `","metadata":{"name":"` + name + `","namespace":"default"},"spec":{"size":"big"}}`))
	return req
}

func TestClientAdmissionReview(t *testing.T) {
	t.Run("mutates, then validates the mutated object", func(t *testing.T) {
		server, calls := newHTTPTestOperator(t)
		rsp, err := newHTTPTestClient(t, server.URL).AdmissionReview(t.Context(), httpTestAdmissionRequest("Widget", "example"))
		require.NoError(t, err)
		require.True(t, rsp.GetAllowed(), rsp.GetError().GetMessage())
		mutated := map[string]any{}
		require.NoError(t, json.Unmarshal(rsp.GetObjectBytes(), &mutated))
		require.Equal(t, map[string]any{"mutated": "true"}, mutated["metadata"].(map[string]any)["annotations"])
		require.Equal(t, []string{"/mutate", "/validate"}, *calls)
	})

	t.Run("reports a denial", func(t *testing.T) {
		server, _ := newHTTPTestOperator(t)
		rsp, err := newHTTPTestClient(t, server.URL).AdmissionReview(t.Context(), httpTestAdmissionRequest("Widget", "notallowed"))
		require.NoError(t, err)
		require.False(t, rsp.GetAllowed())
		require.Equal(t, metav1.StatusFailure, rsp.GetError().GetStatus())
		require.Equal(t, "name 'notallowed' is not allowed", rsp.GetError().GetMessage())
	})

	t.Run("calls only the hooks the manifest declares", func(t *testing.T) {
		server, calls := newHTTPTestOperator(t)
		rsp, err := newHTTPTestClient(t, server.URL).AdmissionReview(t.Context(), httpTestAdmissionRequest("Gadget", "example"))
		require.NoError(t, err)
		require.True(t, rsp.GetAllowed(), rsp.GetError().GetMessage())
		require.Empty(t, rsp.GetObjectBytes())
		require.Equal(t, []string{"/validate"}, *calls)
	})

	t.Run("rejects a kind without declared hooks", func(t *testing.T) {
		server, calls := newHTTPTestOperator(t)
		_, err := newHTTPTestClient(t, server.URL).AdmissionReview(t.Context(), httpTestAdmissionRequest("Gizmo", "example"))
		require.ErrorContains(t, err, "declares no admission hooks")
		require.Empty(t, *calls)
	})
}

func TestClientConvertObjects(t *testing.T) {
	server, _ := newHTTPTestOperator(t)
	target := &pluginv3.GroupVersionKind{}
	target.SetGroup(httpTestGroup)
	target.SetVersion("v0alpha1")
	target.SetKind("Widget")
	req := &pluginv3.ConvertObjectsRequest{}
	req.SetTarget(target)
	req.SetUid("conversion-1")
	req.SetObjects([][]byte{
		[]byte(`{"apiVersion":"` + httpTestGroup + `/v1","kind":"Widget","metadata":{"name":"a"}}`),
		[]byte(`{"apiVersion":"` + httpTestGroup + `/v1","kind":"Widget","metadata":{"name":"b"}}`),
	})

	rsp, err := newHTTPTestClient(t, server.URL).ConvertObjects(t.Context(), req)
	require.NoError(t, err)
	require.Nil(t, rsp.GetError())
	require.Equal(t, "conversion-1", rsp.GetUid())
	require.Len(t, rsp.GetConverted(), 2)
	for i, name := range []string{"a", "b"} {
		require.JSONEq(t, `{"apiVersion":"`+httpTestGroup+`/v0alpha1","kind":"Widget","metadata":{"name":"`+name+`"}}`, string(rsp.GetConverted()[i].GetRaw()))
	}

	t.Run("reports a failure", func(t *testing.T) {
		req.SetObjects([][]byte{[]byte(`{"apiVersion":"` + httpTestGroup + `/v1","kind":"Gizmo","metadata":{"name":"a"}}`)})
		rsp, err := newHTTPTestClient(t, server.URL).ConvertObjects(t.Context(), req)
		require.NoError(t, err)
		require.Equal(t, metav1.StatusFailure, rsp.GetError().GetStatus())
		require.Equal(t, int32(http.StatusUnprocessableEntity), rsp.GetError().GetCode())
	})
}

func TestClientCallRoute(t *testing.T) {
	server, _ := newHTTPTestOperator(t)
	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/namespaces/default/widgets/example/render?pretty=true")
	req.SetHeaders(map[string]*pluginv3.StringList{
		"X-Remote-User":         pluginv3.StringList_builder{Values: []string{"admin"}}.Build(),
		"X-Access-Token":        pluginv3.StringList_builder{Values: []string{"Bearer spoofed"}}.Build(),
		"X-Remote-Extra-Scopes": pluginv3.StringList_builder{Values: []string{"admin"}}.Build(),
		"Upgrade":               pluginv3.StringList_builder{Values: []string{"websocket"}}.Build(),
	})

	stream, err := newHTTPTestClient(t, server.URL).CallRoute(t.Context(), req)
	require.NoError(t, err)
	first, err := stream.Recv()
	require.NoError(t, err)
	require.Equal(t, int32(http.StatusAccepted), first.GetCode())
	require.Equal(t, []string{"caller-token"}, first.GetHeaders()["X-Seen-Token"].GetValues(), "only the credentials func sets credentials")
	require.Equal(t, []string{"caller-id"}, first.GetHeaders()["X-Seen-Id"].GetValues())
	require.Equal(t, []string{"pretty=true"}, first.GetHeaders()["X-Seen-Query"].GetValues())
	require.Equal(t, []string{""}, first.GetHeaders()["X-Seen-Remote-User"].GetValues(), "credential headers are dropped")
	require.Equal(t, []string{""}, first.GetHeaders()["X-Seen-Extra"].GetValues(), "credential header prefixes are dropped")
	require.Equal(t, []string{""}, first.GetHeaders()["X-Seen-Upgrade"].GetValues(), "hop-by-hop headers are dropped")
	require.Equal(t, []string{"example"}, first.GetHeaders()["X-Seen-Name"].GetValues())
	body := first.GetBody()
	for {
		next, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		require.Zero(t, next.GetCode(), "only the first response carries the status")
		body = append(body, next.GetBody()...)
	}
	require.JSONEq(t, `{"message":"success"}`, string(body))
}

func TestClientUnavailable(t *testing.T) {
	server, _ := newHTTPTestOperator(t)
	client := newHTTPTestClient(t, server.URL)
	server.Close()

	_, err := client.AdmissionReview(t.Context(), httpTestAdmissionRequest("Widget", "example"))
	require.Equal(t, codes.Unavailable, status.Code(err))

	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/namespaces/default/widgets/example/render")
	_, err = client.CallRoute(t.Context(), req)
	require.Equal(t, codes.Unavailable, status.Code(err))
}

// The operator sees the path as the caller sent it, escapes included.
func TestClientCallRouteEscapedPath(t *testing.T) {
	server, _ := newHTTPTestOperator(t)
	for _, name := range []string{"a%2Fb", "100%25", "a%20b"} {
		req := &pluginv3.CallRouteRequest{}
		req.SetMethod(http.MethodGet)
		req.SetUrl("/apis/" + httpTestGroup + "/v1/namespaces/default/widgets/" + name + "/render")
		stream, err := newHTTPTestClient(t, server.URL).CallRoute(t.Context(), req)
		require.NoError(t, err, name)
		first, err := stream.Recv()
		require.NoError(t, err, name)
		require.Equal(t, int32(http.StatusAccepted), first.GetCode(), name)
		unescaped, err := url.PathUnescape(name)
		require.NoError(t, err)
		require.Equal(t, []string{unescaped}, first.GetHeaders()["X-Seen-Name"].GetValues(), name)
	}
}

func TestClientRouteCredentialsError(t *testing.T) {
	server, calls := newHTTPTestOperator(t)
	ctx := context.WithValue(t.Context(), httpTestNoCredentials{}, true)
	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/namespaces/default/widgets/example/render")
	_, err := newHTTPTestClient(t, server.URL).CallRoute(ctx, req)
	require.ErrorContains(t, err, "no requester")
	require.Empty(t, *calls, "the request is not sent")
}

func TestNewClientRejectsInvalidHost(t *testing.T) {
	for _, host := range []string{"http://", "ftp://example.com", "http://%zz"} {
		_, err := NewClient(host, nil, Options{})
		require.Error(t, err, host)
	}
}
