package provisioning

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
)

func TestIntegrationProvisioning_ConnectionCRUDL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	t.Run("should perform CRUDL requests on connection", func(t *testing.T) {
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
		// CREATE
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.NoError(t, err, "failed to create resource")

		// READ
		output, err := helper.Connections.Resource.Get(ctx, "connection", metav1.GetOptions{})
		require.NoError(t, err, "failed to read back resource")
		assert.Equal(t, "connection", output.GetName(), "name should be equal")
		assert.Equal(t, "default", output.GetNamespace(), "namespace should be equal")
		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, "github", spec["type"], "type should be equal")
		assert.Equal(t, "https://github.com/settings/installations/454545", spec["url"], "url should be equal")
		require.Contains(t, spec, "github")
		githubInfo := spec["github"].(map[string]any)
		assert.Equal(t, "123456", githubInfo["appID"], "appID should be equal")
		assert.Equal(t, "454545", githubInfo["installationID"], "installationID should be equal")
		require.Contains(t, output.Object, "secure", "object should contain secure")
		assert.Contains(t, output.Object["secure"], "privateKey", "secure should contain PrivateKey")

		// LIST
		list, err := helper.Connections.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list resource")
		assert.Equal(t, 1, len(list.Items), "should have one connection")
		assert.Equal(t, "connection", list.Items[0].GetName(), "name should be equal")

		// UPDATE
		updatedConnection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "github",
				"github": map[string]any{
					"appID":          "456789",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		res, err := helper.Connections.Resource.Update(ctx, updatedConnection, metav1.UpdateOptions{})
		require.NoError(t, err, "failed to update resource")
		spec = res.Object["spec"].(map[string]any)
		require.Contains(t, spec, "github")
		githubInfo = spec["github"].(map[string]any)
		assert.Equal(t, "456789", githubInfo["appID"], "appID should be updated")

		// DELETE
		require.NoError(t, helper.Connections.Resource.Delete(ctx, "connection", metav1.DeleteOptions{}), "failed to delete resource")
		list, err = helper.Connections.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list resources")
		assert.Equal(t, 0, len(list.Items), "should have no connections")
	})

	t.Run("viewer can't create or get connection", func(t *testing.T) {
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

		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("connections").
			Body(connection).
			Do(t.Context())

		require.NotNil(t, result.Error())
		err := &k8serrors.StatusError{}
		require.True(t, errors.As(result.Error(), &err))
		assert.Equal(t, metav1.StatusReasonForbidden, err.Status().Reason)
		assert.Contains(t, err.Status().Message, "User \"viewer\" cannot create resource \"connections\"")
		assert.Contains(t, err.Status().Message, "admin role is required")

		result = helper.ViewerREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection").
			Do(t.Context())
		require.NotNil(t, result.Error())
		err = &k8serrors.StatusError{}
		require.True(t, errors.As(result.Error(), &err))
		assert.Equal(t, metav1.StatusReasonForbidden, err.Status().Reason)
		assert.Contains(t, err.Status().Message, "User \"viewer\" cannot get resource \"connections\"")
		assert.Contains(t, err.Status().Message, "admin role is required")
	})
}

func TestIntegrationProvisioning_ConnectionValidation(t *testing.T) {
	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	t.Run("should fail when type is empty", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "type must be specified")
	})

	t.Run("should fail when type is invalid", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "some-invalid-type",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "spec.type: Unsupported value: \"some-invalid-type\"")
	})

	t.Run("should fail when type is github but 'github' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "github",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "github info must be specified for GitHub connection")
	})

	t.Run("should fail when type is github but private key is not there", func(t *testing.T) {
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
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey must be specified for GitHub connection")
	})

	t.Run("should fail when type is github but a client Secret is specified", func(t *testing.T) {
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
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "clientSecret is forbidden in GitHub connection")
	})

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
		assert.Contains(t, err.Error(), "bitbucket info must be specified in Bitbucket connection")
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
		assert.Contains(t, err.Error(), "gitlab info must be specified in Gitlab connection")
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

