package enrollment

import (
	"fmt"
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/generic"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type Registry struct {
	configs         *resource.EmbeddingConfigRegistry
	allowed         []schema.GroupResource
	custom          map[schema.GroupResource]embed.Builder
	skippedVersions *prometheus.CounterVec
	log             log.Logger
}

var _ embed.BuilderProvider = (*Registry)(nil)

// New defers declaration lookup until Validate so the initial live manifest
// snapshot can load before enrollment is checked.
func New(configs *resource.EmbeddingConfigRegistry, allowed []string, custom []embed.Builder, skippedVersions *prometheus.CounterVec) (*Registry, error) {
	if configs == nil {
		configs = resource.NewEmbeddingConfigRegistry()
	}
	r := &Registry{
		configs:         configs,
		custom:          make(map[schema.GroupResource]embed.Builder, len(custom)),
		skippedVersions: skippedVersions,
		log:             log.New("embedding-enrollment"),
	}
	seen := make(map[schema.GroupResource]bool, len(allowed))
	for _, entry := range allowed {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		gr, err := parseEntry(entry)
		if err != nil {
			return nil, err
		}
		if !seen[gr] {
			r.allowed = append(r.allowed, gr)
			seen[gr] = true
		}
	}
	slices.SortFunc(r.allowed, func(a, b schema.GroupResource) int {
		if c := strings.Compare(a.Group, b.Group); c != 0 {
			return c
		}
		return strings.Compare(a.Resource, b.Resource)
	})
	for _, builder := range custom {
		if builder == nil {
			return nil, fmt.Errorf("custom embedding builder must not be nil")
		}
		gr, err := parseEntry(builder.Group() + "/" + builder.Resource())
		if err != nil {
			return nil, fmt.Errorf("custom embedding builder: %w", err)
		}
		if _, exists := r.custom[gr]; exists {
			return nil, fmt.Errorf("duplicate custom embedding builder for %s/%s", gr.Group, gr.Resource)
		}
		r.custom[gr] = builder
	}
	return r, nil
}

func parseEntry(entry string) (schema.GroupResource, error) {
	group, name, found := strings.Cut(entry, "/")
	if !found || group == "" || name == "" || strings.Contains(name, "/") || strings.ContainsAny(entry, " \t\r\n") {
		return schema.GroupResource{}, fmt.Errorf("invalid internal embedding collection %q: expected group/resource", entry)
	}
	return schema.GroupResource{Group: group, Resource: name}, nil
}

// Has checks current enrollment without constructing builders. Consumers using
// a retained snapshot must use that snapshot's Has to keep a consistent view.
func (r *Registry) Has(group, resource string) bool {
	gr := schema.GroupResource{Group: group, Resource: resource}
	if !slices.Contains(r.allowed, gr) {
		return false
	}
	if _, ok := r.custom[gr]; ok {
		return true
	}
	return r.configs.HasResource(gr)
}

func (r *Registry) Validate() error {
	declared := make(map[schema.GroupResource]bool)
	for gvr := range r.configs.Snapshot() {
		declared[gvr.GroupResource()] = true
	}
	partitions := make(map[string]schema.GroupResource, len(r.allowed))
	for _, gr := range r.allowed {
		_, isCustom := r.custom[gr]
		if !isCustom && !declared[gr] {
			return fmt.Errorf("internal embedding collection %s/%s has no custom builder or manifest embedding declaration", gr.Group, gr.Resource)
		}
		partition, err := vector.InternalPartitionKey(gr.Resource)
		if err != nil {
			return fmt.Errorf("internal embedding collection %s/%s: %w", gr.Group, gr.Resource, err)
		}
		if owner, exists := partitions[partition]; exists {
			return fmt.Errorf("internal embedding collections %s/%s and %s/%s derive the same partition key %q", owner.Group, owner.Resource, gr.Group, gr.Resource, partition)
		}
		partitions[partition] = gr
		if isCustom && declared[gr] {
			r.log.Warn("Custom embedding builder overrides manifest embedding declarations", "group", gr.Group, "resource", gr.Resource)
		}
	}
	return nil
}

// Snapshot omits declarations removed at runtime without interrupting other
// resources. Startup validation remains strict about missing declarations.
func (r *Registry) Snapshot() embed.BuilderSnapshot {
	type declaration struct {
		revision int
		fields   map[string][]app.ManifestVersionKindEmbedField
	}
	declared := make(map[schema.GroupResource]declaration)
	for gvr, config := range r.configs.Snapshot() {
		gr := gvr.GroupResource()
		d := declared[gr]
		if d.fields == nil {
			d.fields = make(map[string][]app.ManifestVersionKindEmbedField)
			d.revision = config.ReembedVersion
		}
		d.fields[gvr.Version] = config.Fields
		declared[gr] = d
	}
	builders := make([]embed.Builder, 0, len(r.allowed))
	for _, gr := range r.allowed {
		d, hasDeclaration := declared[gr]
		builder, isCustom := r.custom[gr]
		if !isCustom {
			if !hasDeclaration {
				continue
			}
			builder = generic.New(gr, app.ManifestResourceEmbed{ReembedVersion: d.revision}, d.fields, r.skippedVersions)
		}
		builders = append(builders, builder)
	}
	return embed.NewBuilderSnapshot(builders)
}
