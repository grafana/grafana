package baasbridge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

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
		if req.Object.GetName() == "alices" && req.UserInfo.Username != "alice" {
			return errors.New("only alice may write alices")
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
		if r.PathValue("name") == "large" {
			_, _ = w.Write(bytes.Repeat([]byte("0123456789"), 10_000))
			return
		}
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
	client, err := NewClient(host, httpTestManifest(), Options{RouteCredentials: httpTestCredentials})
	require.NoError(t, err)
	return client
}

func httpTestManifest() *app.ManifestData {
	ops := []app.AdmissionOperation{app.AdmissionOperationCreate, app.AdmissionOperationUpdate}
	return &app.ManifestData{Group: httpTestGroup, Versions: []app.ManifestVersion{{
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

func TestClientWebhookPaths(t *testing.T) {
	operator, _ := newHTTPTestOperator(t)
	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/hooks")
		operator.Config.Handler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	manifest := httpTestManifest()
	manifest.Operator = &app.ManifestOperatorInfo{Webhooks: &app.ManifestOperatorWebhookProperties{
		ConversionPath: "/hooks/convert",
		MutationPath:   "/hooks/mutate",
	}}
	client, err := NewClient(server.URL, manifest, Options{})
	require.NoError(t, err)

	rsp, err := client.AdmissionReview(t.Context(), httpTestAdmissionRequest("Widget", "example"))
	require.NoError(t, err)
	require.True(t, rsp.GetAllowed(), rsp.GetError().GetMessage())
	target := &pluginv3.GroupVersionKind{}
	target.SetGroup(httpTestGroup)
	target.SetVersion("v0alpha1")
	target.SetKind("Widget")
	req := &pluginv3.ConvertObjectsRequest{}
	req.SetTarget(target)
	req.SetObjects([][]byte{[]byte(`{"apiVersion":"` + httpTestGroup + `/v1","kind":"Widget","metadata":{"name":"a"}}`)})
	conv, err := client.ConvertObjects(t.Context(), req)
	require.NoError(t, err)
	require.Nil(t, conv.GetError())
	require.Equal(t, []string{"/hooks/mutate", "/validate", "/hooks/convert"}, paths)
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
// The caller the API server authenticated reaches the operator, which may
// decide on it.
func TestClientAdmissionReviewUserInfo(t *testing.T) {
	server, _ := newHTTPTestOperator(t)
	client := newHTTPTestClient(t, server.URL)

	rsp, err := client.AdmissionReview(t.Context(), httpTestAdmissionRequest("Gadget", "alices"))
	require.NoError(t, err)
	require.False(t, rsp.GetAllowed())

	ctx := request.WithUser(t.Context(), &user.DefaultInfo{Name: "alice", UID: "u-1", Groups: []string{"editors"}})
	rsp, err = client.AdmissionReview(ctx, httpTestAdmissionRequest("Gadget", "alices"))
	require.NoError(t, err)
	require.True(t, rsp.GetAllowed(), rsp.GetError().GetMessage())
}

func TestClientAdmissionReviewTimeout(t *testing.T) {
	previous := admissionTimeout
	admissionTimeout = 50 * time.Millisecond
	t.Cleanup(func() { admissionTimeout = previous })
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() { close(release) })

	_, err := newHTTPTestClient(t, server.URL).AdmissionReview(t.Context(), httpTestAdmissionRequest("Widget", "example"))
	require.Equal(t, codes.DeadlineExceeded, status.Code(err), "counted against the backend like a gRPC deadline")
}

// The conversion response is checked as apiextensions-apiserver checks it.
func TestClientConvertObjectsResponseChecks(t *testing.T) {
	target := &pluginv3.GroupVersionKind{}
	target.SetGroup(httpTestGroup)
	target.SetVersion("v0alpha1")
	for name, tt := range map[string]struct {
		respond func(apiextensionsv1.ConversionReview) apiextensionsv1.ConversionReview
		check   func(t *testing.T, rsp *pluginv3.ConvertObjectsResponse, err error)
	}{
		"a status other than Success fails": {
			respond: func(in apiextensionsv1.ConversionReview) apiextensionsv1.ConversionReview {
				in.Response = &apiextensionsv1.ConversionResponse{UID: in.Request.UID}
				return in
			},
			check: func(t *testing.T, rsp *pluginv3.ConvertObjectsResponse, err error) {
				require.NoError(t, err)
				require.Equal(t, metav1.StatusFailure, rsp.GetError().GetStatus())
				require.Contains(t, rsp.GetError().GetMessage(), "not \"Success\"")
			},
		},
		"a response to another request fails": {
			respond: func(in apiextensionsv1.ConversionReview) apiextensionsv1.ConversionReview {
				in.Response = &apiextensionsv1.ConversionResponse{UID: "other", Result: metav1.Status{Status: metav1.StatusSuccess}}
				return in
			},
			check: func(t *testing.T, _ *pluginv3.ConvertObjectsResponse, err error) {
				require.ErrorContains(t, err, "answered request \"other\"")
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var review apiextensionsv1.ConversionReview
				require.NoError(t, json.NewDecoder(r.Body).Decode(&review))
				_ = json.NewEncoder(w).Encode(tt.respond(review))
			}))
			t.Cleanup(server.Close)
			req := &pluginv3.ConvertObjectsRequest{}
			req.SetTarget(target)
			req.SetObjects([][]byte{[]byte(`{}`)})
			rsp, err := newHTTPTestClient(t, server.URL).ConvertObjects(t.Context(), req)
			tt.check(t, rsp, err)
		})
	}
}

// A body larger than one chunk arrives whole, over several responses.
func TestClientCallRouteLargeBody(t *testing.T) {
	server, _ := newHTTPTestOperator(t)
	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/namespaces/default/widgets/large/render")
	stream, err := newHTTPTestClient(t, server.URL).CallRoute(t.Context(), req)
	require.NoError(t, err)
	var body []byte
	chunks := 0
	for {
		msg, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		require.LessOrEqual(t, len(msg.GetBody()), routeChunkBytes)
		body = append(body, msg.GetBody()...)
		chunks++
	}
	require.Equal(t, bytes.Repeat([]byte("0123456789"), 10_000), body)
	require.Greater(t, chunks, 1)
}

// A caller that stops receiving releases the response when its request ends.
func TestClientCallRouteAbandoned(t *testing.T) {
	disconnected := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("first"))
		w.(http.Flusher).Flush()
		<-r.Context().Done()
		close(disconnected)
	}))
	t.Cleanup(server.Close)

	ctx, cancel := context.WithCancel(t.Context())
	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/stream")
	stream, err := newHTTPTestClient(t, server.URL).CallRoute(ctx, req)
	require.NoError(t, err)
	_, err = stream.Recv()
	require.NoError(t, err)
	chunk, err := stream.Recv()
	require.NoError(t, err)
	require.Equal(t, "first", string(chunk.GetBody()))

	cancel()
	select {
	case <-disconnected:
	case <-time.After(5 * time.Second):
		t.Fatal("the operator's response was never released")
	}
}

