package provisioning

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationProvisioning_LegacySecrets(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	type expectedField struct {
		Path                   []string
		ExpectedDecryptedValue string
	}

	secretsService := helper.GetEnv().SecretsService
	// TODO: Add test of fallbacks
	tests := []struct {
		name           string
		values         map[string]any
		inputFile      string
		expectedFields []expectedField
	}{
		{
			name: "github token encrypted",
			values: map[string]any{
				"Token": "some-token",
			},
			inputFile: "testdata/github-readonly.json.tmpl",
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "github", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "github", "encryptedToken"},
					ExpectedDecryptedValue: "some-token",
				},
			},
		},
		{
			name: "git token encrypted",
			values: map[string]any{
				"Token": "some-token",
			},
			inputFile: "testdata/git-readonly.json.tmpl",
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "git", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "git", "encryptedToken"},
					ExpectedDecryptedValue: "some-token",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := helper.RenderObject(t, test.inputFile, test.values)
			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			name := mustNestedString(input.Object, "metadata", "name")
			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource")

			// Move encrypted token mutation
			for _, expectedField := range test.expectedFields {
				value, found, err := unstructured.NestedFieldNoCopy(output.Object, expectedField.Path...)
				require.NoError(t, err, "failed to get value")
				if expectedField.ExpectedDecryptedValue != "" {
					require.True(t, found, "value not found")
					valueStr, ok := value.(string)
					require.True(t, ok, "value is not a string")
					decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
					require.NoError(t, err, "failed to decode base64 valueStr")
					require.False(t, strings.HasPrefix(string(decodedValue), name), "not prefixed with the repository name")
					decrypted, err := secretsService.Decrypt(ctx, nil, string(decodedValue))
					require.NoError(t, err, "failed to decrypt value")
					require.Equal(t, expectedField.ExpectedDecryptedValue, string(decrypted))
				} else {
					require.False(t, found, "value should not be found")
				}
			}
		})
	}
}

func TestIntegrationProvisioning_Secrets_LegacyUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	updateOptions := metav1.UpdateOptions{}
	ctx := context.Background()

	secretsService := helper.GetEnv().SecretsService

	type expectedField struct {
		Path                   []string
		ExpectedValue          string
		ExpectedDecryptedValue string
	}

	tests := []struct {
		name           string
		values         map[string]any
		inputFile      string
		updateValues   map[string]any
		expectedFields []expectedField
	}{
		{
			name: "update github token (legacy secrets)",
			values: map[string]any{
				"Token": "initial-token",
			},
			inputFile: "testdata/github-readonly.json.tmpl",
			updateValues: map[string]any{
				"Token": "updated-token",
			},
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "github", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "github", "encryptedToken"},
					ExpectedDecryptedValue: "updated-token",
				},
			},
		},
		{
			name: "update git token (legacy secrets)",
			values: map[string]any{
				"Token": "initial-token",
			},
			inputFile: "testdata/git-readonly.json.tmpl",
			updateValues: map[string]any{
				"Token": "updated-token",
			},
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "git", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "git", "encryptedToken"},
					ExpectedDecryptedValue: "updated-token",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// Create initial resource
			input := helper.RenderObject(t, test.inputFile, test.values)
			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			name := mustNestedString(input.Object, "metadata", "name")

			// Prepare updated resource
			updatedInput := helper.RenderObject(t, test.inputFile, test.updateValues)
			// Set the same name and resourceVersion for update
			updatedInput.Object["metadata"].(map[string]any)["name"] = name

			// Fetch current resourceVersion
			current, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to get current resource for update")
			updatedInput.Object["metadata"].(map[string]any)["resourceVersion"] =
				current.Object["metadata"].(map[string]any)["resourceVersion"]

			_, err = helper.Repositories.Resource.Update(ctx, updatedInput, updateOptions)
			require.NoError(t, err, "failed to update resource")

			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource after update")

			for _, expectedField := range test.expectedFields {
				value, found, err := unstructured.NestedFieldNoCopy(output.Object, expectedField.Path...)
				require.NoError(t, err, "failed to get value")
				if expectedField.ExpectedDecryptedValue != "" {
					require.True(t, found, "value not found")
					valueStr, ok := value.(string)
					require.True(t, ok, "value is not a string")
					decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
					require.NoError(t, err, "failed to decode base64 valueStr")
					require.False(t, strings.HasPrefix(string(decodedValue), name), "not prefixed with the repository name")
					decrypted, err := secretsService.Decrypt(ctx, nil, string(decodedValue))
					require.NoError(t, err, "failed to decrypt value")
					require.Equal(t, expectedField.ExpectedDecryptedValue, string(decrypted))
				} else {
					require.False(t, found, "value should not be found")
				}
			}
		})
	}
}

