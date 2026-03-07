package datasource

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestLegacyStorageValidateURL(t *testing.T) {
	tests := []struct {
		name        string
		pluginType  string
		url         string
		wantErr     bool
		errContains string
	}{
		{
			name:        "empty URL for required type returns error",
			pluginType:  datasources.DS_PROMETHEUS,
			url:         "",
			wantErr:     true,
			errContains: "URL is required",
		},
		{
			name:       "empty URL for optional type passes",
			pluginType: "grafana-testdata-datasource",
			url:        "",
			wantErr:    false,
		},
		{
			name:       "valid URL passes",
			pluginType: datasources.DS_PROMETHEUS,
			url:        "http://localhost:9090",
			wantErr:    false,
		},
		{
			name:       "URL without protocol passes (prepends http)",
			pluginType: datasources.DS_PROMETHEUS,
			url:        "localhost:9090",
			wantErr:    false,
		},
		{
			name:       "valid MSSQL connection string passes",
			pluginType: "mssql",
			url:        "server:1433",
			wantErr:    false,
		},
		{
			name:       "MSSQL connection string with instance passes",
			pluginType: "mssql",
			url:        `server\instance:1433`,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &legacyStorage{
				pluginType: tt.pluginType,
			}

			err := s.validateURL(tt.url)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestLegacyStorageUpdatePreservesSecureValues(t *testing.T) {
	oldDS := &v0alpha1.DataSource{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-uid",
			Namespace: "default",
		},
		Spec: v0alpha1.UnstructuredSpec{},
		Secure: common.InlineSecureValues{
			"password": common.InlineSecureValue{
				Name: "existing-secret-ref",
			},
			"apiKey": common.InlineSecureValue{
				Name: "existing-apikey-ref",
			},
		},
	}
	oldDS.Spec.SetTitle("Test DS").SetAccess("proxy").SetURL("http://localhost:9090")

	// New datasource from update request has NO secure values (nil map)
	newDS := &v0alpha1.DataSource{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-uid",
			Namespace: "default",
		},
		Spec:   v0alpha1.UnstructuredSpec{},
		Secure: nil, // This is the key - nil secure map
	}
	newDS.Spec.SetTitle("Updated DS").SetAccess("proxy").SetURL("http://localhost:9090")

	mockProvider := &mockUpdateProvider{
		getResult:    oldDS,
		updateResult: nil, // Will be set from input
	}

	resourceInfo := v0alpha1.DataSourceResourceInfo.WithGroupAndShortName(
		"test.datasource.grafana.app", "test",
	)

	s := &legacyStorage{
		datasources:  mockProvider,
		resourceInfo: &resourceInfo,
		pluginType:   "test",
	}

	// This should NOT panic even though newDS.Secure is nil
	result, created, err := s.Update(
		context.Background(),
		"test-uid",
		&simpleUpdateObjectInfo{obj: newDS},
		nil,
		nil,
		false,
		&metav1.UpdateOptions{},
	)

	require.NoError(t, err)
	assert.False(t, created)

	// Verify the updated datasource has the old secure values preserved
	updatedDS, ok := result.(*v0alpha1.DataSource)
	require.True(t, ok)
	require.NotNil(t, updatedDS.Secure)
	assert.Len(t, updatedDS.Secure, 2)
	assert.Equal(t, "existing-secret-ref", updatedDS.Secure["password"].Name)
	assert.Equal(t, "existing-apikey-ref", updatedDS.Secure["apiKey"].Name)
}

// mockUpdateProvider implements PluginDatasourceProvider for testing Update
type mockUpdateProvider struct {
	getResult    *v0alpha1.DataSource
	updateResult *v0alpha1.DataSource
}

func (m *mockUpdateProvider) GetDataSource(ctx context.Context, uid string) (*v0alpha1.DataSource, error) {
	return m.getResult, nil
}

func (m *mockUpdateProvider) UpdateDataSource(ctx context.Context, ds *v0alpha1.DataSource) (*v0alpha1.DataSource, error) {
	// Return the input as the result (simulating successful update)
	return ds, nil
}

func (m *mockUpdateProvider) CreateDataSource(ctx context.Context, ds *v0alpha1.DataSource) (*v0alpha1.DataSource, error) {
	return nil, nil
}

func (m *mockUpdateProvider) DeleteDataSource(ctx context.Context, uid string) error {
	return nil
}

func (m *mockUpdateProvider) ListDataSources(ctx context.Context) (*v0alpha1.DataSourceList, error) {
	return nil, nil
}

func (m *mockUpdateProvider) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	return nil, nil
}

// simpleUpdateObjectInfo implements rest.UpdatedObjectInfo for testing
type simpleUpdateObjectInfo struct {
	obj *v0alpha1.DataSource
}

func (s *simpleUpdateObjectInfo) Preconditions() *metav1.Preconditions {
	return nil
}

func (s *simpleUpdateObjectInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	return s.obj, nil
}
