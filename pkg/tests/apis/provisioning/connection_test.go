package provisioning

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationProvisioning_CreatingAndGettingConnections(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	t.Run("should create and retrieve connection", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
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
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.NoError(t, err, "failed to create resource")

		output, err := helper.Connections.Resource.Get(ctx, "connection", metav1.GetOptions{})
		require.NoError(t, err, "failed to read back resource")

		assert.Equal(t, "connection", output.GetName(), "name should be equal")
		assert.Equal(t, "default", output.GetNamespace(), "namespace should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, "github", spec["type"], "type should be equal")

		require.Contains(t, spec, "github")
		githubInfo := spec["github"].(map[string]any)
		assert.Equal(t, "123456", githubInfo["appID"], "appID should be equal")
		assert.Equal(t, "454545", githubInfo["installationID"], "installationID should be equal")

		require.Contains(t, output.Object, "secure", "object should contain secure")
		assert.Contains(t, output.Object["secure"], "privateKey", "secure should contain PrivateKey")
	})
}