func TestIntegrationProvisioning_Secrets(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t, useAppPlatformSecrets)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	secretsService := helper.GetEnv().SecretsService

	type expectedField struct {
		Path                   []string
		ExpectedValue          string
		ExpectedDecryptedValue string
	}
	// TODO: Add test of fallbacks
	tests := []struct {
		name           string
		values         map[string]any
		inputFile      string
		expectedFields []expectedField
	}{
		{
			name: "github token encrypted",
			values: map[string]any{
				"Token": "some-token",
			},
			inputFile: "testdata/github-readonly.json.tmpl",
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "github", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "github", "encryptedToken"},
					ExpectedValue:          "github-token",
					ExpectedDecryptedValue: "some-token",
				},
			},
		},
		{
			name: "git token encrypted",
			values: map[string]any{
				"Token": "some-token",
			},
			inputFile: "testdata/git-readonly.json.tmpl",
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "git", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "git", "encryptedToken"},
					ExpectedValue:          "git-token",
					ExpectedDecryptedValue: "some-token",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := helper.RenderObject(t, test.inputFile, test.values)
			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			name := mustNestedString(input.Object, "metadata", "name")
			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource")
			repo := unstructuredToRepository(t, output)

			// Move encrypted token mutation
			for _, expectedField := range test.expectedFields {
				value, found, err := unstructured.NestedFieldNoCopy(output.Object, expectedField.Path...)
				require.NoError(t, err, "failed to get value")
				if expectedField.ExpectedDecryptedValue != "" {
					require.True(t, found, "value not found")
					valueStr, ok := value.(string)
					require.True(t, ok, "value is not a string")
					decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
					require.NoError(t, err, "failed to decode base64 valueStr")
					require.Equal(t, name+"-"+expectedField.ExpectedValue, string(decodedValue))

					decrypted, err := secretsService.Decrypt(ctx, repo, string(decodedValue))
					require.NoError(t, err, "failed to decrypt value")
					require.Equal(t, expectedField.ExpectedDecryptedValue, string(decrypted))
				} else {
					require.False(t, found, "value should not be found")
				}
			}
		})
	}
}

func TestIntegrationProvisioning_Secrets_Update(t *testing.T) {
	ctx := context.Background()
	helper := runGrafana(t, useAppPlatformSecrets)
	secretsService := helper.GetEnv().SecretsService
	createOptions := metav1.CreateOptions{}
	updateOptions := metav1.UpdateOptions{}

	type expectedField struct {
		Path                   []string
		ExpectedValue          string
		ExpectedDecryptedValue string
	}

	tests := []struct {
		name           string
		inputFile      string
		values         map[string]interface{}
		updateValues   map[string]interface{}
		expectedFields []expectedField
		updatedFields  []expectedField
	}{
		{
			name:      "update encrypted git token",
			inputFile: "testdata/git-readonly.json.tmpl",
			values: map[string]interface{}{
				"Token": "initial-token",
			},
			updateValues: map[string]interface{}{
				"Token": "updated-token",
			},
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "git", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "git", "encryptedToken"},
					ExpectedValue:          "git-token",
					ExpectedDecryptedValue: "initial-token",
				},
			},
			updatedFields: []expectedField{
				{
					Path:                   []string{"spec", "git", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "git", "encryptedToken"},
					ExpectedValue:          "git-token",
					ExpectedDecryptedValue: "updated-token",
				},
			},
		},
		{
			name:      "update encrypted github token",
			inputFile: "testdata/github-readonly.json.tmpl",
			values: map[string]interface{}{
				"Token": "initial-token",
			},
			updateValues: map[string]interface{}{
				"Token": "updated-token",
			},
			expectedFields: []expectedField{
				{
					Path:                   []string{"spec", "github", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "github", "encryptedToken"},
					ExpectedValue:          "github-token",
					ExpectedDecryptedValue: "initial-token",
				},
			},
			updatedFields: []expectedField{
				{
					Path:                   []string{"spec", "github", "token"},
					ExpectedDecryptedValue: "",
				},
				{
					Path:                   []string{"spec", "github", "encryptedToken"},
					ExpectedValue:          "github-token",
					ExpectedDecryptedValue: "updated-token",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// Create initial resource
			input := helper.RenderObject(t, test.inputFile, test.values)
			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			name := mustNestedString(input.Object, "metadata", "name")
			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource")
			repo := unstructuredToRepository(t, output)

			// Check initial fields
			for _, expectedField := range test.expectedFields {
				value, found, err := unstructured.NestedFieldNoCopy(output.Object, expectedField.Path...)
				require.NoError(t, err, "failed to get value")
				if expectedField.ExpectedDecryptedValue != "" {
					require.True(t, found, "value not found")
					valueStr, ok := value.(string)
					require.True(t, ok, "value is not a string")
					decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
					require.NoError(t, err, "failed to decode base64 valueStr")
					require.Equal(t, name+"-"+expectedField.ExpectedValue, string(decodedValue))

					decrypted, err := secretsService.Decrypt(ctx, repo, string(decodedValue))
					require.NoError(t, err, "failed to decrypt value")
					require.Equal(t, expectedField.ExpectedDecryptedValue, string(decrypted))
				} else {
					require.False(t, found, "value should not be found")
				}
			}

			// Update the resource
			updatedInput := helper.RenderObject(t, test.inputFile, test.updateValues)
			// Set the same name and resourceVersion for update
			_ = unstructured.SetNestedField(updatedInput.Object, name, "metadata", "name")
			_ = unstructured.SetNestedField(updatedInput.Object, output.GetResourceVersion(), "metadata", "resourceVersion")
			_, err = helper.Repositories.Resource.Update(ctx, updatedInput, updateOptions)
			require.NoError(t, err, "failed to update resource")

			updatedOutput, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back updated resource")
			updatedRepo := unstructuredToRepository(t, updatedOutput)

			// Check updated fields
			for _, expectedField := range test.updatedFields {
				value, found, err := unstructured.NestedFieldNoCopy(updatedOutput.Object, expectedField.Path...)
				require.NoError(t, err, "failed to get value")
				if expectedField.ExpectedDecryptedValue != "" {
					require.True(t, found, "value not found")
					valueStr, ok := value.(string)
					require.True(t, ok, "value is not a string")
					decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
					require.NoError(t, err, "failed to decode base64 valueStr")
					require.Equal(t, name+"-"+expectedField.ExpectedValue, string(decodedValue))

					decrypted, err := secretsService.Decrypt(ctx, updatedRepo, string(decodedValue))
					require.NoError(t, err, "failed to decrypt value")
					require.Equal(t, expectedField.ExpectedDecryptedValue, string(decrypted))
				} else {
					require.False(t, found, "value should not be found")
				}
			}
		})
	}
}
