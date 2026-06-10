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
// otherwise the builder falls back to ProvisioningPublicRootURL when set, then
// to AppURL.
func TestResolvePublicURL(t *testing.T) {
	tests := []struct {
		name        string
		cfg         *setting.Cfg
		repoWebhook *provisioning.WebhookConfig
		expected    string
	}{
		{
			name:     "uses ProvisioningPublicRootURL when set and no spec override",
			cfg:      &setting.Cfg{AppURL: "http://internal.cluster.local/", ProvisioningPublicRootURL: "https://public.example.com"},
			expected: "https://public.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:     "falls back to AppURL when ProvisioningPublicRootURL empty",
			cfg:      &setting.Cfg{AppURL: "https://grafana.example.com/"},
			expected: "https://grafana.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
		{
			name:        "spec.webhook.baseUrl still wins over ProvisioningPublicRootURL",
			cfg:         &setting.Cfg{AppURL: "http://internal.cluster.local/", ProvisioningPublicRootURL: "https://public.example.com"},
			repoWebhook: &provisioning.WebhookConfig{BaseURL: "https://repo-override.example.com"},
			expected:    "https://repo-override.example.com/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/my-repo/webhook",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			publicURL := tt.cfg.AppURL
			if tt.cfg.ProvisioningPublicRootURL != "" {
				publicURL = tt.cfg.ProvisioningPublicRootURL
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
		// Public
		{"https://grafana.example.com/", true},
		{"https://grafana.example.com:8443/path", true},
		{"https://notlocalhost.grafana.com/", true},
		{"https://172.15.0.1/", true}, // just outside 172.16.0.0/12
		{"https://172.32.0.1/", true}, // just outside 172.16.0.0/12
		{"https://8.8.8.8/", true},    // public IPv4
		{"https://[2001:db8::1]/", true},

		// Scheme
		{"http://grafana.example.com/", false},
		{"ftp://grafana.example.com/", false},
		{"://broken", false},

		// Hostnames
		{"https://localhost:3000/", false},
		{"https://my-svc.default.svc/", false},
		{"https://my-svc.default.svc.cluster.local/", false},

		// IPv4 RFC1918 / reserved
		{"https://127.0.0.1:3000/", false},
		{"https://10.0.0.1:3000/", false},
		{"https://192.168.1.1:3000/", false},
		{"https://172.16.0.1:3000/", false},
		{"https://172.17.0.1/", false},
		{"https://172.20.5.10/", false},
		{"https://172.31.255.254/", false},
		{"https://169.254.169.254/", false}, // cloud metadata
		{"https://100.64.0.1/", false},      // CGNAT
		{"https://100.127.255.254/", false}, // CGNAT upper bound

		// IPv6 reserved
		{"https://[::1]/", false},
		{"https://[fe80::1]/", false},
		{"https://[fc00::1]/", false},
		{"https://[fd12:3456:789a::1]/", false},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			assert.Equal(t, tt.expected, isPublicURL(tt.url))
		})
	}
}
