package clientauth

import (
	"context"
	"net/http"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// NamespaceProvider is a strategy for determining the namespace to use in token exchange requests.
type NamespaceProvider interface {
	GetNamespace(ctx context.Context) string
}

// AudienceProvider is a strategy for determining the audiences to use in token exchange requests.
type AudienceProvider interface {
	GetAudiences(ctx context.Context) []string
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

func (p *StaticAudienceProvider) GetAudiences(ctx context.Context) []string {
	return p.audiences
}

type RequestAudienceProvider interface {
	AudienceProvider
	GetRequestAudiences(req *http.Request) []string
}

type RequestGroupAudienceProvider struct {
	fallback string
	extra    []string
}

func NewRequestGroupAudienceProvider(fallback string, extra ...string) *RequestGroupAudienceProvider {
	return &RequestGroupAudienceProvider{fallback: fallback, extra: extra}
}

func (p *RequestGroupAudienceProvider) GetAudiences(ctx context.Context) []string {
	return p.audiencesFor(p.fallback)
}

func (p *RequestGroupAudienceProvider) GetRequestAudiences(req *http.Request) []string {
	group := utils.APIGroupFromRequest(req)
	if group == "" {
		group = p.fallback
	}
	return p.audiencesFor(group)
}

func (p *RequestGroupAudienceProvider) audiencesFor(group string) []string {
	audiences := []string{group}
	for _, a := range p.extra {
		if !slices.Contains(audiences, a) {
			audiences = append(audiences, a)
		}
	}
	return audiences
}
