package repository

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	commonapi "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_GitHubAppURLChangeRemovesToken checks that a URL
// update removes the repository token whether it is omitted or sent back as a
// stored reference. Storage must consume the removal marker without copying the
// old token back, so reconciliation can obtain credentials from the connection.
// Other secure values must survive the update.
func TestIntegrationProvisioning_GitHubAppURLChangeRemovesToken(t *testing.T) {
	helper := sharedHelper(t)
	conn := &provisioning.Connection{
		TypeMeta:   metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "Connection"},
		ObjectMeta: metav1.ObjectMeta{Name: "url-change-app", Namespace: "default"},
		Spec: provisioning.ConnectionSpec{
			Title: "URL change App", Type: provisioning.GithubConnectionType,
			GitHub:  &provisioning.GitHubConnectionConfig{AppID: "123456", InstallationID: "454545"},
			Webhook: &provisioning.ConnectionWebhookConfig{Disabled: true},
		},
		Secure: provisioning.ConnectionSecure{PrivateKey: commonapi.InlineSecureValue{
			Create: commonapi.RawSecureValue(base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))),
		}},
	}
	_, err := helper.CreateGithubConnection(t, common.MustToUnstructured(t, conn))
	require.NoError(t, err)
	repo := &provisioning.Repository{
		TypeMeta:   metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "Repository"},
		ObjectMeta: metav1.ObjectMeta{Name: "url-change-repo", Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Title: "URL change repository", Type: provisioning.GitHubRepositoryType,
			GitHub:     &provisioning.GitHubRepositoryConfig{URL: "https://github.com/grafana/old", Branch: "main"},
			Connection: &provisioning.ConnectionInfo{Name: conn.Name},
			Webhook:    &provisioning.WebhookConfig{Disabled: true},
			Sync:       provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
		Secure: provisioning.SecureValues{
			Token:         commonapi.InlineSecureValue{Create: "old-token"},
			WebhookSecret: commonapi.InlineSecureValue{Create: "webhook-secret"},
		},
	}
	for _, includeTokenReference := range []bool{false, true} {
		name := "omitted-token"
		if includeTokenReference {
			name = "stored-token-reference"
		}
		t.Run(name, func(t *testing.T) {
			repo := repo.DeepCopy()
			repo.Name += "-" + name
			created, err := helper.Repositories.Resource.Create(t.Context(), common.MustToUnstructured(t, repo), metav1.CreateOptions{})
			require.NoError(t, err)
			stored := common.MustFromUnstructured[provisioning.Repository](t, created)
			require.NotEmpty(t, stored.Secure.Token.Name)
			require.NotEmpty(t, stored.Secure.WebhookSecret.Name)

			err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
				current, err := helper.Repositories.Resource.Get(t.Context(), repo.Name, metav1.GetOptions{})
				if err != nil {
					return err
				}
				updated := common.MustFromUnstructured[provisioning.Repository](t, current)
				require.NotEmpty(t, updated.Secure.Token.Name)
				updated.Spec.GitHub.URL += "-new"
				if !includeTokenReference {
					updated.Secure.Token = commonapi.InlineSecureValue{}
				}
				result, err := helper.Repositories.Resource.Update(t.Context(), common.MustToUnstructured(t, updated), metav1.UpdateOptions{})
				if err != nil {
					return err
				}
				saved := common.MustFromUnstructured[provisioning.Repository](t, result)
				assert.Equal(t, updated.URL(), saved.URL())
				assert.True(t, saved.Secure.Token.IsZero(), "storage must consume the removal marker without restoring the token")
				assert.Equal(t, stored.Secure.WebhookSecret, saved.Secure.WebhookSecret)
				return nil
			})
			require.NoError(t, err)
		})
	}
}
