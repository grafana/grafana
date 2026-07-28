package resource

import (
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
)

var manifestMergeLogger = log.New("search-manifest-merge")

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

// ApplyManifests rebuilds the registry from the built-in and live manifest sets
// and swaps them in. On error the registry is left unchanged, so a bad reload
// keeps the current search fields.
func ApplyManifests(registry *SearchFieldsRegistry, builtin, live []app.Manifest) error {
	merged := MergeManifestsByKind(builtin, live)
	selectable, hashes, providers, err := SearchFieldsForManifests(merged)
	if err != nil {
		return err
	}
	registry.Replace(selectable, hashes, providers)
	return nil
}

// SearchFieldsForManifests builds a SearchFieldsRegistry's three inputs from one
// manifest list, so a reload can rebuild them together and keep them consistent.
func SearchFieldsForManifests(manifests []app.Manifest) (
	selectable map[LowerGroupResource][]string,
	hashes map[LowerGroupResource]string,
	providers map[LowerGroupResource]SearchFieldsProvider,
	err error,
) {
	providers, err = SearchFieldProviders(manifests)
	if err != nil {
		return nil, nil, nil, err
	}
	hashes = SearchFieldsHashesForProviders(providers)
	selectable = SelectableFieldsForManifests(manifests)
	return selectable, hashes, providers, nil
}

// MergeManifestsByKind combines manifest sources for the search wiring, given
// in increasing order of priority. Only kinds that declare search fields take
// part: when more than one source declares search fields for the same kind
// (group and resource), the later source's declaration wins outright, including
// versions the winner omits, so a kind's search fields always come from a single
// source and stay internally consistent. A source that declares no search fields
// for a kind never overrides another source. Dropping versions the loser
// declared is logged as a warning, since those versions lose their search
// fields.
//
// Manifests within one source share a priority. A well-formed source declares
// each kind in a single manifest; if two manifests in the same source declare
// the same kind, the first is used and a warning is logged.
func MergeManifestsByKind(sources ...[]app.Manifest) []app.Manifest {
	// Highest-priority source first, so lower-priority sources drop a kind a
	// higher one already claimed.
	claimedBy := map[LowerGroupResource]kindClaim{}
	var merged []app.Manifest
	for i := len(sources) - 1; i >= 0; i-- {
		warnDuplicateKindsWithinSource(sources[i])
		for _, m := range sources[i] {
			if m.ManifestData == nil {
				merged = append(merged, m)
				continue
			}
			if kept, ok := pruneClaimedKinds(m, claimedBy); ok {
				merged = append(merged, kept)
			}
		}
	}
	// Output order does not matter: after pruning, each kind survives in exactly
	// one source.
	return merged
}

// warnDuplicateKindsWithinSource logs when two manifests in one source declare
// search fields for the same kind. That should not happen (a manifest is one
// app with a unique group, carrying all its kinds), so this only surfaces a
// malformed source; the merge keeps the first manifest's declaration.
func warnDuplicateKindsWithinSource(src []app.Manifest) {
	seen := map[LowerGroupResource]string{}
	for _, m := range src {
		if m.ManifestData == nil {
			continue
		}
		group := m.ManifestData.Group
		declared := map[LowerGroupResource]bool{}
		for _, v := range m.ManifestData.Versions {
			for _, k := range v.Kinds {
				if declaresSearchFields(k) {
					declared[NewLowerGroupResource(group, manifestResourceName(k))] = true
				}
			}
		}
		for key := range declared {
			if first, ok := seen[key]; ok {
				manifestMergeLogger.Warn("multiple manifests in one source declare search fields for the same kind, using the first",
					"group", key.Group, "resource", key.Resource, "first", first, "duplicate", m.ManifestData.AppName)
				continue
			}
			seen[key] = m.ManifestData.AppName
		}
	}
}

// declaresSearchFields reports whether a kind declares search fields. Only such
// kinds claim ownership in the merge; a kind without search fields (even one
// with selectable fields) never overrides another source's search fields.
func declaresSearchFields(k app.ManifestVersionKind) bool {
	return len(k.SearchFields) > 0
}

// kindClaim records the source that owns a kind and the versions it declared,
// so a lower-priority source can tell whether it is losing a version's fields.
type kindClaim struct {
	app      string
	versions map[string]bool
}

// pruneClaimedKinds drops kinds already claimed by a higher-priority source and
// records the ones it keeps. ok is false only when no kind survives, so a
// manifest whose kinds carry only selectable fields is kept: the merge output
// also drives selectable-field wiring, not just search fields.
func pruneClaimedKinds(m app.Manifest, claimedBy map[LowerGroupResource]kindClaim) (app.Manifest, bool) {
	group := m.ManifestData.Group
	appName := m.ManifestData.AppName

	md := *m.ManifestData
	versions := make([]app.ManifestVersion, 0, len(md.Versions))
	kept := map[LowerGroupResource]bool{}
	declaredVersions := map[LowerGroupResource]map[string]bool{}
	anyKind := false

	for _, v := range md.Versions {
		kinds := make([]app.ManifestVersionKind, 0, len(v.Kinds))
		for _, k := range v.Kinds {
			if !declaresSearchFields(k) {
				kinds = append(kinds, k) // kept for its selectable fields, if any
				anyKind = true
				continue
			}
			key := NewLowerGroupResource(group, manifestResourceName(k))
			if declaredVersions[key] == nil {
				declaredVersions[key] = map[string]bool{}
			}
			declaredVersions[key][v.Name] = true
			if _, taken := claimedBy[key]; taken {
				continue
			}
			kept[key] = true
			kinds = append(kinds, k)
			anyKind = true
		}
		v.Kinds = kinds
		versions = append(versions, v)
	}

	for key, declared := range declaredVersions {
		if kept[key] {
			claimedBy[key] = kindClaim{app: appName, versions: declared}
			continue
		}
		logOverriddenKind(key, appName, claimedBy[key], declared)
	}

	if !anyKind {
		return app.Manifest{}, false
	}
	md.Versions = versions
	return app.Manifest{ManifestData: &md, Location: m.Location}, true
}

// logOverriddenKind logs a kind dropped in favor of a higher-priority source. It
// warns when the dropped source declared versions the winner did not, since
// those versions lose their search fields; otherwise the override is expected.
func logOverriddenKind(key LowerGroupResource, droppedApp string, winner kindClaim, droppedVersions map[string]bool) {
	var lost []string
	for name := range droppedVersions {
		if !winner.versions[name] {
			lost = append(lost, name)
		}
	}
	if len(lost) > 0 {
		slices.Sort(lost)
		manifestMergeLogger.Warn("higher-priority manifest source overrides a kind but omits versions it declared; those versions lose their search fields",
			"group", key.Group, "resource", key.Resource, "winner", winner.app, "dropped", droppedApp, "lostVersions", strings.Join(lost, ","))
		return
	}
	manifestMergeLogger.Debug("kind overridden by higher-priority manifest source",
		"group", key.Group, "resource", key.Resource, "winner", winner.app, "dropped", droppedApp)
}
