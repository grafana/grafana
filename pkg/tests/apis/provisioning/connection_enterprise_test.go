//go:build enterprise
// +build enterprise

package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationProvisioning_ConnectionEnterpriseValidation(t *testing.T) {
	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	t.Run("should fail when type is bitbucket but 'bitbucket' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "bitbucket",
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "invalid bitbucket connection")
	})

	t.Run("should fail when type is bitbucket but client secret is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "bitbucket",
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "clientSecret must be specified for Bitbucket connection")
	})

	t.Run("should fail when type is bitbucket but a private key is specified", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "bitbucket",
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey is forbidden in Bitbucket connection")
	})

	t.Run("should fail when type is gitlab but 'gitlab' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "gitlab",
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "invalid gitlab connection")
	})

	t.Run("should fail when type is gitlab but client secret is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "gitlab",
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "clientSecret must be specified for Gitlab connection")
	})

	t.Run("should fail when type is gitlab but a private key is specified", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "gitlab",
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey is forbidden in Gitlab connection")
	})
}
