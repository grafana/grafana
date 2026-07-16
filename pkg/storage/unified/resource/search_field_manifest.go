package resource

import (
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// NewManifestBackedProvider builds a SearchFieldsProvider from the search
// fields declared in the given app manifests. It walks every version's kinds,
// converts each declared field into a SearchFieldDefinition, and returns the
// same map-backed provider NewMapProvider produces, so the per-field and
// cross-version consistency checks apply here too.
//
// Panics on an invalid declaration, like NewMapProvider. Runtime callers use
// newManifestBackedProvider instead.
func NewManifestBackedProvider(manifests []app.Manifest) SearchFieldsProvider {
	p, err := newManifestBackedProvider(manifests)
	if err != nil {
		panic(err.Error())
	}
	return p
}

// newManifestBackedProvider is NewManifestBackedProvider's error-returning
// core, so a runtime manifest source can reject a bad set instead of crashing.
func newManifestBackedProvider(manifests []app.Manifest) (SearchFieldsProvider, error) {
	fields := map[schema.GroupVersionResource][]SearchFieldDefinition{}
	preferred := map[schema.GroupResource]string{}

	for _, m := range manifests {
		if m.ManifestData == nil {
			continue
		}
		group := m.ManifestData.Group
		for _, version := range m.ManifestData.Versions {
			for _, kind := range version.Kinds {
				if len(kind.SearchFields) == 0 {
					continue
				}
				gvr := schema.GroupVersionResource{
					Group:    group,
					Version:  version.Name,
					Resource: manifestResourceName(kind),
				}
				fields[gvr] = manifestSearchFieldsToDefinitions(kind.SearchFields)

				gr := gvr.GroupResource()
				if pv := m.ManifestData.PreferredVersion; pv != "" {
					preferred[gr] = pv
				} else {
					// No explicit preference: the last version that declares the
					// kind wins, matching the manifest's "latest version" default.
					preferred[gr] = version.Name
				}
			}
		}
	}
	return newMapProvider(fields, preferred)
}

// manifestResourceName returns the lower-cased resource (plural) name for a
// kind, defaulting to the kind name plus "s" when the manifest omits the
// plural, which mirrors the app-sdk default.
func manifestResourceName(kind app.ManifestVersionKind) string {
	plural := kind.Plural
	if plural == "" {
		plural = kind.Kind + "s"
	}
	return strings.ToLower(plural)
}

// manifestSearchFieldsToDefinitions converts the manifest's search field
// declarations into SearchFieldDefinitions. The manifest carries plain
// strings for Type and Capabilities; the values match the SearchFieldType and
// SearchCapability constants one-to-one.
func manifestSearchFieldsToDefinitions(in []app.ManifestVersionKindSearchField) []SearchFieldDefinition {
	out := make([]SearchFieldDefinition, len(in))
	for i, f := range in {
		caps := make([]SearchCapability, len(f.Capabilities))
		for j, c := range f.Capabilities {
			caps[j] = SearchCapability(c)
		}
		out[i] = SearchFieldDefinition{
			Name:             f.Name,
			Path:             f.Path,
			Type:             SearchFieldType(f.Type),
			Array:            f.Array,
			Capabilities:     caps,
			EmitZeroIfAbsent: f.EmitZeroIfAbsent,
			Description:      f.Description,
		}
	}
	return out
}

// manifestDeclaredKindKeys returns the (group, resource) key of every kind that
// declares at least one search field in any version.
func manifestDeclaredKindKeys(manifests []app.Manifest) map[LowerGroupResource]bool {
	keys := map[LowerGroupResource]bool{}
	for _, m := range manifests {
		if m.ManifestData == nil {
			continue
		}
		for _, version := range m.ManifestData.Versions {
			for _, kind := range version.Kinds {
				if len(kind.SearchFields) == 0 {
					continue
				}
				keys[NewLowerGroupResource(m.ManifestData.Group, manifestResourceName(kind))] = true
			}
		}
	}
	return keys
}

// SearchFieldProviders returns the per-(group, resource) provider map that
// drives bleve mappings. Every kind that declares search fields in its manifest
// is mapped to a single manifest-backed provider; each entry queries it for its
// own (group, resource).
func SearchFieldProviders(manifests []app.Manifest) (map[LowerGroupResource]SearchFieldsProvider, error) {
	declared := manifestDeclaredKindKeys(manifests)
	out := make(map[LowerGroupResource]SearchFieldsProvider, len(declared))
	if len(declared) == 0 {
		return out, nil
	}

	// A single manifest-backed provider covers every declared kind; each map
	// entry queries it for its own (group, resource).
	manifestProvider, err := newManifestBackedProvider(manifests)
	if err != nil {
		return nil, err
	}
	for key := range declared {
		out[key] = manifestProvider
	}
	return out, nil
}

// SearchFieldsHashesForProviders returns the per-kind index-affecting hash for
// each provider in the map. Deriving the change-detection hashes from the same
// providers that drive the mappings keeps the two in step, so an index rebuild
// is triggered exactly when the fields that shape the mapping change.
func SearchFieldsHashesForProviders(providers map[LowerGroupResource]SearchFieldsProvider) map[LowerGroupResource]string {
	out := make(map[LowerGroupResource]string, len(providers))
	for key, p := range providers {
		if h := p.IndexAffectingHash(key.Group, key.Resource); h != "" {
			out[key] = h
		}
	}
	return out
}
