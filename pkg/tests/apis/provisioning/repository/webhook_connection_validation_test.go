package repository

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// TestIntegrationProvisioning_RepositoryWebhookConnectionValidation checks that
// creating a GitHub repository is rejected at admission when the referenced
// connection has spec.webhook.disabled: true but the repository does not.
func TestIntegrationProvisioning_RepositoryWebhookConnectionValidation(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "conn-webhook-disabled",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Webhook Disabled Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
			"webhook": map[string]any{
				"disabled": true,
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	_, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err, "failed to create connection")

	t.Run("repository without webhook disabled is rejected", func(t *testing.T) {
		repo := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "repo-missing-webhook-disabled",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Repo Missing Webhook Disabled",
				"type":  "github",
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"github": map[string]any{
					"url":    "https://github.com/some/url",
					"branch": "main",
				},
				"connection": map[string]any{
					"name": "conn-webhook-disabled",
				},
			},
		}}

		_, err := helper.Repositories.Resource.Create(ctx, repo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err)

		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, metav1.StatusReasonInvalid, statusErr.ErrStatus.Reason)
		assert.Contains(t, statusErr.ErrStatus.Message, "spec.webhook.disabled")
	})

	t.Run("repository with webhook disabled is accepted", func(t *testing.T) {
		repo := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "repo-with-webhook-disabled",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Repo With Webhook Disabled",
				"type":  "github",
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"github": map[string]any{
					"url":    "https://github.com/some/url",
					"branch": "main",
				},
				"connection": map[string]any{
					"name": "conn-webhook-disabled",
				},
				"webhook": map[string]any{
					"disabled": true,
				},
			},
		}}

		_, err := helper.Repositories.Resource.Create(ctx, repo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "repository with webhook disabled should be accepted when connection also has webhook disabled")
	})
}
