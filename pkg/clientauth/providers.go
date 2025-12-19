package clientauth

import (
	"context"
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

// SingleAudienceProvider is a convenience alias for a single static audience.
type SingleAudienceProvider struct {
	*StaticAudienceProvider
}

// NewSingleAudienceProvider creates an audience provider for a single audience.
func NewSingleAudienceProvider(audience string) *SingleAudienceProvider {
	return &SingleAudienceProvider{
		StaticAudienceProvider: NewStaticAudienceProvider(audience),
	}
}

// ConditionalAudienceProvider allows conditional logic for determining audiences.
// This is useful for cases like the provisioning package where audiences depend on the primary audience.
type ConditionalAudienceProvider struct {
	primaryAudience     string
	conditionalAudience string
}

// NewConditionalAudienceProvider creates an audience provider that conditionally adds an audience.
// If primaryAudience != conditionalAudience, both are returned. Otherwise, only primaryAudience is returned.
func NewConditionalAudienceProvider(primaryAudience, conditionalAudience string) *ConditionalAudienceProvider {
	return &ConditionalAudienceProvider{
		primaryAudience:     primaryAudience,
		conditionalAudience: conditionalAudience,
	}
}

func (p *ConditionalAudienceProvider) GetAudiences(ctx context.Context) []string {
	if p.primaryAudience == p.conditionalAudience {
		return []string{p.primaryAudience}
	}
	return []string{p.primaryAudience, p.conditionalAudience}
}
