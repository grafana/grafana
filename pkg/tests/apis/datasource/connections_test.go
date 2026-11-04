package datasource

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationConnectionsAnnotations(t *testing.T) {
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

	helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: helper.Org1.OrgID,
		Name:  "Created",
		UID:   "created",
		Type:  datasources.DS_TESTDATA,
	})

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   "/apis/query.grafana.app/v0alpha1/namespaces/default/connections",
	}, &datasourceV0alpha1.DataSourceConnectionList{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))

	annotations := map[string]map[string]string{}
	for _, item := range rsp.Result.Items {
		annotations[item.Name] = item.Annotations
	}

	require.Equal(t, map[string]string{
		utils.AnnoKeyManagerKind:        string(utils.ManagerKindClassicFP), // nolint:staticcheck
		utils.AnnoKeyManagerAllowsEdits: "false",
	}, annotations["provisioned"])
	require.Empty(t, annotations["created"])
}
