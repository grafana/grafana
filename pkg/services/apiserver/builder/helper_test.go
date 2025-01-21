package builder_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/services/apiserver"
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
			config := server.NewRecommendedConfig(apiserver.Codecs)
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

func (m *mockAPIGroupPostStartHookProvider) UpdateAPIGroupInfo(apiGroupInfo *server.APIGroupInfo, opts builder.APIGroupOptions) error {
	return nil
}

func (m *mockAPIGroupPostStartHookProvider) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return nil
}

func (m *mockAPIGroupPostStartHookProvider) GetAuthorizer() authorizer.Authorizer {
	return nil
}