func TestIntegrationConnectionController_HealthCheckUpdates(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections(namespace)

	t.Run("health check gets updated after initial creation", func(t *testing.T) {
		// Create a connection using unstructured (like other connection tests)
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-health",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"type": "github",
				"github": map[string]any{
					"appID":          "12345",
					"installationID": "67890",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "test-private-key",
				},
			},
		}}

		createdUnstructured, err := helper.Connections.Resource.Create(ctx, connUnstructured, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for initial reconciliation - controller should update status
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0 &&
				updated.Status.State == provisioning.ConnectionStateConnected &&
				updated.Status.Health.Healthy
		}, 10*time.Second, 500*time.Millisecond, "connection should be initially reconciled with health status")

		// Verify initial health check was set
		initial, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.True(t, initial.Status.Health.Healthy, "connection should be healthy")
		assert.Equal(t, provisioning.ConnectionStateConnected, initial.Status.State, "connection should be connected")
		assert.Greater(t, initial.Status.Health.Checked, int64(0), "health check timestamp should be set")
		assert.Equal(t, initial.Generation, initial.Status.ObservedGeneration, "observed generation should match")
	})

	t.Run("health check updates when spec changes", func(t *testing.T) {
		// Create a connection using unstructured
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-spec-change",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"type": "github",
				"github": map[string]any{
					"appID":          "11111",
					"installationID": "22222",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "test-private-key-2",
				},
			},
		}}

		createdUnstructured, err := helper.Connections.Resource.Create(ctx, connUnstructured, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for initial reconciliation
		var initialHealthChecked int64
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			if updated.Status.ObservedGeneration == updated.Generation {
				initialHealthChecked = updated.Status.Health.Checked
				return true
			}
			return false
		}, 10*time.Second, 500*time.Millisecond, "connection should be initially reconciled")

		// Get the latest version before updating to avoid conflicts with controller updates
		latestUnstructured, err := helper.Connections.Resource.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)

		// Update the connection spec using the latest version
		updatedUnstructured := latestUnstructured.DeepCopy()
		githubSpec := updatedUnstructured.Object["spec"].(map[string]any)["github"].(map[string]any)
		githubSpec["appID"] = "99999"
		_, err = helper.Connections.Resource.Update(ctx, updatedUnstructured, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Wait for reconciliation after spec change
		require.Eventually(t, func() bool {
			reconciled, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return reconciled.Status.ObservedGeneration == reconciled.Generation &&
				reconciled.Status.Health.Checked > initialHealthChecked
		}, 10*time.Second, 500*time.Millisecond, "connection should be reconciled after spec change")

		// Verify health check was updated
		final, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, final.Generation, final.Status.ObservedGeneration, "observed generation should match generation")
		assert.Greater(t, final.Status.Health.Checked, initialHealthChecked, "health check should be updated after spec change")
		assert.True(t, final.Status.Health.Healthy, "connection should remain healthy")
	})
}

func TestIntegrationProvisioning_RepositoryFieldSelectorByConnection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}

	// Create a connection first
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-conn-for-field-selector",
			"namespace": "default",
		},
		"spec": map[string]any{
			"type": "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "789012",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": "test-private-key",
			},
		},
	}}

	_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
	require.NoError(t, err, "failed to create connection")

	t.Cleanup(func() {
		// Clean up repositories first
		_ = helper.Repositories.Resource.Delete(ctx, "repo-with-connection", metav1.DeleteOptions{})
		_ = helper.Repositories.Resource.Delete(ctx, "repo-without-connection", metav1.DeleteOptions{})
		_ = helper.Repositories.Resource.Delete(ctx, "repo-with-different-connection", metav1.DeleteOptions{})
		// Then clean up the connection
		_ = helper.Connections.Resource.Delete(ctx, "test-conn-for-field-selector", metav1.DeleteOptions{})
	})

	// Create a repository WITH the connection
	repoWithConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-with-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo With Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
			"connection": map[string]any{
				"name": "test-conn-for-field-selector",
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithConnection, createOptions)
	require.NoError(t, err, "failed to create repository with connection")

	// Create a repository WITHOUT the connection
	repoWithoutConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-without-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo Without Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithoutConnection, createOptions)
	require.NoError(t, err, "failed to create repository without connection")

	// Create a repository with a DIFFERENT connection name (non-existent)
	repoWithDifferentConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-with-different-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo With Different Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
			"connection": map[string]any{
				"name": "some-other-connection",
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithDifferentConnection, createOptions)
	require.NoError(t, err, "failed to create repository with different connection")

	t.Run("filter repositories by spec.connection.name", func(t *testing.T) {
		// List repositories with field selector for the specific connection
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.connection.name=test-conn-for-field-selector",
		})
		require.NoError(t, err, "failed to list repositories with field selector")

		// Should only return the repository with the matching connection
		assert.Len(t, list.Items, 1, "should return exactly one repository")
		assert.Equal(t, "repo-with-connection", list.Items[0].GetName(), "should return the correct repository")
	})

	t.Run("filter repositories by non-existent connection returns empty", func(t *testing.T) {
		// List repositories with field selector for a non-existent connection
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.connection.name=non-existent-connection",
		})
		require.NoError(t, err, "failed to list repositories with field selector")

		// Should return empty list
		assert.Len(t, list.Items, 0, "should return no repositories for non-existent connection")
	})

	t.Run("filter repositories by empty connection name", func(t *testing.T) {
		// List repositories with field selector for empty connection (repos without connection)
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.connection.name=",
		})
		require.NoError(t, err, "failed to list repositories with empty connection field selector")

		// Should return the repository without a connection
		assert.Len(t, list.Items, 1, "should return exactly one repository without connection")
		assert.Equal(t, "repo-without-connection", list.Items[0].GetName(), "should return the repository without connection")
	})

	t.Run("list all repositories without field selector", func(t *testing.T) {
		// List all repositories without field selector
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list all repositories")

		// Should return all three repositories
		assert.Len(t, list.Items, 3, "should return all three repositories")

		names := make([]string, len(list.Items))
		for i, item := range list.Items {
			names[i] = item.GetName()
		}
		assert.Contains(t, names, "repo-with-connection")
		assert.Contains(t, names, "repo-without-connection")
		assert.Contains(t, names, "repo-with-different-connection")
	})
}
