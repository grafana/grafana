package provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestAzureEmbedderAuthentication(t *testing.T) {
	for _, key := range []string{"", "existing-api-key"} {
		name := "default_credential"
		if key != "" {
			name = "api_key"
		}
		t.Run(name, func(t *testing.T) {
			t.Setenv("AZURE_OPENAI_API_KEY", key)
			// Keep credential construction independent of the developer's Azure environment.
			for _, env := range []string{"AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID", "AZURE_FEDERATED_TOKEN_FILE"} {
				t.Setenv(env, "")
			}
			t.Setenv("AZURE_TOKEN_CREDENTIALS", "prod")
			cfg := &setting.Cfg{
				EmbeddingProvider: "azure",
				AzureEndpoint:     "https://example.openai.azure.com",
				AzureDeployment:   "text-embedding-3-small",
				AzureDimensions:   1024,
				AzureBatchSize:    50,
			}
			embedder, err := ProvideEmbedder(cfg, nil)
			require.NoError(t, err)
			require.NotNil(t, embedder)
			assert.Equal(t, "azure/text-embedding-3-small", embedder.Model)
		})
	}
}
