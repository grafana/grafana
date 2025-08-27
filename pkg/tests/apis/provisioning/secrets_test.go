package provisioning

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationProvisioning_InlineSecrets(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
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
				"SecureTokenCreate":         "some-token",
				"SecureWebhookSecretCreate": "some-secret",
			},
			inputFile: "testdata/github-with-inline-secrets.json.tmpl",
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

			// Finalizers will be running async... so we need to wait until it is actually removed
			require.Eventually(t, func() bool {
				_, err := helper.Repositories.Resource.Get(ctx, obj.GetName(), metav1.GetOptions{})
				return apierrors.IsNotFound(err)
			}, time.Second*15, time.Millisecond*300, "should be removed")

			// now check that we can no longer decrypt the requested values
			results, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", obj.GetNamespace(), created...)
			require.NoError(t, err, "failed to execute decrypt with removed secrets")
			for k, v := range results {
				require.ErrorContains(t, v.Error(), "not found", "expecting not found error for all secrets: %s", k)
			}
		})
	}
}
