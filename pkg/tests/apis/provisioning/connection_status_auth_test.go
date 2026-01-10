package provisioning

import (
	"context"
	"encoding/base64"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_ConnectionStatusAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection for testing
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "connection-status-test",
			"namespace": "default",
		},
		"spec": map[string]any{
			"type": "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}
	err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err)


	t.Run("admin can GET connection status", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection-status-test").
			SubResource("status").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to GET connection status")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("editor cannot GET connection status", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection-status-test").
			SubResource("status").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to GET connection status")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot GET connection status", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection-status-test").
			SubResource("status").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to GET connection status")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
