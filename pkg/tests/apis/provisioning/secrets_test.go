package provisioning

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type expectedField struct {
	Path          []string
	ExpectedValue string
}

func TestIntegrationProvisioning_Secrets(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	secretsService := helper.GetEnv().SecretsService

	tests := []struct {
		name           string
		values         map[string]any
		inputFile      string
		expectedFields []expectedField
	}{
		{
			name: "github token encrypted with legacy encryption",
			values: map[string]any{
				"Token": "some-token",
			},
			inputFile: "testdata/github-readonly.json.tmpl",
			expectedFields: []expectedField{
				{
					Path:          []string{"spec", "github", "token"},
					ExpectedValue: "",
				},
				{
					Path:          []string{"spec", "github", "encryptedToken"},
					ExpectedValue: "some-token",
				},
			},
		},
		{
			name: "git token encrypted with legacy encryption",
			values: map[string]any{
				"Token": "some-token",
			},
			inputFile: "testdata/git-readonly.json.tmpl",
			expectedFields: []expectedField{
				{
					Path:          []string{"spec", "git", "token"},
					ExpectedValue: "",
				},
				{
					Path:          []string{"spec", "git", "encryptedToken"},
					ExpectedValue: "some-token",
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
				if expectedField.ExpectedValue != "" {
					require.True(t, found, "value not found")
					valueStr, ok := value.(string)
					require.True(t, ok, "value is not a string")
					decodedValue, err := base64.StdEncoding.DecodeString(valueStr)
					require.NoError(t, err, "failed to decode base64 valueStr")
					decrypted, err := secretsService.Decrypt(ctx, nil, string(decodedValue))
					require.NoError(t, err, "failed to decrypt value")
					require.Equal(t, expectedField.ExpectedValue, string(decrypted))
				} else {
					require.False(t, found, "value should not be found")
				}
			}
		})
	}
}