// An operator that sends its headers and then waits, as a watch does, has them
// relayed before any body.
func TestClientCallRouteHeadersFirst(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json;stream=watch")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() { close(release) })

	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/watch")
	stream, err := newHTTPTestClient(t, server.URL).CallRoute(t.Context(), req)
	require.NoError(t, err)

	first := make(chan *pluginv3.CallRouteResponse, 1)
	go func() {
		msg, _ := stream.Recv()
		first <- msg
	}()
	select {
	case msg := <-first:
		require.Equal(t, int32(http.StatusOK), msg.GetCode())
		require.Equal(t, []string{"application/json;stream=watch"}, msg.GetHeaders()["Content-Type"].GetValues())
		require.Empty(t, msg.GetBody())
	case <-time.After(5 * time.Second):
		t.Fatal("the headers waited for the body")
	}
}

// A redirect is neither followed, which would carry the caller's credentials to
// its target, nor relayed: it is a 502, as from the router's proxies.
func TestClientCallRouteRedirect(t *testing.T) {
	var followed bool
	elsewhere := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { followed = true }))
	t.Cleanup(elsewhere.Close)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/apis/"+httpTestGroup+"/v1/cached" {
			w.Header().Set("ETag", `"v1"`)
			w.WriteHeader(http.StatusNotModified)
			return
		}
		http.Redirect(w, r, elsewhere.URL+"/steal", http.StatusFound)
	}))
	t.Cleanup(server.Close)
	client := newHTTPTestClient(t, server.URL)

	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/namespaces/default/widgets/example/render")
	_, err := client.CallRoute(t.Context(), req)
	var statusErr apierrors.APIStatus
	require.ErrorAs(t, err, &statusErr)
	require.Equal(t, int32(http.StatusBadGateway), statusErr.Status().Code)
	require.False(t, followed)

	req.SetUrl("/apis/" + httpTestGroup + "/v1/cached")
	stream, err := client.CallRoute(t.Context(), req)
	require.NoError(t, err, "a 304 is not a redirect")
	first, err := stream.Recv()
	require.NoError(t, err)
	require.Equal(t, int32(http.StatusNotModified), first.GetCode())

	_, err = client.AdmissionReview(t.Context(), httpTestAdmissionRequest("Widget", "example"))
	require.ErrorContains(t, err, "returned status 302", "webhooks do not follow redirects either")
	require.False(t, followed)
}

// The response-header timeout fails an operator that never answers, and leaves
// a body that streams after its headers unbounded.
func TestClientCallRouteResponseHeaderTimeout(t *testing.T) {
	const timeout = 100 * time.Millisecond
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/apis/"+httpTestGroup+"/v1/slow-body" {
			w.WriteHeader(http.StatusOK)
			w.(http.Flusher).Flush()
			time.Sleep(3 * timeout)
			_, _ = w.Write([]byte("late"))
			return
		}
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() { close(release) })
	client, err := NewClient(server.URL, nil, Options{HTTPClient: &http.Client{Transport: NewTransport(nil, timeout)}})
	require.NoError(t, err)

	req := &pluginv3.CallRouteRequest{}
	req.SetMethod(http.MethodGet)
	req.SetUrl("/apis/" + httpTestGroup + "/v1/hang")
	_, err = client.CallRoute(t.Context(), req)
	require.Equal(t, codes.DeadlineExceeded, status.Code(err), "counted against the backend like a gRPC deadline")

	req.SetUrl("/apis/" + httpTestGroup + "/v1/slow-body")
	stream, err := client.CallRoute(t.Context(), req)
	require.NoError(t, err)
	var body []byte
	for {
		msg, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		body = append(body, msg.GetBody()...)
	}
	require.Equal(t, "late", string(body))
}

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

func TestIsHTTPHost(t *testing.T) {
	for host, want := range map[string]bool{
		"http://op:8080":  true,
		"HTTPS://op:8443": true,
		"op:10000":        false,
		"dns:///op:10000": false,
		"httpop:10000":    false,
	} {
		require.Equal(t, want, IsHTTPHost(host), host)
	}
}

func TestNewClientRejectsInvalidHost(t *testing.T) {
	for _, host := range []string{"http://", "ftp://example.com", "http://%zz"} {
		_, err := NewClient(host, nil, Options{})
		require.Error(t, err, host)
	}
}
