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

// TODO: Update test overrides
