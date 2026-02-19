package builder_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func TestAddPostStartHooks(t *testing.T) {
	tests := []struct {
		name      string
		builders  []builder.APIGroupBuilder
		wantErr   bool
		wantHooks []string
	}{
		{
			name:     "no builders",
			builders: []builder.APIGroupBuilder{},
			wantErr:  false,
		},
		{
			name: "builder without post start hooks",
			builders: []builder.APIGroupBuilder{
				&mockAPIGroupPostStartHookProvider{},
			},
			wantErr: false,
		},
		{
			name: "builder with post start hooks",
			builders: []builder.APIGroupBuilder{
				&mockAPIGroupPostStartHookProvider{
					hooks: map[string]server.PostStartHookFunc{
						"test-hook": func(server.PostStartHookContext) error { return nil },
					},
				},
			},
			wantErr:   false,
			wantHooks: []string{"test-hook"},
		},
		{
			name: "builder with post start hook provider error",
			builders: []builder.APIGroupBuilder{
				&mockAPIGroupPostStartHookProvider{
					hooks: map[string]server.PostStartHookFunc{},
					err:   errors.New("hook provider error"),
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			scheme := builder.ProvideScheme()
			codecs := builder.ProvideCodecFactory(scheme)
			config := server.NewRecommendedConfig(codecs)
			err := builder.AddPostStartHooks(config, tt.builders)
			if tt.wantErr {
				require.Error(t, err)
			}

			if len(tt.wantHooks) > 0 {
				for _, hookName := range tt.wantHooks {
					_, ok := config.PostStartHooks[hookName]
					require.True(t, ok)
				}
			}
		})
	}
}

func TestRedirection(t *testing.T) {
	mockHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(r.URL.Path))
		require.NoError(t, err)
	})
	handler := filters.WithPathRewriters(mockHandler, builder.PathRewriters)
	tests := []struct {
		name   string
		url    string
		expect string
	}{
		{
			name:   "query to datasource",
			url:    "/apis/query.grafana.app/v0alpha1/namespaces/default/connections",
			expect: "/apis/datasource.grafana.app/v0alpha1/namespaces/default/connections",
		}, {
			name:   "query to datasource (with name hack)",
			url:    "/apis/query.grafana.app/v0alpha1/namespaces/default/query",
			expect: "/apis/datasource.grafana.app/v0alpha1/namespaces/default/query/name",
		}, {
			name:   "query sqlschemas",
			url:    "/apis/query.grafana.app/v0alpha1/namespaces/default/sqlschemas",
			expect: "/apis/datasource.grafana.app/v0alpha1/namespaces/default/query/sqlschemas",
		}, {
			name:   "name hack in datasource service",
			url:    "/apis/datasource.grafana.app/v0alpha1/namespaces/default/query",
			expect: "/apis/datasource.grafana.app/v0alpha1/namespaces/default/query/name", // hack :(
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest("GET", tt.url, nil)
			assert.NoError(t, err)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusOK, rr.Code)
			assert.Equal(t, tt.expect, rr.Body.String())
		})
	}
}

var _ builder.APIGroupBuilder = &mockAPIGroupPostStartHookProvider{}
var _ builder.APIGroupPostStartHookProvider = &mockAPIGroupPostStartHookProvider{}

type mockAPIGroupPostStartHookProvider struct {
	hooks map[string]server.PostStartHookFunc
	err   error
}

func (m *mockAPIGroupPostStartHookProvider) GetPostStartHooks() (map[string]server.PostStartHookFunc, error) {
	return m.hooks, m.err
}

func (m *mockAPIGroupPostStartHookProvider) GetGroupVersion() schema.GroupVersion {
	return schema.GroupVersion{}
}

func (m *mockAPIGroupPostStartHookProvider) InstallSchema(scheme *runtime.Scheme) error {
	return nil
}

func (m *mockAPIGroupPostStartHookProvider) AllowedV0Alpha1Resources() []string {
	return nil
}

func (m *mockAPIGroupPostStartHookProvider) UpdateAPIGroupInfo(apiGroupInfo *server.APIGroupInfo, opts builder.APIGroupOptions) error {
	return nil
}

func (m *mockAPIGroupPostStartHookProvider) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return nil
}

func (m *mockAPIGroupPostStartHookProvider) GetAuthorizer() authorizer.Authorizer {
	return nil
}
