package provisioning

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
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

	secretsService := helper.GetEnv().RepositorySecrets
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
			repo := unstructuredToRepository(t, output)

			// Move encrypted token mutation
			for _, expectedField := range test.expectedFields {
				value, decrypted := encryptedField(t, secretsService, repo, output.Object, expectedField.Path, expectedField.ExpectedDecryptedValue != "")
				require.False(t, strings.HasPrefix(value, name), "value should not be prefixed with the repository name")
				require.Equal(t, expectedField.ExpectedDecryptedValue, decrypted)
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

	secretsService := helper.GetEnv().RepositorySecrets

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
			updatedInput.Object["metadata"].(map[string]any)["resourceVersion"] = current.Object["metadata"].(map[string]any)["resourceVersion"]

			_, err = helper.Repositories.Resource.Update(ctx, updatedInput, updateOptions)
			require.NoError(t, err, "failed to update resource")

			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource after update")
			repo := unstructuredToRepository(t, output)

			for _, expectedField := range test.expectedFields {
				value, decrypted := encryptedField(t, secretsService, repo, output.Object, expectedField.Path, expectedField.ExpectedDecryptedValue != "")
				require.False(t, strings.HasPrefix(value, name), "value should not be prefixed with the repository name")
				require.Equal(t, expectedField.ExpectedDecryptedValue, decrypted)
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

	secretsService := helper.GetEnv().RepositorySecrets

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
				value, decrypted := encryptedField(t, secretsService, repo, output.Object, expectedField.Path, expectedField.ExpectedDecryptedValue != "")

				if expectedField.ExpectedValue != "" {
					require.Equal(t, name+"-"+expectedField.ExpectedValue, value)
				}

				if expectedField.ExpectedDecryptedValue != "" {
					require.Equal(t, expectedField.ExpectedDecryptedValue, decrypted)
				}
			}
		})
	}
}

func TestIntegrationProvisioning_Secrets_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	helper := runGrafana(t, useAppPlatformSecrets)
	secretsService := helper.GetEnv().RepositorySecrets
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
				value, decrypted := encryptedField(t, secretsService, updatedRepo, updatedOutput.Object, expectedField.Path, expectedField.ExpectedDecryptedValue != "")

				if expectedField.ExpectedValue != "" {
					require.Equal(t, name+"-"+expectedField.ExpectedValue, value)
				}

				if expectedField.ExpectedDecryptedValue != "" {
					require.Equal(t, expectedField.ExpectedDecryptedValue, decrypted)
				}
			}
		})
	}
}

func TestIntegrationProvisioning_Secrets_Removal(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := runGrafana(t, useAppPlatformSecrets)
	secretsService := helper.GetEnv().RepositorySecrets
	createOptions := metav1.CreateOptions{}

	type expectedField struct {
		Path []string
	}

	tests := []struct {
		name           string
		inputFile      string
		values         map[string]interface{}
		expectedFields []expectedField
		updatedFields  []expectedField
	}{
		{
			name:      "remove encrypted git token",
			inputFile: "testdata/git-readonly.json.tmpl",
			values: map[string]interface{}{
				"Token": "initial-token",
			},
			expectedFields: []expectedField{
				{
					Path: []string{"spec", "git", "encryptedToken"},
				},
			},
		},
		{
			name:      "remove encrypted github token",
			inputFile: "testdata/github-readonly.json.tmpl",
			values: map[string]interface{}{
				"Token": "initial-token",
			},
			expectedFields: []expectedField{
				{
					Path: []string{"spec", "github", "encryptedToken"},
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

			// Set the same name and resourceVersion for update
			err = helper.Repositories.Resource.Delete(ctx, name, metav1.DeleteOptions{})
			require.NoError(t, err, "failed to delete resource")

			for _, expectedField := range test.expectedFields {
				secretName, found, err := base64DecodedField(output.Object, expectedField.Path)
				require.NoError(t, err, "failed to decode base64 value")
				require.True(t, found, "secretName should be found")
				require.NotEmpty(t, secretName)

				var lastDecrypted []byte
				require.Eventually(t, func() bool {
					lastDecrypted, err = secretsService.Decrypt(ctx, repo, secretName)
					return err != nil && errors.Is(err, contracts.ErrDecryptNotFound)
				}, 1000*time.Second, 500*time.Millisecond, "expected ErrDecryptNotFound error, got %v", lastDecrypted)
			}
		})
	}
}

func encryptedField(t *testing.T, secretsService secrets.RepositorySecrets, repo *provisioning.Repository, obj map[string]any, path []string, expectedValue bool) (string, string) {
	value, found, err := base64DecodedField(obj, path)
	if err != nil {
		require.NoError(t, err, "failed to decode base64 value")
	}

	if expectedValue {
		decrypted, err := secretsService.Decrypt(context.Background(), repo, value)
		require.NoError(t, err, "failed to eecrypt value")
		return value, string(decrypted)
	} else {
		require.False(t, found, "value should not be found")
		return "", ""
	}
}

func base64DecodedField(obj map[string]any, path []string) (string, bool, error) {
	value, found, err := unstructured.NestedFieldNoCopy(obj, path...)
	if err != nil {
		return "", false, err
	}

	if !found {
		return "", false, nil
	}

	valueStr, ok := value.(string)
	if !ok {
		return "", false, fmt.Errorf("value is not a string")
	}

	decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
	if err != nil {
		return "", false, fmt.Errorf("failed to decode base64 valueStr: %w", err)
	}

	return string(decodedValue), true, nil
}
