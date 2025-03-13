package runner

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestAppBuilder_validateCustomRouteRequest(t *testing.T) {
	tests := []struct {
		name        string
		id          app.CustomRouteIdentifier
		requestInfo *request.RequestInfo
		method      string
		wantErr     string
	}{
		{
			name: "missing namespace",
			id: app.CustomRouteIdentifier{
				ResourceIdentifier: resource.FullIdentifier{
					Group:   "test",
					Version: "v1",
					Plural:  "tests",
				},
			},
			requestInfo: &request.RequestInfo{
				APIGroup:   "test",
				APIVersion: "v1",
				Resource:   "tests",
			},
			method:  "GET",
			wantErr: "namespace not found in request",
		},
		{
			name: "method not allowed",
			id: app.CustomRouteIdentifier{
				ResourceIdentifier: resource.FullIdentifier{
					Group:   "test",
					Version: "v1",
					Plural:  "tests",
				},
				Method: "GET",
			},
			requestInfo: &request.RequestInfo{
				APIGroup:   "test",
				APIVersion: "v1",
				Resource:   "tests",
				Namespace:  "default",
			},
			method:  "POST",
			wantErr: "method not allowed",
		},
		{
			name: "group mismatch",
			id: app.CustomRouteIdentifier{
				ResourceIdentifier: resource.FullIdentifier{
					Group:   "test",
					Version: "v1",
					Plural:  "tests",
				},
			},
			requestInfo: &request.RequestInfo{
				APIGroup:   "wrong-group",
				APIVersion: "v1",
				Resource:   "tests",
				Namespace:  "default",
			},
			method:  "GET",
			wantErr: "group mismatch: expected test, got wrong-group",
		},
		{
			name: "version mismatch",
			id: app.CustomRouteIdentifier{
				ResourceIdentifier: resource.FullIdentifier{
					Group:   "test",
					Version: "v1",
					Plural:  "tests",
				},
			},
			requestInfo: &request.RequestInfo{
				APIGroup:   "test",
				APIVersion: "v2",
				Resource:   "tests",
				Namespace:  "default",
			},
			method:  "GET",
			wantErr: "version mismatch: expected v1, got v2",
		},
		{
			name: "resource mismatch",
			id: app.CustomRouteIdentifier{
				ResourceIdentifier: resource.FullIdentifier{
					Group:   "test",
					Version: "v1",
					Plural:  "tests",
				},
			},
			requestInfo: &request.RequestInfo{
				APIGroup:   "test",
				APIVersion: "v1",
				Resource:   "wrong-resource",
				Namespace:  "default",
			},
			method:  "GET",
			wantErr: "resource mismatch: expected tests, got wrong-resource",
		},
		{
			name: "subresource mismatch",
			id: app.CustomRouteIdentifier{
				ResourceIdentifier: resource.FullIdentifier{
					Group:   "test",
					Version: "v1",
					Plural:  "tests",
				},
				SubresourcePath: "metadata",
			},
			requestInfo: &request.RequestInfo{
				APIGroup:    "test",
				APIVersion:  "v1",
				Resource:    "tests",
				Namespace:   "default",
				Subresource: "wrong-subresource",
			},
			method:  "GET",
			wantErr: "subresource mismatch: expected metadata, got wrong-subresource",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &appBuilder{}
			err := b.validateCustomRouteRequest(tt.id, tt.requestInfo, tt.method)
			if tt.wantErr != "" {
				require.Error(t, err)
				require.Equal(t, tt.wantErr, err.Error())
				return
			}
			require.NoError(t, err)
		})
	}
}

type testCase struct {
	request          *http.Request
	name             string
	app              *mockCustomRouteApp
	want             *builder.APIRoutes
	expectedResponse string
	expectedStatus   int
	expectedHeaders  map[string][]string
}

