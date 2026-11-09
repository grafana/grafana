package provider

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideReranker_BedrockUsesConfiguredHedgeDelay(t *testing.T) {
	t.Setenv("AWS_ACCESS_KEY_ID", "test")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "test")
	t.Setenv("AWS_CONFIG_FILE", "/dev/null")
	t.Setenv("AWS_SHARED_CREDENTIALS_FILE", "/dev/null")
	t.Setenv("AWS_PROFILE", "")
	for _, tc := range []struct {
		name      string
		delay     time.Duration
		wantCalls int32
	}{
		{name: "disabled", delay: 0, wantCalls: 1},
		{name: "enabled", delay: 20 * time.Millisecond, wantCalls: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				if calls.Load() == 1 {
					select {
					case <-time.After(150 * time.Millisecond):
					case <-r.Context().Done():
						return
					}
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.8}]}`))
			}))
			defer server.Close()
			t.Setenv("AWS_ENDPOINT_URL", server.URL)

			cfg := cfgWith("bedrock")
			cfg.RerankBedrockRegion = "us-east-1"
			cfg.RerankBedrockModel = "cohere.rerank-v3-5:0"
			cfg.RerankHedgeDelay = tc.delay
			scorer, err := ProvideReranker(cfg, nil)
			require.NoError(t, err)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			scores, err := scorer.Score(ctx, "q", []string{"a"})
			require.NoError(t, err)
			require.InDelta(t, 0.8, scores[0], 0.000001)
			require.Equal(t, tc.wantCalls, calls.Load())
		})
	}
}

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
