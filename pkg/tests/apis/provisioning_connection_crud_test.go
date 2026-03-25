package apis

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationV1Beta1ConnectionCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	// Get dynamic client for v1beta1
	client := helper.GetResourceClient(ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "provisioning.grafana.app",
			Version:  "v1beta1",
			Resource: "connections",
		},
	})

	ctx := context.Background()
	namespace := "default"

	// Test 1: Create a GitHub Connection
	t.Run("Create GitHub Connection", func(t *testing.T) {
		connection := &provisioning.Connection{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "provisioning.grafana.app/v1beta1",
				Kind:       "Connection",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-github-connection",
				Namespace: namespace,
			},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123456",
					InstallationID: "789012",
				},
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("test-token-value"),
				},
			},
		}

		unstructuredObj, err := toUnstructured(connection)
		require.NoError(t, err)

		created, err := client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Verify the created object
		createdConn, err := fromUnstructuredToConnection(created)
		require.NoError(t, err)
		require.NotEmpty(t, createdConn.UID)
		require.Equal(t, connection.Name, createdConn.Name)
		require.Equal(t, connection.Namespace, createdConn.Namespace)
		require.Equal(t, connection.Spec.Type, createdConn.Spec.Type)
		require.Equal(t, connection.Spec.GitHub.AppID, createdConn.Spec.GitHub.AppID)
		require.Equal(t, connection.Spec.GitHub.InstallationID, createdConn.Spec.GitHub.InstallationID)

		// Secure values should not be returned
		require.Nil(t, createdConn.Secure.Token.Create)
	})

	// Test 2: Get the created Connection
	t.Run("Get Connection", func(t *testing.T) {
		retrieved, err := client.Resource.Get(ctx, "test-github-connection", metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		retrievedConn, err := fromUnstructuredToConnection(retrieved)
		require.NoError(t, err)
		require.Equal(t, "test-github-connection", retrievedConn.Name)
		require.Equal(t, namespace, retrievedConn.Namespace)
		require.Equal(t, provisioning.GithubConnectionType, retrievedConn.Spec.Type)
	})

	// Test 3: List Connections
	t.Run("List Connections", func(t *testing.T) {
		list, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)
		require.GreaterOrEqual(t, len(list.Items), 1)

		// Find our connection in the list
		found := false
		for _, item := range list.Items {
			if item.GetName() == "test-github-connection" {
				found = true
				break
			}
		}
		require.True(t, found, "Created connection should be in the list")
	})

	// Test 4: Update the Connection
	t.Run("Update Connection", func(t *testing.T) {
		// Get the current object first
		current, err := client.Resource.Get(ctx, "test-github-connection", metav1.GetOptions{})
		require.NoError(t, err)

		currentConn, err := fromUnstructuredToConnection(current)
		require.NoError(t, err)

		// Update the AppID
		currentConn.Spec.GitHub.AppID = "999999"

		unstructuredObj, err := toUnstructured(currentConn)
		require.NoError(t, err)

		updated, err := client.Resource.Update(ctx, unstructuredObj, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		updatedConn, err := fromUnstructuredToConnection(updated)
		require.NoError(t, err)
		require.Equal(t, "999999", updatedConn.Spec.GitHub.AppID)

		// Verify the update persisted
		retrieved, err := client.Resource.Get(ctx, "test-github-connection", metav1.GetOptions{})
		require.NoError(t, err)
		retrievedConn, err := fromUnstructuredToConnection(retrieved)
		require.NoError(t, err)
		require.Equal(t, "999999", retrievedConn.Spec.GitHub.AppID)
	})

	// Test 5: Delete the Connection
	t.Run("Delete Connection", func(t *testing.T) {
		err := client.Resource.Delete(ctx, "test-github-connection", metav1.DeleteOptions{})
		require.NoError(t, err)

		// Verify it's deleted
		_, err = client.Resource.Get(ctx, "test-github-connection", metav1.GetOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err), "Expected NotFound error after deletion")
	})

	// Test 6: Create a GitLab Connection
	t.Run("Create GitLab Connection", func(t *testing.T) {
		connection := &provisioning.Connection{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "provisioning.grafana.app/v1beta1",
				Kind:       "Connection",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-gitlab-connection",
				Namespace: namespace,
			},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GitlabConnectionType,
				Gitlab: &provisioning.GitlabConnectionConfig{
					ClientID: "gitlab-client-123",
				},
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("gitlab-token"),
				},
			},
		}

		unstructuredObj, err := toUnstructured(connection)
		require.NoError(t, err)

		created, err := client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdConn, err := fromUnstructuredToConnection(created)
		require.NoError(t, err)
		require.Equal(t, provisioning.GitlabConnectionType, createdConn.Spec.Type)
		require.Equal(t, "gitlab-client-123", createdConn.Spec.Gitlab.ClientID)

		// Clean up
		err = client.Resource.Delete(ctx, "test-gitlab-connection", metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	// Test 7: Create a Bitbucket Connection
	t.Run("Create Bitbucket Connection", func(t *testing.T) {
		connection := &provisioning.Connection{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "provisioning.grafana.app/v1beta1",
				Kind:       "Connection",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-bitbucket-connection",
				Namespace: namespace,
			},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.BitbucketConnectionType,
				Bitbucket: &provisioning.BitbucketConnectionConfig{
					ClientID: "bitbucket-client-456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("bitbucket-token"),
				},
			},
		}

		unstructuredObj, err := toUnstructured(connection)
		require.NoError(t, err)

		created, err := client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdConn, err := fromUnstructuredToConnection(created)
		require.NoError(t, err)
		require.Equal(t, provisioning.BitbucketConnectionType, createdConn.Spec.Type)
		require.Equal(t, "bitbucket-client-456", createdConn.Spec.Bitbucket.ClientID)

		// Clean up
		err = client.Resource.Delete(ctx, "test-bitbucket-connection", metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// toUnstructured converts a Connection to an unstructured object
func toUnstructured(obj *provisioning.Connection) (*unstructured.Unstructured, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: unstructuredObj}, nil
}

// fromUnstructuredToConnection converts an unstructured object to a Connection
func fromUnstructuredToConnection(obj *unstructured.Unstructured) (*provisioning.Connection, error) {
	conn := &provisioning.Connection{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, conn)
	return conn, err
}
