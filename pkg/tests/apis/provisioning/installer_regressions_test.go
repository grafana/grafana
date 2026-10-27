package provisioning

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_SettingsServedInEveryVersion(t *testing.T) {
	helper := sharedHelper(t)

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run(version, func(t *testing.T) {
			rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
				Method: http.MethodGet,
				Path:   "/apis/" + provisioning.GROUP + "/" + version + "/namespaces/default/settings",
				User:   helper.Org1.Admin,
			}, &provisioning.RepositoryViewList{})
			require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
		})
	}
}

func TestIntegrationProvisioning_CreateIgnoresTheStatusSentByTheClient(t *testing.T) {
	helper := sharedHelper(t)

	obj := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), common.TestRepo{
		Name:          "create-with-status",
		SyncTarget:    "instance",
		Path:          helper.ProvisioningPath,
		WorkflowsJSON: "[]",
	})
	// a field the controller never writes, so a leftover value can only come from the request
	require.NoError(t, unstructured.SetNestedField(obj.Object, "sent-by-the-client", "status", "deleteError"))

	created, err := helper.Repositories.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = helper.Repositories.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})

	deleteError, _, err := unstructured.NestedString(created.Object, "status", "deleteError")
	require.NoError(t, err)
	assert.Empty(t, deleteError, "a created repository must start with a clean status")
}
