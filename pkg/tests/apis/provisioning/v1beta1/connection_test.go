package v1beta1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
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

	client := getConnectionClient(helper)
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
			PrivateKey: common.InlineSecureValue{
				Create: common.NewSecretValue("LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRRFJvV1E5Y3I0SG9yeHoKdjV2a1I3UjVOaUhmS0g3L2xvQWg2M0dSeks2cjZCLzhqMjNjdXlucnRMYU1ZbHgwVFgwSlZCQm1HUE85dS9YRgpQV3VkKzBac05sZXAvQzREM1lBem5rYlFLeWFpd01PbDRDcnVwcmIxQVVDOEpiTnphOXViR1U3K1k2WkJDMGJwCjhxcytIR3FYeUlwVUNySytySU1rd1V4WkJFUi9sZ3ZsMGZieE9ZVWx0WmpXRW1FQjQzVkdWbFEyQitnd0d0d1UKNXBrNXFPQ2JrVUM1Zy9QOUkyd1hsejBUbW92WEJ4dW5uc1hGbWNGVHoxTFJHNXhsQVNESTJlcE5GcjBaSmFXMQp1RVlSWWdlMmJHSmdyU1pEZzJLVXZuQ1ZBM0h3cFdtNUtTSk9OMit4cnFLMXpiRmM3RjZ1RWhQUWZ4QWlDY2QyClVWbUV2R2hoQWdNQkFBRUNnZ0VBWk1kTWkvZ0dJR0NkYlozL29YTFJjZlpTdVZoY0daNnVVZUJCTklFc3RnczkKbVdzUXUyMmxQU0lmSW9WRkFrcWdZbVF1RUE5TjJuaXFzbHlSU0oxYzRUZ00wL1VlNEEvVUNyeThPV2FOUi9BWQovcjB5bHBIQ1lpM3NnNmN5U3JwZkZJVEp3NlYvYjBTdkhsaGg5OVdzYnZUamYzeTNLdEIvcWFOZUEydDRUTWNrCll3WWVpVytlQ0dSMUZyemNrcnZpVm9CR1dac084WURaMnB3M0p3dnFESWFsbWFwMXIxbjN4UndxYmcxRTVJRXIKdVZXNlRvM2loa3VhVm90Q2xhUUpDOTBJc1MyM2FzVGl3NGZLcGxoL3ZtZUpvS2svaHBHdnBJTTJ6bGdVV2FYaApoMDV3ODcvMXBpSHF1TzBFKzhhL1lraHIzdkUwdHN2UU9GaEx2TVd0TXdLQmdRRHdlWTFPK0NjZVpTSVFmbllwClZvMzNYZGgvWjFTN0FKWHBEaHM1ajZYQ0lVaXZaNTIzT2xqK1lzeUQ3YmtScitYalhqN0dQVkx4RzRXakpnbkUKUTc5azFsZWIyNDdqczJtNVRWNGRZbXhSdElKdEMwMmtMbnQ3SVBRVFh2cEtDc0lJZ3lVODNGU1gwSU9sa293cwpMWjVaZ1ZDOWZHZCszc1ZDMTBkMnUvNVZnd0tCZ1FEZktnOGZQM2pzTmRsVVFlWlpxU1QvMlZsZXc1Q2Vnait5CjBBTldzeVB5MWs0WGdzbnlQTE9jbDdsZ0dNNDNjUjArcHhyWXVrWXR6MHk1VnhrUkRYUlZQNUNRM2J0b1ZvSkUKR2Nha2VzRGxUMHNBcjk2a3IyMGVqVzVadks1ZzJzUlBxYklLTWE5STgxb1JhbXRpK3BrYjQ0MUY1MzhuM0h0MwpIcWliNlIxSlN3S0JnREZpbFIyWm90Y0FKLzNCS3QwVWRIVlBwWTJNbC84TGdMM3E4clpnaE1jWWRNZm8vSi9MCmNNbFZXdkRoR2pmQ3F2Q0Z3MWlNOFlLb2gwcFpIbnBhKzJ4bkJIanlueWF1Q3RGT1RUeTFvTThxeGZwRTd2My8KdWNZd24wOTNHdW1ueWU5Ymw0TW5NSXc0KzBBK2wyRGZRWHphTE0ydFJjZnRVZytIREpzYXdvR25Bb0dCQU1CMAozanU5bW9SallEejQ1RFk0MkE3Sm0vaE13Z0RoSlJ3SnBvZHowTEhSUGVHcXlveGM2eTFGNy9tL0NzRG5qU2dHCkp2SDNteVJRbmNOTktQSDYzM1BSY05SdVZQd0RkeTVSNkd6YTdGWVdEd0hWcWpYdWtEV0VGVUhRcGJZamxKOTcKSW04R01EdkNtczlnTHFKYXFnWlNOUGl2VDRySjY3UnNQVTdRT0pDSEFvR0JBSkRoVlFLZGZjRlJuYTh4UTY1bApyQUlOcklMQy9PL2RCcWI5Nmlqcks1RmJwTy9BcUVnWm5GaDRYYkh3KzZwcWpyYWkyMGdQSW9sdHNrZjkwSU9xCkxOZzNSdnZtNWxmeDN1Ny9MbGZKMXhieEM2dXBDdWZHZG1VMUJSZUtmSjUycHZXVFVuYUliMmFKcUZzNVV0aUIKWjIxRWlhZFhVdUxYWlk5dWt0OXdvMVRGCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"),
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

	client := getConnectionClient(helper)
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
			ClientSecret: common.InlineSecureValue{
				Create: common.NewSecretValue("gitlab-client-secret"),
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

	client := getConnectionClient(helper)
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
			ClientSecret: common.InlineSecureValue{
				Create: common.NewSecretValue("bitbucket-client-secret"),
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

	client := getConnectionClient(helper)
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
			PrivateKey: common.InlineSecureValue{
				Create: common.NewSecretValue("LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRRFJvV1E5Y3I0SG9yeHoKdjV2a1I3UjVOaUhmS0g3L2xvQWg2M0dSeks2cjZCLzhqMjNjdXlucnRMYU1ZbHgwVFgwSlZCQm1HUE85dS9YRgpQV3VkKzBac05sZXAvQzREM1lBem5rYlFLeWFpd01PbDRDcnVwcmIxQVVDOEpiTnphOXViR1U3K1k2WkJDMGJwCjhxcytIR3FYeUlwVUNySytySU1rd1V4WkJFUi9sZ3ZsMGZieE9ZVWx0WmpXRW1FQjQzVkdWbFEyQitnd0d0d1UKNXBrNXFPQ2JrVUM1Zy9QOUkyd1hsejBUbW92WEJ4dW5uc1hGbWNGVHoxTFJHNXhsQVNESTJlcE5GcjBaSmFXMQp1RVlSWWdlMmJHSmdyU1pEZzJLVXZuQ1ZBM0h3cFdtNUtTSk9OMit4cnFLMXpiRmM3RjZ1RWhQUWZ4QWlDY2QyClVWbUV2R2hoQWdNQkFBRUNnZ0VBWk1kTWkvZ0dJR0NkYlozL29YTFJjZlpTdVZoY0daNnVVZUJCTklFc3RnczkKbVdzUXUyMmxQU0lmSW9WRkFrcWdZbVF1RUE5TjJuaXFzbHlSU0oxYzRUZ00wL1VlNEEvVUNyeThPV2FOUi9BWQovcjB5bHBIQ1lpM3NnNmN5U3JwZkZJVEp3NlYvYjBTdkhsaGg5OVdzYnZUamYzeTNLdEIvcWFOZUEydDRUTWNrCll3WWVpVytlQ0dSMUZyemNrcnZpVm9CR1dac084WURaMnB3M0p3dnFESWFsbWFwMXIxbjN4UndxYmcxRTVJRXIKdVZXNlRvM2loa3VhVm90Q2xhUUpDOTBJc1MyM2FzVGl3NGZLcGxoL3ZtZUpvS2svaHBHdnBJTTJ6bGdVV2FYaApoMDV3ODcvMXBpSHF1TzBFKzhhL1lraHIzdkUwdHN2UU9GaEx2TVd0TXdLQmdRRHdlWTFPK0NjZVpTSVFmbllwClZvMzNYZGgvWjFTN0FKWHBEaHM1ajZYQ0lVaXZaNTIzT2xqK1lzeUQ3YmtScitYalhqN0dQVkx4RzRXakpnbkUKUTc5azFsZWIyNDdqczJtNVRWNGRZbXhSdElKdEMwMmtMbnQ3SVBRVFh2cEtDc0lJZ3lVODNGU1gwSU9sa293cwpMWjVaZ1ZDOWZHZCszc1ZDMTBkMnUvNVZnd0tCZ1FEZktnOGZQM2pzTmRsVVFlWlpxU1QvMlZsZXc1Q2Vnait5CjBBTldzeVB5MWs0WGdzbnlQTE9jbDdsZ0dNNDNjUjArcHhyWXVrWXR6MHk1VnhrUkRYUlZQNUNRM2J0b1ZvSkUKR2Nha2VzRGxUMHNBcjk2a3IyMGVqVzVadks1ZzJzUlBxYklLTWE5STgxb1JhbXRpK3BrYjQ0MUY1MzhuM0h0MwpIcWliNlIxSlN3S0JnREZpbFIyWm90Y0FKLzNCS3QwVWRIVlBwWTJNbC84TGdMM3E4clpnaE1jWWRNZm8vSi9MCmNNbFZXdkRoR2pmQ3F2Q0Z3MWlNOFlLb2gwcFpIbnBhKzJ4bkJIanlueWF1Q3RGT1RUeTFvTThxeGZwRTd2My8KdWNZd24wOTNHdW1ueWU5Ymw0TW5NSXc0KzBBK2wyRGZRWHphTE0ydFJjZnRVZytIREpzYXdvR25Bb0dCQU1CMAozanU5bW9SallEejQ1RFk0MkE3Sm0vaE13Z0RoSlJ3SnBvZHowTEhSUGVHcXlveGM2eTFGNy9tL0NzRG5qU2dHCkp2SDNteVJRbmNOTktQSDYzM1BSY05SdVZQd0RkeTVSNkd6YTdGWVdEd0hWcWpYdWtEV0VGVUhRcGJZamxKOTcKSW04R01EdkNtczlnTHFKYXFnWlNOUGl2VDRySjY3UnNQVTdRT0pDSEFvR0JBSkRoVlFLZGZjRlJuYTh4UTY1bApyQUlOcklMQy9PL2RCcWI5Nmlqcks1RmJwTy9BcUVnWm5GaDRYYkh3KzZwcWpyYWkyMGdQSW9sdHNrZjkwSU9xCkxOZzNSdnZtNWxmeDN1Ny9MbGZKMXhieEM2dXBDdWZHZG1VMUJSZUtmSjUycHZXVFVuYUliMmFKcUZzNVV0aUIKWjIxRWlhZFhVdUxYWlk5dWt0OXdvMVRGCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"),
			},
		},
	}

	unstructuredObj, err := toUnstructured(connection)
	require.NoError(t, err)

	_, err = client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)

	// Get the connection
	retrieved, err := client.Resource.Get(ctx, "test-get-connection", metav1.GetOptions{})
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	retrievedConn, err := fromUnstructuredToConnection(retrieved)
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

	client := getConnectionClient(helper)
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
			PrivateKey: common.InlineSecureValue{
				Create: common.NewSecretValue("LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRRFJvV1E5Y3I0SG9yeHoKdjV2a1I3UjVOaUhmS0g3L2xvQWg2M0dSeks2cjZCLzhqMjNjdXlucnRMYU1ZbHgwVFgwSlZCQm1HUE85dS9YRgpQV3VkKzBac05sZXAvQzREM1lBem5rYlFLeWFpd01PbDRDcnVwcmIxQVVDOEpiTnphOXViR1U3K1k2WkJDMGJwCjhxcytIR3FYeUlwVUNySytySU1rd1V4WkJFUi9sZ3ZsMGZieE9ZVWx0WmpXRW1FQjQzVkdWbFEyQitnd0d0d1UKNXBrNXFPQ2JrVUM1Zy9QOUkyd1hsejBUbW92WEJ4dW5uc1hGbWNGVHoxTFJHNXhsQVNESTJlcE5GcjBaSmFXMQp1RVlSWWdlMmJHSmdyU1pEZzJLVXZuQ1ZBM0h3cFdtNUtTSk9OMit4cnFLMXpiRmM3RjZ1RWhQUWZ4QWlDY2QyClVWbUV2R2hoQWdNQkFBRUNnZ0VBWk1kTWkvZ0dJR0NkYlozL29YTFJjZlpTdVZoY0daNnVVZUJCTklFc3RnczkKbVdzUXUyMmxQU0lmSW9WRkFrcWdZbVF1RUE5TjJuaXFzbHlSU0oxYzRUZ00wL1VlNEEvVUNyeThPV2FOUi9BWQovcjB5bHBIQ1lpM3NnNmN5U3JwZkZJVEp3NlYvYjBTdkhsaGg5OVdzYnZUamYzeTNLdEIvcWFOZUEydDRUTWNrCll3WWVpVytlQ0dSMUZyemNrcnZpVm9CR1dac084WURaMnB3M0p3dnFESWFsbWFwMXIxbjN4UndxYmcxRTVJRXIKdVZXNlRvM2loa3VhVm90Q2xhUUpDOTBJc1MyM2FzVGl3NGZLcGxoL3ZtZUpvS2svaHBHdnBJTTJ6bGdVV2FYaApoMDV3ODcvMXBpSHF1TzBFKzhhL1lraHIzdkUwdHN2UU9GaEx2TVd0TXdLQmdRRHdlWTFPK0NjZVpTSVFmbllwClZvMzNYZGgvWjFTN0FKWHBEaHM1ajZYQ0lVaXZaNTIzT2xqK1lzeUQ3YmtScitYalhqN0dQVkx4RzRXakpnbkUKUTc5azFsZWIyNDdqczJtNVRWNGRZbXhSdElKdEMwMmtMbnQ3SVBRVFh2cEtDc0lJZ3lVODNGU1gwSU9sa293cwpMWjVaZ1ZDOWZHZCszc1ZDMTBkMnUvNVZnd0tCZ1FEZktnOGZQM2pzTmRsVVFlWlpxU1QvMlZsZXc1Q2Vnait5CjBBTldzeVB5MWs0WGdzbnlQTE9jbDdsZ0dNNDNjUjArcHhyWXVrWXR6MHk1VnhrUkRYUlZQNUNRM2J0b1ZvSkUKR2Nha2VzRGxUMHNBcjk2a3IyMGVqVzVadks1ZzJzUlBxYklLTWE5STgxb1JhbXRpK3BrYjQ0MUY1MzhuM0h0MwpIcWliNlIxSlN3S0JnREZpbFIyWm90Y0FKLzNCS3QwVWRIVlBwWTJNbC84TGdMM3E4clpnaE1jWWRNZm8vSi9MCmNNbFZXdkRoR2pmQ3F2Q0Z3MWlNOFlLb2gwcFpIbnBhKzJ4bkJIanlueWF1Q3RGT1RUeTFvTThxeGZwRTd2My8KdWNZd24wOTNHdW1ueWU5Ymw0TW5NSXc0KzBBK2wyRGZRWHphTE0ydFJjZnRVZytIREpzYXdvR25Bb0dCQU1CMAozanU5bW9SallEejQ1RFk0MkE3Sm0vaE13Z0RoSlJ3SnBvZHowTEhSUGVHcXlveGM2eTFGNy9tL0NzRG5qU2dHCkp2SDNteVJRbmNOTktQSDYzM1BSY05SdVZQd0RkeTVSNkd6YTdGWVdEd0hWcWpYdWtEV0VGVUhRcGJZamxKOTcKSW04R01EdkNtczlnTHFKYXFnWlNOUGl2VDRySjY3UnNQVTdRT0pDSEFvR0JBSkRoVlFLZGZjRlJuYTh4UTY1bApyQUlOcklMQy9PL2RCcWI5Nmlqcks1RmJwTy9BcUVnWm5GaDRYYkh3KzZwcWpyYWkyMGdQSW9sdHNrZjkwSU9xCkxOZzNSdnZtNWxmeDN1Ny9MbGZKMXhieEM2dXBDdWZHZG1VMUJSZUtmSjUycHZXVFVuYUliMmFKcUZzNVV0aUIKWjIxRWlhZFhVdUxYWlk5dWt0OXdvMVRGCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"),
			},
		},
	}

	unstructuredObj, err := toUnstructured(connection)
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

	client := getConnectionClient(helper)
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
			PrivateKey: common.InlineSecureValue{
				Create: common.NewSecretValue("LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRRFJvV1E5Y3I0SG9yeHoKdjV2a1I3UjVOaUhmS0g3L2xvQWg2M0dSeks2cjZCLzhqMjNjdXlucnRMYU1ZbHgwVFgwSlZCQm1HUE85dS9YRgpQV3VkKzBac05sZXAvQzREM1lBem5rYlFLeWFpd01PbDRDcnVwcmIxQVVDOEpiTnphOXViR1U3K1k2WkJDMGJwCjhxcytIR3FYeUlwVUNySytySU1rd1V4WkJFUi9sZ3ZsMGZieE9ZVWx0WmpXRW1FQjQzVkdWbFEyQitnd0d0d1UKNXBrNXFPQ2JrVUM1Zy9QOUkyd1hsejBUbW92WEJ4dW5uc1hGbWNGVHoxTFJHNXhsQVNESTJlcE5GcjBaSmFXMQp1RVlSWWdlMmJHSmdyU1pEZzJLVXZuQ1ZBM0h3cFdtNUtTSk9OMit4cnFLMXpiRmM3RjZ1RWhQUWZ4QWlDY2QyClVWbUV2R2hoQWdNQkFBRUNnZ0VBWk1kTWkvZ0dJR0NkYlozL29YTFJjZlpTdVZoY0daNnVVZUJCTklFc3RnczkKbVdzUXUyMmxQU0lmSW9WRkFrcWdZbVF1RUE5TjJuaXFzbHlSU0oxYzRUZ00wL1VlNEEvVUNyeThPV2FOUi9BWQovcjB5bHBIQ1lpM3NnNmN5U3JwZkZJVEp3NlYvYjBTdkhsaGg5OVdzYnZUamYzeTNLdEIvcWFOZUEydDRUTWNrCll3WWVpVytlQ0dSMUZyemNrcnZpVm9CR1dac084WURaMnB3M0p3dnFESWFsbWFwMXIxbjN4UndxYmcxRTVJRXIKdVZXNlRvM2loa3VhVm90Q2xhUUpDOTBJc1MyM2FzVGl3NGZLcGxoL3ZtZUpvS2svaHBHdnBJTTJ6bGdVV2FYaApoMDV3ODcvMXBpSHF1TzBFKzhhL1lraHIzdkUwdHN2UU9GaEx2TVd0TXdLQmdRRHdlWTFPK0NjZVpTSVFmbllwClZvMzNYZGgvWjFTN0FKWHBEaHM1ajZYQ0lVaXZaNTIzT2xqK1lzeUQ3YmtScitYalhqN0dQVkx4RzRXakpnbkUKUTc5azFsZWIyNDdqczJtNVRWNGRZbXhSdElKdEMwMmtMbnQ3SVBRVFh2cEtDc0lJZ3lVODNGU1gwSU9sa293cwpMWjVaZ1ZDOWZHZCszc1ZDMTBkMnUvNVZnd0tCZ1FEZktnOGZQM2pzTmRsVVFlWlpxU1QvMlZsZXc1Q2Vnait5CjBBTldzeVB5MWs0WGdzbnlQTE9jbDdsZ0dNNDNjUjArcHhyWXVrWXR6MHk1VnhrUkRYUlZQNUNRM2J0b1ZvSkUKR2Nha2VzRGxUMHNBcjk2a3IyMGVqVzVadks1ZzJzUlBxYklLTWE5STgxb1JhbXRpK3BrYjQ0MUY1MzhuM0h0MwpIcWliNlIxSlN3S0JnREZpbFIyWm90Y0FKLzNCS3QwVWRIVlBwWTJNbC84TGdMM3E4clpnaE1jWWRNZm8vSi9MCmNNbFZXdkRoR2pmQ3F2Q0Z3MWlNOFlLb2gwcFpIbnBhKzJ4bkJIanlueWF1Q3RGT1RUeTFvTThxeGZwRTd2My8KdWNZd24wOTNHdW1ueWU5Ymw0TW5NSXc0KzBBK2wyRGZRWHphTE0ydFJjZnRVZytIREpzYXdvR25Bb0dCQU1CMAozanU5bW9SallEejQ1RFk0MkE3Sm0vaE13Z0RoSlJ3SnBvZHowTEhSUGVHcXlveGM2eTFGNy9tL0NzRG5qU2dHCkp2SDNteVJRbmNOTktQSDYzM1BSY05SdVZQd0RkeTVSNkd6YTdGWVdEd0hWcWpYdWtEV0VGVUhRcGJZamxKOTcKSW04R01EdkNtczlnTHFKYXFnWlNOUGl2VDRySjY3UnNQVTdRT0pDSEFvR0JBSkRoVlFLZGZjRlJuYTh4UTY1bApyQUlOcklMQy9PL2RCcWI5Nmlqcks1RmJwTy9BcUVnWm5GaDRYYkh3KzZwcWpyYWkyMGdQSW9sdHNrZjkwSU9xCkxOZzNSdnZtNWxmeDN1Ny9MbGZKMXhieEM2dXBDdWZHZG1VMUJSZUtmSjUycHZXVFVuYUliMmFKcUZzNVV0aUIKWjIxRWlhZFhVdUxYWlk5dWt0OXdvMVRGCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"),
			},
		},
	}

	unstructuredObj, err := toUnstructured(connection)
	require.NoError(t, err)

	_, err = client.Resource.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	require.NoError(t, err)

	// Get the current object
	current, err := client.Resource.Get(ctx, "test-update-connection", metav1.GetOptions{})
	require.NoError(t, err)

	currentConn, err := fromUnstructuredToConnection(current)
	require.NoError(t, err)

	// Update the AppID
	currentConn.Spec.GitHub.AppID = "999999"

	unstructuredObj, err = toUnstructured(currentConn)
	require.NoError(t, err)

	updated, err := client.Resource.Update(ctx, unstructuredObj, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.NotNil(t, updated)

	updatedConn, err := fromUnstructuredToConnection(updated)
	require.NoError(t, err)
	require.Equal(t, "999999", updatedConn.Spec.GitHub.AppID)

	// Verify the update persisted
	retrieved, err := client.Resource.Get(ctx, "test-update-connection", metav1.GetOptions{})
	require.NoError(t, err)
	retrievedConn, err := fromUnstructuredToConnection(retrieved)
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

	client := getConnectionClient(helper)
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
			PrivateKey: common.InlineSecureValue{
				Create: common.NewSecretValue("LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRRFJvV1E5Y3I0SG9yeHoKdjV2a1I3UjVOaUhmS0g3L2xvQWg2M0dSeks2cjZCLzhqMjNjdXlucnRMYU1ZbHgwVFgwSlZCQm1HUE85dS9YRgpQV3VkKzBac05sZXAvQzREM1lBem5rYlFLeWFpd01PbDRDcnVwcmIxQVVDOEpiTnphOXViR1U3K1k2WkJDMGJwCjhxcytIR3FYeUlwVUNySytySU1rd1V4WkJFUi9sZ3ZsMGZieE9ZVWx0WmpXRW1FQjQzVkdWbFEyQitnd0d0d1UKNXBrNXFPQ2JrVUM1Zy9QOUkyd1hsejBUbW92WEJ4dW5uc1hGbWNGVHoxTFJHNXhsQVNESTJlcE5GcjBaSmFXMQp1RVlSWWdlMmJHSmdyU1pEZzJLVXZuQ1ZBM0h3cFdtNUtTSk9OMit4cnFLMXpiRmM3RjZ1RWhQUWZ4QWlDY2QyClVWbUV2R2hoQWdNQkFBRUNnZ0VBWk1kTWkvZ0dJR0NkYlozL29YTFJjZlpTdVZoY0daNnVVZUJCTklFc3RnczkKbVdzUXUyMmxQU0lmSW9WRkFrcWdZbVF1RUE5TjJuaXFzbHlSU0oxYzRUZ00wL1VlNEEvVUNyeThPV2FOUi9BWQovcjB5bHBIQ1lpM3NnNmN5U3JwZkZJVEp3NlYvYjBTdkhsaGg5OVdzYnZUamYzeTNLdEIvcWFOZUEydDRUTWNrCll3WWVpVytlQ0dSMUZyemNrcnZpVm9CR1dac084WURaMnB3M0p3dnFESWFsbWFwMXIxbjN4UndxYmcxRTVJRXIKdVZXNlRvM2loa3VhVm90Q2xhUUpDOTBJc1MyM2FzVGl3NGZLcGxoL3ZtZUpvS2svaHBHdnBJTTJ6bGdVV2FYaApoMDV3ODcvMXBpSHF1TzBFKzhhL1lraHIzdkUwdHN2UU9GaEx2TVd0TXdLQmdRRHdlWTFPK0NjZVpTSVFmbllwClZvMzNYZGgvWjFTN0FKWHBEaHM1ajZYQ0lVaXZaNTIzT2xqK1lzeUQ3YmtScitYalhqN0dQVkx4RzRXakpnbkUKUTc5azFsZWIyNDdqczJtNVRWNGRZbXhSdElKdEMwMmtMbnQ3SVBRVFh2cEtDc0lJZ3lVODNGU1gwSU9sa293cwpMWjVaZ1ZDOWZHZCszc1ZDMTBkMnUvNVZnd0tCZ1FEZktnOGZQM2pzTmRsVVFlWlpxU1QvMlZsZXc1Q2Vnait5CjBBTldzeVB5MWs0WGdzbnlQTE9jbDdsZ0dNNDNjUjArcHhyWXVrWXR6MHk1VnhrUkRYUlZQNUNRM2J0b1ZvSkUKR2Nha2VzRGxUMHNBcjk2a3IyMGVqVzVadks1ZzJzUlBxYklLTWE5STgxb1JhbXRpK3BrYjQ0MUY1MzhuM0h0MwpIcWliNlIxSlN3S0JnREZpbFIyWm90Y0FKLzNCS3QwVWRIVlBwWTJNbC84TGdMM3E4clpnaE1jWWRNZm8vSi9MCmNNbFZXdkRoR2pmQ3F2Q0Z3MWlNOFlLb2gwcFpIbnBhKzJ4bkJIanlueWF1Q3RGT1RUeTFvTThxeGZwRTd2My8KdWNZd24wOTNHdW1ueWU5Ymw0TW5NSXc0KzBBK2wyRGZRWHphTE0ydFJjZnRVZytIREpzYXdvR25Bb0dCQU1CMAozanU5bW9SallEejQ1RFk0MkE3Sm0vaE13Z0RoSlJ3SnBvZHowTEhSUGVHcXlveGM2eTFGNy9tL0NzRG5qU2dHCkp2SDNteVJRbmNOTktQSDYzM1BSY05SdVZQd0RkeTVSNkd6YTdGWVdEd0hWcWpYdWtEV0VGVUhRcGJZamxKOTcKSW04R01EdkNtczlnTHFKYXFnWlNOUGl2VDRySjY3UnNQVTdRT0pDSEFvR0JBSkRoVlFLZGZjRlJuYTh4UTY1bApyQUlOcklMQy9PL2RCcWI5Nmlqcks1RmJwTy9BcUVnWm5GaDRYYkh3KzZwcWpyYWkyMGdQSW9sdHNrZjkwSU9xCkxOZzNSdnZtNWxmeDN1Ny9MbGZKMXhieEM2dXBDdWZHZG1VMUJSZUtmSjUycHZXVFVuYUliMmFKcUZzNVV0aUIKWjIxRWlhZFhVdUxYWlk5dWt0OXdvMVRGCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"),
			},
		},
	}

	unstructuredObj, err := toUnstructured(connection)
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
