package conversion

import (
	"context"
	"testing"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
)

type identityRequiredDataSourceProvider struct {
	schemaversion.DataSourceIndexProvider
}

func (p identityRequiredDataSourceProvider) Index(ctx context.Context) *schemaversion.DatasourceIndex {
	if _, err := identity.GetRequester(ctx); err != nil {
		return &schemaversion.DatasourceIndex{}
	}
	return p.DataSourceIndexProvider.Index(ctx)
}

type identityRequiredLibraryElementProvider struct {
	schemaversion.LibraryElementIndexProvider
}

func (p identityRequiredLibraryElementProvider) GetLibraryElementInfo(ctx context.Context) []schemaversion.LibraryElementInfo {
	if _, err := identity.GetRequester(ctx); err != nil {
		return nil
	}
	return p.LibraryElementIndexProvider.GetLibraryElementInfo(ctx)
}

func initIdentityRequiredMigrator(t *testing.T) (identityRequiredDataSourceProvider, identityRequiredLibraryElementProvider) {
	t.Helper()

	dsProvider := identityRequiredDataSourceProvider{migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)}
	leProvider := identityRequiredLibraryElementProvider{migrationtestutil.NewTestLibraryElementProvider()}
	migration.ResetForTesting()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)
	return dsProvider, leProvider
}

func newIdentityRequiredScheme(t *testing.T) *runtime.Scheme {
	t.Helper()

	dsProvider, leProvider := initIdentityRequiredMigrator(t)
	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

func TestMigrate_WithoutIdentityWritesDatasourceNameIntoUID(t *testing.T) {
	initIdentityRequiredMigrator(t)

	dash := map[string]interface{}{
		"title":         "Datasource by name",
		"schemaVersion": 32,
		"panels": []interface{}{
			map[string]interface{}{
				"id":         1,
				"type":       "timeseries",
				"datasource": "Non Default Test Datasource Name",
				"targets":    []interface{}{map[string]interface{}{"refId": "A"}},
			},
		},
	}

	ctx := request.WithNamespace(context.Background(), "org-2")
	require.NoError(t, migration.Migrate(ctx, dash, schemaversion.LATEST_VERSION))

	panels, ok := dash["panels"].([]interface{})
	require.True(t, ok)
	require.Len(t, panels, 1)
	panel, ok := panels[0].(map[string]interface{})
	require.True(t, ok)
	ds, ok := panel["datasource"].(map[string]interface{})
	require.True(t, ok, "panel datasource should be a reference, got %v", panel["datasource"])
	assert.Equal(t, "Non Default Test Datasource Name", ds["uid"])
	assert.Nil(t, ds["type"])
}

func TestConvertDashboard_V0_to_V1_ResolvesDatasourceNamesWithServiceIdentity(t *testing.T) {
	scheme := newIdentityRequiredScheme(t)

	v0Dash := &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "datasource-by-name"},
		Spec: dashv0.DashboardSpec{
			Object: map[string]interface{}{
				"title":         "Datasource by name",
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"type":       "timeseries",
						"datasource": "Non Default Test Datasource Name",
						"targets":    []interface{}{map[string]interface{}{"refId": "A"}},
					},
				},
			},
		},
	}

	var v1Dash dashv1.Dashboard
	require.NoError(t, scheme.Convert(v0Dash, &v1Dash, nil))

	panels, ok := v1Dash.Spec.Object["panels"].([]interface{})
	require.True(t, ok)
	require.Len(t, panels, 1)
	panel, ok := panels[0].(map[string]interface{})
	require.True(t, ok)
	ds, ok := panel["datasource"].(map[string]interface{})
	require.True(t, ok, "panel datasource should be a reference, got %v", panel["datasource"])
	assert.Equal(t, "non-default-test-ds-uid", ds["uid"])
	assert.Equal(t, "loki", ds["type"])
}

func TestConvertDashboard_V1_to_V2alpha1_ResolvesLibraryPanelRepeatWithServiceIdentity(t *testing.T) {
	scheme := newIdentityRequiredScheme(t)

	v1Dash := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "library-panel-repeat"},
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"title":         "Library panel repeat",
				"schemaVersion": schemaversion.LATEST_VERSION,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"gridPos": map[string]interface{}{"x": 0, "y": 0, "w": 8, "h": 5},
						"libraryPanel": map[string]interface{}{
							"uid":  "lib-panel-repeat-h",
							"name": "Library Panel with Horizontal Repeat",
						},
					},
				},
			},
		},
	}

	var v2Dash dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(v1Dash, &v2Dash, nil))

	require.NotNil(t, v2Dash.Spec.Layout.GridLayoutKind)
	items := v2Dash.Spec.Layout.GridLayoutKind.Spec.Items
	require.Len(t, items, 1)
	repeat := items[0].Spec.Repeat
	require.NotNil(t, repeat, "the library panel definition's repeat should be copied onto the grid item")
	assert.Equal(t, "server", repeat.Value)
	require.NotNil(t, repeat.Direction)
	assert.Equal(t, dashv2alpha1.DashboardRepeatOptionsDirectionH, *repeat.Direction)
}
