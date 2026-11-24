package clientauth

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// NamespaceProvider is a strategy for determining the namespace to use in token exchange requests.
type NamespaceProvider interface {
	GetNamespace(ctx context.Context) string
}

// AudienceProvider is a strategy for determining the audiences to use in token exchange requests.
type AudienceProvider interface {
	GetAudiences(req *http.Request) []string
}

// StaticNamespaceProvider returns a fixed namespace for all requests.
type StaticNamespaceProvider struct {
	namespace string
}

// NewStaticNamespaceProvider creates a namespace provider that always returns the same namespace.
func NewStaticNamespaceProvider(namespace string) *StaticNamespaceProvider {
	return &StaticNamespaceProvider{namespace: namespace}
}

func (p *StaticNamespaceProvider) GetNamespace(ctx context.Context) string {
	return p.namespace
}

// StaticAudienceProvider returns a fixed set of audiences for all requests.
type StaticAudienceProvider struct {
	audiences []string
}

// NewStaticAudienceProvider creates an audience provider that always returns the same audiences.
func NewStaticAudienceProvider(audiences ...string) *StaticAudienceProvider {
	return &StaticAudienceProvider{audiences: audiences}
}

func (p *StaticAudienceProvider) GetAudiences(_ *http.Request) []string {
	return p.audiences
}

type RequestGroupAudienceProvider struct {
	fallback string
}

func NewRequestGroupAudienceProvider(fallback string) *RequestGroupAudienceProvider {
	return &RequestGroupAudienceProvider{fallback: fallback}
}

func (p *RequestGroupAudienceProvider) GetAudiences(req *http.Request) []string {
	if group := utils.APIGroupFromRequest(req); group != "" {
		return []string{group}
	}
	return []string{p.fallback}
}
