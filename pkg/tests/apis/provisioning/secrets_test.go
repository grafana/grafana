package provisioning

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_InlineSecrets(t *testing.T) {
	helper := sharedHelper(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	decryptService := helper.GetEnv().DecryptService
	require.NotNil(t, decryptService, "decrypt service not wired properly")

	type expectedField struct {
		Path           []string
		DecryptedValue string // only try decrypting if not empty
	}

	tests := []struct {
		name           string
		values         map[string]any
		inputFile      string
		expectedFields []expectedField
	}{
		{
			name: "inline github token encrypted",
			values: map[string]any{
				"Token":         "some-token",
				"WebhookSecret": "some-secret",
				"SyncEnabled":   true,
				"SyncTarget":    "folder",
				"GenerateName":  "test-",
				"WorkflowsJSON": `[]`,
			},
			inputFile: common.TestdataPath("github.json.tmpl"),
			expectedFields: []expectedField{
				{
					Path:           []string{"secure", "token", "name"},
					DecryptedValue: "some-token",
				},
				{
					Path:           []string{"secure", "webhookSecret", "name"},
					DecryptedValue: "some-secret",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := helper.RenderObject(t, test.inputFile, test.values)
			obj, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")
			require.True(t, strings.HasPrefix(obj.GetName(), "test-"), "created a unique name")
			var created []string

			// Move encrypted token mutation
			for _, expectedField := range test.expectedFields {
				name, found, err := unstructured.NestedString(obj.Object, expectedField.Path...)
				require.NoError(t, err, "error getting expected path")
				require.True(t, found, expectedField.Path)
				require.NotEmpty(t, name, expectedField.Path)
				created = append(created, name)

				if expectedField.DecryptedValue != "" {
					decrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", obj.GetNamespace(), name)
					require.NoError(t, err, "decryption error")
					require.Len(t, decrypted, 1)

					val := decrypted[name].Value()
					require.NotNil(t, val)
					require.Equal(t, expectedField.DecryptedValue, val.DangerouslyExposeAndConsumeValue())
				}
			}

			err = helper.Repositories.Resource.Delete(ctx, obj.GetName(), metav1.DeleteOptions{})
			require.NoError(t, err, "failed to delete repository")

			helper.WaitForRepositoryDeleted(t, ctx, obj.GetName())

			// Inline secrets are cleaned up asynchronously (owner-reference GC
			// and the secret garbage-collection worker) after the repository
			// finalizer chain completes, so poll until every secret reports
			// not found rather than asserting once.
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				results, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", obj.GetNamespace(), created...)
				if !assert.NoError(collect, err, "failed to execute decrypt with removed secrets") {
					return
				}
				for k, v := range results {
					assert.ErrorContains(collect, v.Error(), "not found", "expecting not found error for all secrets: %s", k)
				}
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "inline secrets should be removed after repository deletion")
		})
	}
}
