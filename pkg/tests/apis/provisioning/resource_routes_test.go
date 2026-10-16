package provisioning

import (
	"encoding/base64"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioningapi "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_PerKindRoutes(t *testing.T) {
	helper := sharedHelper(t)
	connectionName := "per-kind-routes"
	privateKey := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))
	_, err := helper.CreateGithubConnection(t, &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioningapi.APIVERSION,
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connectionName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Per-kind route test",
			"type":  provisioningapi.GitHubRepositoryType,
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{"create": privateKey},
		},
	}})
	require.NoError(t, err)

	basePath := "/apis/" + provisioningapi.GROUP + "/" + provisioningapi.VERSION + "/namespaces/default/connections/"
	keys := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
		Method: http.MethodPost,
		Path:   basePath + "list-keys",
		User:   helper.Org1.Admin,
		Body:   []byte(`{}`),
	}, &metav1.PartialObjectMetadataList{})
	require.Equal(t, http.StatusOK, keys.Response.StatusCode, string(keys.Body))
	require.NotNil(t, keys.Result)
	names := make([]string, 0, len(keys.Result.Items))
	for _, item := range keys.Result.Items {
		names = append(names, item.Name)
	}
	assert.Contains(t, names, connectionName)

	search := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
		Method: http.MethodPost,
		Path:   basePath + "search",
		User:   helper.Org1.Admin,
		Body: []byte(`{
			"apiVersion":"search.grafana.app/v0alpha1",
			"kind":"SearchQuery"
		}`),
	}, &searchv0.SearchResults{})
	require.Equal(t, http.StatusOK, search.Response.StatusCode, string(search.Body))
	require.NotNil(t, search.Result)
	searchNames := make([]string, 0, len(search.Result.Items))
	for _, item := range search.Result.Items {
		searchNames = append(searchNames, item.Resource.Name)
	}
	assert.Contains(t, searchNames, connectionName)
}
