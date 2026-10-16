package provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func cfgWith(provider string) *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.RerankProvider = provider
	return cfg
}

func TestProvideReranker_DisabledWhenUnset(t *testing.T) {
	r, err := ProvideReranker(cfgWith(""), nil)
	require.NoError(t, err)
	assert.Nil(t, r)
}

func TestProvideReranker_UnknownProvider(t *testing.T) {
	_, err := ProvideReranker(cfgWith("openai"), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown rerank provider")
}

func TestProvideReranker_VertexRequiresProjectID(t *testing.T) {
	cfg := cfgWith("vertex")
	cfg.RerankVertexProjectID = ""
	_, err := ProvideReranker(cfg, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "vertex_project_id")
}

func TestProvideReranker_BedrockBuildsWithThresholds(t *testing.T) {
	// LoadDefaultConfig reads the developer's real AWS environment; pin it
	// so a local SSO/profile setup can't fail construction.
	t.Setenv("AWS_ACCESS_KEY_ID", "test")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "test")
	t.Setenv("AWS_CONFIG_FILE", "/dev/null")
	t.Setenv("AWS_SHARED_CREDENTIALS_FILE", "/dev/null")
	t.Setenv("AWS_PROFILE", "")

	cfg := cfgWith("bedrock")
	cfg.RerankBedrockRegion = "us-east-1"
	cfg.RerankBedrockModel = "cohere.rerank-v3-5:0"
	r, err := ProvideReranker(cfg, nil)
	require.NoError(t, err)
	require.NotNil(t, r)
	assert.Equal(t, "bedrock/cohere.rerank-v3-5:0", r.Model)
	assert.Equal(t, 0.136984, r.Thresholds.Low)
	assert.NotNil(t, r.Scorer)
}
