package resource

import (
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
)

type embeddingBuilderProvider struct {
	validate func() error
	snapshot func() embed.BuilderSnapshot
	has      func(group, resource string) bool
}

func (p embeddingBuilderProvider) Validate() error { return p.validate() }

func (p embeddingBuilderProvider) Snapshot() embed.BuilderSnapshot { return p.snapshot() }

func (p embeddingBuilderProvider) Has(group, resource string) bool { return p.has(group, resource) }

type enrolledBuilder struct {
	embed.Builder
	group, resource string
}

func (b enrolledBuilder) Group() string { return b.group }

func (b enrolledBuilder) Resource() string { return b.resource }
