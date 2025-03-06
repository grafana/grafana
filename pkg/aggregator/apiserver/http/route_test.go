package http_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	httphandler "github.com/grafana/grafana/pkg/aggregator/apiserver/http"
	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/component-base/tracing"
)

func TestRouteHandler(t *testing.T) {
	serviceHandler := newMockHandler(http.StatusOK, []byte("service called"))
	httpServer := httptest.NewServer(serviceHandler)
	defer httpServer.Close()
	service := aggregationv0alpha1.DataPlaneService{
		Spec: aggregationv0alpha1.DataPlaneServiceSpec{
			Group:   "example.grafana.app",
			Version: "v1",
			Backend: aggregationv0alpha1.Backend{
				Type:    aggregationv0alpha1.BackendTypeHTTP,
				BaseURL: httpServer.URL,
			},
			Services: []aggregationv0alpha1.Service{
				{
					Type:   aggregationv0alpha1.RouteServiceType,
					Method: http.MethodGet,
					Path:   "/test/{name}/example",
				},
				{
					Type:   aggregationv0alpha1.RouteServiceType,
					Method: http.MethodPost,
					Path:   "/test",
				},
				{
					Type: aggregationv0alpha1.RouteServiceType,
					Path: "/all",
				},
			},
		},
	}
	tests := []struct {
		name                 string
		req                  func() *http.Request
		expectServiceCalled  bool
		expectDelegateCalled bool
		expectedReqBody      []byte
	}{
		{
			name: "GET request to GET route should be proxied",
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/test/12345/example", nil)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  true,
			expectDelegateCalled: false,
		},
		{
			name: "GET request to GET route with query params should be proxied",
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/test/12345/example?foo=bar", nil)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  true,
			expectDelegateCalled: false,
		},
		{
			name: "POST request to GET route should not be proxied",
			req: func() *http.Request {
				bodyRaw := []byte(`should not be sent`)
				body := bytes.NewBuffer(bodyRaw)
				r := httptest.NewRequest(http.MethodPost, "/apis/example.grafana.app/v1/namespaces/default/test/12345/example", body)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  false,
			expectDelegateCalled: true,
		},
		{
			name: "POST request to POST route should be proxied",
			req: func() *http.Request {
				bodyRaw := []byte(`example body`)
				body := bytes.NewBuffer(bodyRaw)
				r := httptest.NewRequest(http.MethodPost, "/apis/example.grafana.app/v1/namespaces/default/test", body)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  true,
			expectDelegateCalled: false,
			expectedReqBody:      []byte(`example body`),
		},
		{
			name: "GET request to route without method should be proxied",
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/all", nil)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  true,
			expectDelegateCalled: false,
		},
		{
			name: "POST request to route without method should be proxied",
			req: func() *http.Request {
				bodyRaw := []byte(`no method`)
				body := bytes.NewBuffer(bodyRaw)
				r := httptest.NewRequest(http.MethodPost, "/apis/example.grafana.app/v1/namespaces/default/all", body)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  true,
			expectDelegateCalled: false,
			expectedReqBody:      []byte(`no method`),
		},
		{
			name: "request to incorrect route without method should not be proxied",
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/all/{test}", nil)
				u := user.DefaultInfo{Name: "test-user", UID: "12345"}
				r = r.WithContext(request.WithUser(r.Context(), &u))
				return r
			},
			expectServiceCalled:  false,
			expectDelegateCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer serviceHandler.reset()
			delegateHandler := newMockHandler(http.StatusNotFound, []byte("not found"))
			httpHandler := httphandler.NewHTTPHandler(tracing.NewNoopTracerProvider(), *service.DeepCopy(), delegateHandler)
			w := httptest.NewRecorder()
			httpHandler.ServeHTTP(w, tt.req())
			assert.Equal(t, tt.expectDelegateCalled, delegateHandler.called)
			assert.Equal(t, tt.expectServiceCalled, serviceHandler.called)
			if tt.expectServiceCalled {
				assert.Equal(t, "service called", w.Body.String())
				assert.Equal(t, tt.req().URL.String(), serviceHandler.requestedURL)
			}
			if len(tt.expectedReqBody) > 0 {
				assert.Equal(t, tt.expectedReqBody, serviceHandler.requestBody)
			}
		})
	}
}

type mockHandler struct {
	called       bool
	requestedURL string
	requestBody  []byte
	err          error
	respStatus   int
	resp         []byte
}

func newMockHandler(status int, resp []byte) *mockHandler {
	return &mockHandler{
		respStatus: status,
		resp:       resp,
	}
}

func (m *mockHandler) reset() {
	m.called = false
	m.requestedURL = ""
	m.err = nil
}

func (m *mockHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.called = true
	m.requestedURL = r.URL.String()
	m.requestBody = make([]byte, r.ContentLength)
	if r.Body != nil {
		_, _ = r.Body.Read(m.requestBody)
		r.Body.Close()
	}
	w.WriteHeader(m.respStatus)
	_, m.err = w.Write(m.resp)
}
