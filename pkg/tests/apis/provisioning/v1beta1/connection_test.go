package v1beta1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	commonapi "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationV1Beta1Connection_Create_GitHub(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

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
			Title: "Test GitHub Connection",
			Type:  provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "789012",
			},
		},
		Secure: provisioning.ConnectionSecure{
			PrivateKey: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue(common.TestGithubPrivateKeyBase64()),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	created, err := client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)

	// Verify the created object
	createdConn, err := common.FromUnstructured[provisioning.Connection](created)
	require.NoError(t, err)
	require.NotEmpty(t, createdConn.UID)
	require.Equal(t, connection.Name, createdConn.Name)
	require.Equal(t, connection.Namespace, createdConn.Namespace)
	require.Equal(t, connection.Spec.Type, createdConn.Spec.Type)
	require.Equal(t, connection.Spec.GitHub.AppID, createdConn.Spec.GitHub.AppID)
	require.Equal(t, connection.Spec.GitHub.InstallationID, createdConn.Spec.GitHub.InstallationID)

	// Secure values should not be returned (Create should be empty)
	require.Empty(t, createdConn.Secure.PrivateKey.Create)

	// Clean up
	err = client.Resource.Delete(ctx, connection.Name, metav1.DeleteOptions{})
	require.NoError(t, err)
}

func TestIntegrationV1Beta1Connection_Create_GitLab(t *testing.T) {
	t.Skip("GitLab connection type not yet supported by backend")
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

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
			Title: "Test GitLab Connection",
			Type:  provisioning.GitlabConnectionType,
			Gitlab: &provisioning.GitlabConnectionConfig{
				ClientID: "gitlab-client-123",
			},
		},
		Secure: provisioning.ConnectionSecure{
			ClientSecret: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue("gitlab-client-secret"),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	created, err := client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)

	createdConn, err := common.FromUnstructured[provisioning.Connection](created)
	require.NoError(t, err)
	require.Equal(t, provisioning.GitlabConnectionType, createdConn.Spec.Type)
	require.Equal(t, "gitlab-client-123", createdConn.Spec.Gitlab.ClientID)

	// Clean up
	err = client.Resource.Delete(ctx, connection.Name, metav1.DeleteOptions{})
	require.NoError(t, err)
}

func TestIntegrationV1Beta1Connection_Create_Bitbucket(t *testing.T) {
	t.Skip("Bitbucket connection type not yet supported by backend")
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

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
			Title: "Test Bitbucket Connection",
			Type:  provisioning.BitbucketConnectionType,
			Bitbucket: &provisioning.BitbucketConnectionConfig{
				ClientID: "bitbucket-client-456",
			},
		},
		Secure: provisioning.ConnectionSecure{
			ClientSecret: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue("bitbucket-client-secret"),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	created, err := client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)

	createdConn, err := common.FromUnstructured[provisioning.Connection](created)
	require.NoError(t, err)
	require.Equal(t, provisioning.BitbucketConnectionType, createdConn.Spec.Type)
	require.Equal(t, "bitbucket-client-456", createdConn.Spec.Bitbucket.ClientID)

	// Clean up
	err = client.Resource.Delete(ctx, connection.Name, metav1.DeleteOptions{})
	require.NoError(t, err)
}

func TestIntegrationV1Beta1Connection_Get(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

	// Create a connection first
	connection := &provisioning.Connection{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "provisioning.grafana.app/v1beta1",
			Kind:       "Connection",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-get-connection",
			Namespace: namespace,
		},
		Spec: provisioning.ConnectionSpec{
			Title: "Test Get Connection",
			Type:  provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "789012",
			},
		},
		Secure: provisioning.ConnectionSecure{
			PrivateKey: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue(common.TestGithubPrivateKeyBase64()),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	_, err = client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)

	// Get the connection
	retrieved, err := client.Resource.Get(ctx, "test-get-connection", metav1.GetOptions{})
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	retrievedConn, err := common.FromUnstructured[provisioning.Connection](retrieved)
	require.NoError(t, err)
	require.Equal(t, "test-get-connection", retrievedConn.Name)
	require.Equal(t, namespace, retrievedConn.Namespace)
	require.Equal(t, provisioning.GithubConnectionType, retrievedConn.Spec.Type)

	// Clean up
	err = client.Resource.Delete(ctx, connection.Name, metav1.DeleteOptions{})
	require.NoError(t, err)
}

