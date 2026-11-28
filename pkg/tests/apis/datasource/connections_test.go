package datasource

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationConnectionsDoNotInferManagerFromReadOnly(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	grafanaDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // start the datasource api servers
			featuremgmt.FlagDatasourceUseNewCRUDAPIs,             // registers the datasource api groups and the unified storage overlay
			featuremgmt.FlagQueryService,                         // query.grafana.app group
			featuremgmt.FlagQueryServiceWithConnections,          // connections endpoint
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"datasources.grafana-testdata-datasource.datasource.grafana.app": {
				DualWriterMode: grafanarest.Mode3,
			},
		},
	})

	provisioningFile := filepath.Join(grafanaDir, "conf", "provisioning", "datasources", "connections.yaml")
	require.NoError(t, os.WriteFile(provisioningFile, []byte(`apiVersion: 1
datasources:
  - name: Provisioned
    uid: provisioned
    type: grafana-testdata-datasource
    access: proxy
    editable: false
`), 0o600))

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		Dir:     grafanaDir,
		DirPath: cfgPath,
	})

	client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
		Group:    "grafana-testdata-datasource.datasource.grafana.app",
		Version:  "v0alpha1",
		Resource: "datasources",
	}).Namespace("default")
	_, err := client.Create(context.Background(), &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "grafana-testdata-datasource.datasource.grafana.app/v0alpha1",
			"kind":       "DataSource",
			"metadata":   map[string]any{"name": "api-read-only"},
			"spec": map[string]any{
				"title":    "API read only",
				"readOnly": true,
			},
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   "/apis/query.grafana.app/v0alpha1/namespaces/default/connections",
	}, &datasourceV0alpha1.DataSourceConnectionList{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))

	// Read-only is also what a non-editable provisioned datasource looks like in SQL, so neither is reported as managed
	found := map[string]bool{}
	for _, item := range rsp.Result.Items {
		found[item.Name] = true
		require.NotContains(t, item.Annotations, utils.AnnoKeyManagerKind, item.Name)
		require.NotContains(t, item.Annotations, utils.AnnoKeyManagerAllowsEdits, item.Name)
	}
	require.True(t, found["provisioned"])
	require.True(t, found["api-read-only"])
}
