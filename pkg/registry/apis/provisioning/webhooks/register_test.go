package webhooks

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