func TestIntegrationV1Beta1Connection_List(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

	// Create a connection first
	connection := &provisioning.Connection{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "provisioning.grafana.app/v1beta1",
			Kind:       "Connection",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-list-connection",
			Namespace: namespace,
		},
		Spec: provisioning.ConnectionSpec{
			Title: "Test List Connection",
			Type:  provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "789012",
			},
		},
		Secure: provisioning.ConnectionSecure{
			PrivateKey: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue(common.TestGithubPrivateKeyBase64()),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	_, err = client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)

	// List connections
	list, err := client.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.NotNil(t, list)
	require.GreaterOrEqual(t, len(list.Items), 1)

	// Find our connection in the list
	found := false
	for _, item := range list.Items {
		if item.GetName() == "test-list-connection" {
			found = true
			break
		}
	}
	require.True(t, found, "Created connection should be in the list")

	// Clean up
	err = client.Resource.Delete(ctx, connection.Name, metav1.DeleteOptions{})
	require.NoError(t, err)
}

func TestIntegrationV1Beta1Connection_Update(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

	// Create a connection first
	connection := &provisioning.Connection{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "provisioning.grafana.app/v1beta1",
			Kind:       "Connection",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-update-connection",
			Namespace: namespace,
		},
		Spec: provisioning.ConnectionSpec{
			Title: "Test Update Connection",
			Type:  provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "789012",
			},
		},
		Secure: provisioning.ConnectionSecure{
			PrivateKey: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue(common.TestGithubPrivateKeyBase64()),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	_, err = client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)

	// Get the current object
	current, err := client.Resource.Get(ctx, "test-update-connection", metav1.GetOptions{})
	require.NoError(t, err)

	currentConn, err := common.FromUnstructured[provisioning.Connection](current)
	require.NoError(t, err)

	// Update the AppID
	currentConn.Spec.GitHub.AppID = "999999"

	unstructuredObj, err = common.ToUnstructured(currentConn)
	require.NoError(t, err)

	updated, err := client.Resource.Update(ctx, unstructuredObj, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.NotNil(t, updated)

	updatedConn, err := common.FromUnstructured[provisioning.Connection](updated)
	require.NoError(t, err)
	require.Equal(t, "999999", updatedConn.Spec.GitHub.AppID)

	// Verify the update persisted
	retrieved, err := client.Resource.Get(ctx, "test-update-connection", metav1.GetOptions{})
	require.NoError(t, err)
	retrievedConn, err := common.FromUnstructured[provisioning.Connection](retrieved)
	require.NoError(t, err)
	require.Equal(t, "999999", retrievedConn.Spec.GitHub.AppID)

	// Clean up
	err = client.Resource.Delete(ctx, connection.Name, metav1.DeleteOptions{})
	require.NoError(t, err)
}

func TestIntegrationV1Beta1Connection_Delete(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
		},
	})

	client := common.GetConnectionClientV1Beta1(helper)
	ctx := context.Background()
	namespace := "default"

	// Create a connection first
	connection := &provisioning.Connection{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "provisioning.grafana.app/v1beta1",
			Kind:       "Connection",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-delete-connection",
			Namespace: namespace,
		},
		Spec: provisioning.ConnectionSpec{
			Title: "Test Delete Connection",
			Type:  provisioning.GithubConnectionType,
			GitHub: &provisioning.GitHubConnectionConfig{
				AppID:          "123456",
				InstallationID: "789012",
			},
		},
		Secure: provisioning.ConnectionSecure{
			PrivateKey: commonapi.InlineSecureValue{
				Create: commonapi.NewSecretValue(common.TestGithubPrivateKeyBase64()),
			},
		},
	}

	unstructuredObj, err := common.ToUnstructured(connection)
	require.NoError(t, err)

	_, err = client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)

	// Delete the connection
	err = client.Resource.Delete(ctx, "test-delete-connection", metav1.DeleteOptions{})
	require.NoError(t, err)

	// Verify it's deleted
	_, err = client.Resource.Get(ctx, "test-delete-connection", metav1.GetOptions{})
	require.Error(t, err)
	require.True(t, apierrors.IsNotFound(err), "Expected NotFound error after deletion")
}