func TestAppBuilder_GetAPIRoutes(t *testing.T) {
	tests := []testCase{
		{
			name: "empty custom routes",
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{},
			},
			want: &builder.APIRoutes{
				Root:      []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{},
			},
			expectedResponse: "",
			expectedStatus:   0,
			expectedHeaders:  nil,
		},
		{
			name:    "single custom route",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: `{"metadata":"value"}`,
			expectedStatus:   http.StatusOK,
			expectedHeaders:  nil,
		},
		{
			name:    "missing namespace",
			request: httptest.NewRequest("GET", "/apis/test/v1/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Bad Request\n",
			expectedStatus:   http.StatusBadRequest,
			expectedHeaders:  nil,
		},
		{
			name:    "request body handling",
			request: httptest.NewRequest("POST", "/apis/test/v1/namespaces/default/tests/metadata", strings.NewReader(`{"test":"body"}`)),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "POST",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       req.Body,
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: `{"test":"body"}`,
			expectedStatus:   http.StatusOK,
			expectedHeaders:  nil,
		},
		{
			name:    "error handling",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return nil, fmt.Errorf("test error")
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Internal Server Error\n",
			expectedStatus:   http.StatusInternalServerError,
			expectedHeaders:  nil,
		},
		{
			name:    "response headers",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
							Headers: map[string][]string{
								"X-Test-Header": {"test-value"},
							},
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: `{"metadata":"value"}`,
			expectedStatus:   http.StatusOK,
			expectedHeaders: map[string][]string{
				"X-Test-Header": {"test-value"},
			},
		},
		{
			name:    "error reading request body",
			request: httptest.NewRequest("POST", "/apis/test/v1/namespaces/default/tests/metadata", &errorReader{}),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "POST",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       req.Body,
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Bad Request\n",
			expectedStatus:   http.StatusBadRequest,
			expectedHeaders:  nil,
		},
		{
			name:    "multiple response headers",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
							Headers: map[string][]string{
								"X-Test-Header":  {"test-value-1", "test-value-2"},
								"X-Other-Header": {"other-value"},
							},
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: `{"metadata":"value"}`,
			expectedStatus:   http.StatusOK,
			expectedHeaders: map[string][]string{
				"X-Test-Header":  {"test-value-1", "test-value-2"},
				"X-Other-Header": {"other-value"},
			},
		},
		{
			name:    "error writing response body",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: `{"metadata":"value"}`,
			expectedStatus:   http.StatusOK,
			expectedHeaders:  nil,
		},
		{
			name:    "group mismatch",
			request: httptest.NewRequest("GET", "/apis/wrong-group/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Bad Request\n",
			expectedStatus:   http.StatusBadRequest,
			expectedHeaders:  nil,
		},
		{
			name:    "version mismatch",
			request: httptest.NewRequest("GET", "/apis/test/v2/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Bad Request\n",
			expectedStatus:   http.StatusBadRequest,
			expectedHeaders:  nil,
		},
		{
			name:    "resource mismatch",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/wrong-resource/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Bad Request\n",
			expectedStatus:   http.StatusBadRequest,
			expectedHeaders:  nil,
		},
		{
			name:    "nil request body",
			request: httptest.NewRequest("POST", "/apis/test/v1/namespaces/default/tests/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "POST",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "{\"metadata\":\"value\"}",
			expectedStatus:   http.StatusOK,
			expectedHeaders:  nil,
		},
		{
			name:    "verify full identifier fields",
			request: httptest.NewRequest("GET", "/apis/test/v1/namespaces/default/tests/test1/metadata", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Kind:    "Test",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						info := fmt.Sprintf("namespace=%s,name=%s,group=%s,version=%s,kind=%s,plural=%s",
							req.ResourceIdentifier.Namespace,
							req.ResourceIdentifier.Name,
							req.ResourceIdentifier.Group,
							req.ResourceIdentifier.Version,
							req.ResourceIdentifier.Kind,
							req.ResourceIdentifier.Plural)
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(info),
							StatusCode: http.StatusOK,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "namespace=default,name=test1,group=test,version=v1,kind=Test,plural=tests",
			expectedStatus:   http.StatusOK,
			expectedHeaders:  nil,
		},
		{
			name:    "invalid k8s path",
			request: httptest.NewRequest("GET", "/api/v1/proxy", nil),
			app: &mockCustomRouteApp{
				routes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
					{
						ResourceIdentifier: resource.FullIdentifier{
							Group:   "test",
							Version: "v1",
							Plural:  "tests",
						},
						Method:          "GET",
						SubresourcePath: "metadata",
					}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
						return &app.ResourceCustomRouteResponse{
							Body:       []byte(`{"metadata":"value"}`),
							StatusCode: 200,
						}, nil
					},
				},
			},
			want: &builder.APIRoutes{
				Root: []builder.APIRouteHandler{},
				Namespace: []builder.APIRouteHandler{
					{
						Path: "tests/metadata",
					},
				},
			},
			expectedResponse: "Bad Request\n",
			expectedStatus:   http.StatusBadRequest,
			expectedHeaders:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &appBuilder{
				app:    tt.app,
				logger: log.New("test"),
			}

			got := b.GetAPIRoutes()

			// Compare number of routes
			require.Equal(t, len(tt.want.Root), len(got.Root))
			require.Equal(t, len(tt.want.Namespace), len(got.Namespace))

			// For namespace routes, verify paths match
			for i := range tt.want.Namespace {
				require.Equal(t, tt.want.Namespace[i].Path, got.Namespace[i].Path)
				require.NotNil(t, got.Namespace[i].Handler)

				// Test the handler if present
				if len(tt.app.routes) > 0 {
					w := httptest.NewRecorder()
					r := tt.request
					got.Namespace[i].Handler.ServeHTTP(w, r)
					require.Equal(t, tt.expectedStatus, w.Code)
					require.Equal(t, tt.expectedResponse, w.Body.String())
					// Check headers if expected
					if tt.expectedHeaders != nil {
						actualHeaders := w.Header()
						// Remove default headers from http.Error
						delete(actualHeaders, "Content-Type")
						delete(actualHeaders, "X-Content-Type-Options")
						// Convert http.Header to map[string][]string
						actualMap := make(map[string][]string)
						for k, v := range actualHeaders {
							actualMap[k] = v
						}
						require.Equal(t, tt.expectedHeaders, actualMap)
					}
				}
			}
		})
	}
}

// errorReader implements io.Reader and always returns an error
type errorReader struct{}

func (r *errorReader) Read(p []byte) (n int, err error) {
	return 0, fmt.Errorf("EOF")
}

type mockCustomRouteApp struct {
	app.App
	routes map[app.CustomRouteIdentifier]app.CustomRouteHandler
}

func (m *mockCustomRouteApp) CustomRoutes() map[app.CustomRouteIdentifier]app.CustomRouteHandler {
	return m.routes
}
