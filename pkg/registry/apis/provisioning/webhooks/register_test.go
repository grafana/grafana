package webhooks

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

func TestWebhookExtraBuilder_WebhookURL(t *testing.T) {
	makeRepo := func(name, namespace string, webhook *provisioning.WebhookConfig) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:      name,
				Namespace: namespace,
			},
			Spec: provisioning.RepositorySpec{
				Webhook: webhook,
			},
		}
	}

	tests := []struct {
		name        string
		isPublic    bool
		urlProvider func(ctx context.Context, namespace string) string
		repo        *provisioning.Repository
		expected    string
	}{
		{
			name:     "returns empty when not public and no custom URL",
			isPublic: false,
			urlProvider: func(_ context.Context, _ string) string {
				return "http://localhost:3000/"
			},
			repo:     makeRepo("my-repo", "default", nil),
			expected: "",
		},
		{
			name:     "builds URL from provider when public",
			isPublic: true,
			urlProvider: func(_ context.Context, _ string) string {
				return "https://grafana.example.com/"
			},
			repo:     makeRepo("my-repo", "default", nil),
			expected: "https://grafana.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:     "uses custom base URL when set (overrides non-public)",
			isPublic: false,
			urlProvider: func(_ context.Context, _ string) string {
				return "http://localhost:3000/"
			},
			repo:     makeRepo("my-repo", "default", &provisioning.WebhookConfig{BaseURL: "https://public-proxy.example.com"}),
			expected: "https://public-proxy.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:     "uses custom base URL when set (overrides public)",
			isPublic: true,
			urlProvider: func(_ context.Context, _ string) string {
				return "https://grafana.example.com/"
			},
			repo:     makeRepo("my-repo", "default", &provisioning.WebhookConfig{BaseURL: "https://custom-proxy.example.com"}),
			expected: "https://custom-proxy.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:     "handles custom base URL with trailing slash",
			isPublic: false,
			urlProvider: func(_ context.Context, _ string) string {
				return "http://localhost:3000/"
			},
			repo:     makeRepo("my-repo", "default", &provisioning.WebhookConfig{BaseURL: "https://custom.example.com/"}),
			expected: "https://custom.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:     "custom base URL with path prefix",
			isPublic: false,
			urlProvider: func(_ context.Context, _ string) string {
				return "http://localhost:3000/"
			},
			repo:     makeRepo("test-repo", "org-1", &provisioning.WebhookConfig{BaseURL: "https://proxy.example.com/grafana"}),
			expected: "https://proxy.example.com/grafana/apis/provisioning.grafana.app/v0alpha1/namespaces/org-1/repositories/test-repo/webhook",
		},
		{
			name:     "webhook section with empty base URL falls back to default",
			isPublic: true,
			urlProvider: func(_ context.Context, _ string) string {
				return "https://grafana.example.com/"
			},
			repo:     makeRepo("my-repo", "default", &provisioning.WebhookConfig{}),
			expected: "https://grafana.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &WebhookExtraBuilder{
				isPublic:    tt.isPublic,
				urlProvider: tt.urlProvider,
			}

			result := builder.WebhookURL(context.Background(), tt.repo)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestResolvePublicURL verifies the urlProvider resolution chain used by
// ProvideWebhooksWithImages: spec.webhook.baseUrl wins when set on a repo;
// otherwise the builder falls back to ProvisioningPublicAppURL when set, then
// to AppURL.
func TestResolvePublicURL(t *testing.T) {
	tests := []struct {
		name        string
		cfg         *setting.Cfg
		repoWebhook *provisioning.WebhookConfig
		expected    string
	}{
		{
			name:     "uses ProvisioningPublicAppURL when set and no spec override",
			cfg:      &setting.Cfg{AppURL: "http://internal.cluster.local/", ProvisioningPublicAppURL: "https://public.example.com"},
			expected: "https://public.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:     "falls back to AppURL when ProvisioningPublicAppURL empty",
			cfg:      &setting.Cfg{AppURL: "https://grafana.example.com/"},
			expected: "https://grafana.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:        "spec.webhook.baseUrl still wins over ProvisioningPublicAppURL",
			cfg:         &setting.Cfg{AppURL: "http://internal.cluster.local/", ProvisioningPublicAppURL: "https://public.example.com"},
			repoWebhook: &provisioning.WebhookConfig{BaseURL: "https://repo-override.example.com"},
			expected:    "https://repo-override.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			publicURL := tt.cfg.AppURL
			if tt.cfg.ProvisioningPublicAppURL != "" {
				publicURL = tt.cfg.ProvisioningPublicAppURL
			}
			builder := &WebhookExtraBuilder{
				isPublic: isPublicURL(publicURL),
				urlProvider: func(_ context.Context, _ string) string {
					return publicURL
				},
			}
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{Webhook: tt.repoWebhook},
			}
			assert.Equal(t, tt.expected, builder.WebhookURL(context.Background(), repo))
		})
	}
}

func TestIsPublicURL(t *testing.T) {
	tests := []struct {
		url      string
		expected bool
	}{
		{"https://grafana.example.com/", true},
		{"http://grafana.example.com/", false},
		{"https://localhost:3000/", false},
		{"https://127.0.0.1:3000/", false},
		{"https://192.168.1.1:3000/", false},
		{"https://10.0.0.1:3000/", false},
		{"https://172.16.0.1:3000/", false},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			assert.Equal(t, tt.expected, isPublicURL(tt.url))
		})
	}
}
