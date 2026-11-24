package routermiddleware

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// The in-process connection controller reads and patches connections through
// one loopback client. With the router middleware on, it must still reconcile:
// status patches carry the provisioning requester, which the router would
// otherwise route without the loopback credentials.
func TestIntegrationConnectionController_HealthCheckWithRouterMiddleware(t *testing.T) {
	helper := sharedHelper(t)

	conn := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-connection-router",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Router Middleware Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "12345",
				"installationID": "67890",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM)),
			},
		},
	}}

	created, err := helper.CreateGithubConnection(t, conn)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = helper.Connections.Resource.Delete(context.WithoutCancel(t.Context()), created.GetName(), metav1.DeleteOptions{})
	})

	helper.WaitForHealthyConnection(t, created.GetName())
}
