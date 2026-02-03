package datasource_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/api/datasource"
	queryV0 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// mockRestConfigProvider implements DirectRestConfigProvider for testing connectionClientImpl
type mockRestConfigProvider struct {
	host string
}

func (m *mockRestConfigProvider) GetDirectRestConfig(_ *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Host: m.host,
	}
}

func (m *mockRestConfigProvider) DirectlyServeHTTP(_ http.ResponseWriter, _ *http.Request) {}

// createTestReqContext creates a minimal ReqContext for testing
func createTestReqContext(t *testing.T, orgID int64) *contextmodel.ReqContext {
	t.Helper()
	httpReq := httptest.NewRequest(http.MethodGet, "/", nil)
	return &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{
			OrgID: orgID,
		},
		Context: &web.Context{Req: httpReq},
	}
}

// createConnectionResponse creates a K8s API response for a DataSourceConnection
func createConnectionResponse(uid, title, group string) []byte {
	conn := queryV0.DataSourceConnection{
		Title: title,
		Datasource: queryV0.DataSourceConnectionRef{
			Group:   group,
			Version: "v1",
			Name:    uid,
		},
	}
	conn.Name = uid
	conn.Kind = "DataSourceConnection"
	conn.APIVersion = "query.grafana.app/v0alpha1"

	data, _ := json.Marshal(conn)
	return data
}

func TestGetConnectionByUID(t *testing.T) {
	tests := []struct {
		name           string
		uid            string
		serverResponse func(w http.ResponseWriter, r *http.Request)
		wantErr        bool
		errContains    string
		wantTitle      string
	}{
		{
			name: "successful fetch",
			uid:  "test-ds-uid",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "/apis/query.grafana.app/v0alpha1/namespaces/default/connections/test-ds-uid", r.URL.Path)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(createConnectionResponse("test-ds-uid", "Test Datasource", "prometheus.datasource.grafana.app"))
			},
			wantErr:   false,
			wantTitle: "Test Datasource",
		},
		{
			name: "not found",
			uid:  "nonexistent-uid",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","metadata":{},"status":"Failure","message":"connections \"nonexistent-uid\" not found","reason":"NotFound","details":{"name":"nonexistent-uid","kind":"connections"},"code":404}`))
			},
			wantErr:     true,
			errContains: "not found",
		},
		{
			name: "server error",
			uid:  "error-uid",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","metadata":{},"status":"Failure","message":"internal server error","reason":"InternalError","code":500}`))
			},
			wantErr:     true,
			errContains: "failed to get connection",
		},
		{
			name: "unmarshal error",
			uid:  "bad-response-uid",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				// return valid JSON but with wrong structure - title is a number instead of a string
				_, _ = w.Write([]byte(`{"apiVersion":"query.grafana.app/v0alpha1","kind":"DataSourceConnection","metadata":{"name":"bad-response-uid"},"title":12345}`))
			},
			wantErr:     true,
			errContains: "failed to unmarshal connection",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
			defer server.Close()

			client := datasource.NewConnectionClient(&setting.Cfg{}, &mockRestConfigProvider{host: server.URL})

			reqCtx := createTestReqContext(t, 1)
			conn, err := client.GetConnectionByUID(reqCtx, tt.uid)

			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errContains)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, conn)
			require.Equal(t, tt.wantTitle, conn.Title)
		})
	}
}

func TestGetConnectionByTypeAndUID(t *testing.T) {
	tests := []struct {
		name         string
		pluginType   string
		uid          string
		expectedPath string
	}{
		{
			name:         "prometheus type",
			pluginType:   "prometheus",
			uid:          "my-prom-ds",
			expectedPath: "/apis/query.grafana.app/v0alpha1/namespaces/default/connections/prometheus.datasource.grafana.app:my-prom-ds",
		},
		{
			name:         "testdata type",
			pluginType:   "grafana-testdata-datasource",
			uid:          "test-ds",
			expectedPath: "/apis/query.grafana.app/v0alpha1/namespaces/default/connections/grafana-testdata-datasource.datasource.grafana.app:test-ds",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var capturedPath string

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				capturedPath = r.URL.Path
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				group := tt.pluginType + ".datasource.grafana.app"
				_, _ = w.Write(createConnectionResponse(tt.uid, "Test DS", group))
			}))
			defer server.Close()

			client := datasource.NewConnectionClient(&setting.Cfg{}, &mockRestConfigProvider{host: server.URL})

			reqCtx := createTestReqContext(t, 1)
			conn, err := client.GetConnectionByTypeAndUID(reqCtx, tt.pluginType, tt.uid)

			require.NoError(t, err)
			require.NotNil(t, conn)
			require.Equal(t, tt.expectedPath, capturedPath)
		})
	}
}
