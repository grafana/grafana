// Package generic builds whole-resource embeddings from manifest fields.
package generic

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/storage/unified/fieldpath"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
)

const maxItemContentBytes = 4 * 1024

// Builder holds an immutable declaration snapshot so Extract and Version agree
// even if the manifest configuration changes while an item is being processed.
type Builder struct {
	resource        schema.GroupResource
	reembedVersion  int
	fieldsByVersion map[string][]app.ManifestVersionKindEmbedField
	skippedVersions *prometheus.CounterVec
}

var _ embed.Builder = (*Builder)(nil)

// New accepts SDK-validated declarations. skippedVersions, when provided, has
// group, resource, and version labels and is shared across builder snapshots.
func New(resource schema.GroupResource, declaration app.ManifestResourceEmbed, fieldsByVersion map[string][]app.ManifestVersionKindEmbedField, skippedVersions *prometheus.CounterVec) *Builder {
	fields := make(map[string][]app.ManifestVersionKindEmbedField, len(fieldsByVersion))
	for version, declared := range fieldsByVersion {
		fields[version] = slices.Clone(declared)
	}
	return &Builder{
		resource:        resource,
		reembedVersion:  declaration.ReembedVersion,
		fieldsByVersion: fields,
		skippedVersions: skippedVersions,
	}
}

func (b *Builder) Group() string            { return b.resource.Group }
func (b *Builder) Resource() string         { return b.resource.Resource }
func (b *Builder) Version() int             { return b.reembedVersion }
func (b *Builder) MaxItemsPerResource() int { return 1 }

func (b *Builder) Extract(_ context.Context, key *resourcepb.ResourceKey, value []byte, _ string) ([]embed.Item, error) {
	if key.GetName() == "" || key.GetGroup() != b.Group() || key.GetResource() != b.Resource() {
		return nil, fmt.Errorf("embedding builder for %s requires a matching resource key with a name", b.resource)
	}
	var obj map[string]any
	if err := json.Unmarshal(value, &obj); err != nil {
		return nil, fmt.Errorf("unmarshal resource: %w", err)
	}
	if obj == nil {
		return nil, fmt.Errorf("resource must be a JSON object")
	}

	apiVersion, ok := obj["apiVersion"].(string)
	if obj["apiVersion"] == nil || (ok && apiVersion == "") {
		return nil, b.skip("<missing>")
	}
	gv, err := schema.ParseGroupVersion(apiVersion)
	if !ok || err != nil || len(validation.IsDNS1035Label(gv.Version)) != 0 {
		return nil, b.skip("<invalid>")
	}
	if gv.Group != key.GetGroup() {
		return nil, b.skip("<unsupported>")
	}
	fields, declared := b.fieldsByVersion[gv.Version]
	if !declared {
		return nil, b.skip(gv.Version)
	}

	lines := make([]string, 0, len(fields))
	for _, field := range fields {
		raw, err := fieldpath.Extract(obj, field.Path)
		if err != nil {
			continue
		}
		if text := fieldText(raw); text != "" {
			lines = append(lines, field.Name+": "+text)
		}
	}
	if len(lines) == 0 {
		return nil, nil
	}
	return []embed.Item{{
		UID:     key.GetName(),
		Title:   resourceTitle(obj, key.GetName()),
		Content: truncateUTF8(strings.Join(lines, "\n"), maxItemContentBytes),
		Folder:  embed.FolderUIDFromValue(value),
	}}, nil
}

func (b *Builder) skip(version string) error {
	if b.skippedVersions != nil {
		b.skippedVersions.WithLabelValues(b.Group(), b.Resource(), version).Inc()
	}
	return fmt.Errorf("%w: no embedding declaration for %s version %s", embed.ErrSkip, b.resource, version)
}

// A malformed field must not turn numbers or objects into embedding text.
func fieldText(value any) string {
	switch value := value.(type) {
	case string:
		return strings.TrimSpace(value)
	case []any:
		values := make([]string, 0, len(value))
		for _, raw := range value {
			if raw == nil {
				continue
			}
			text, ok := raw.(string)
			if !ok {
				return ""
			}
			if text = strings.TrimSpace(text); text != "" {
				values = append(values, text)
			}
		}
		return strings.Join(values, ", ")
	}
	return ""
}

func resourceTitle(obj map[string]any, fallback string) string {
	for _, path := range []string{"spec.title", "spec.name"} {
		raw, _ := fieldpath.Extract(obj, path)
		if title, ok := raw.(string); ok && strings.TrimSpace(title) != "" {
			return title
		}
	}
	return fallback
}

func truncateUTF8(text string, n int) string {
	if len(text) <= n {
		return text
	}
	for n > 0 && !utf8.RuneStart(text[n]) {
		n--
	}
	return text[:n]
}
