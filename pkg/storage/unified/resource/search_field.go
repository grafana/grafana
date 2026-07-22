package resource

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/searchfields"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var searchFieldLogger = log.New("search-field-hash")

// SearchCapability identifies what a search field can be used for at query
// time. The set is intentionally small and orthogonal; combinations produce
// internal index fields (see pkg/storage/unified/search/bleve_mappings.go).
//
// Analyzer references below are Bleve-specific.
type SearchCapability string

const (
	SearchCapabilityFilter SearchCapability = "filter" // exact-match filtering (Bleve keyword analyzer)
	SearchCapabilityText   SearchCapability = "text"   // full-token search (Bleve standard analyzer)
	// SearchCapabilityPartial enables substring matching (Bleve ngram
	// analyzer). Requires SearchCapabilityText.
	SearchCapabilityPartial SearchCapability = "partial"
	// SearchCapabilitySort makes the field sortable. It also enables DocValues
	// on the keyword variant for column-wise reads and stable sort tie-breakers.
	SearchCapabilitySort     SearchCapability = "sort"
	SearchCapabilityFacet    SearchCapability = "facet"    // facetable on the keyword variant
	SearchCapabilityRetrieve SearchCapability = "retrieve" // value is stored and returned in search results
	// SearchCapabilityUnranked applies only to text fields. It drops per-term
	// frequency stats and field-length norms from the index, saving space at
	// the cost of BM25 ranking quality. Use it for text fields that are
	// indexed (for example so the value can be retrieved or matched) but are
	// never queried in a scored context. Redundant on filter / facet / sort
	// fields: keyword variants are always exact-match and never carry BM25
	// stats.
	SearchCapabilityUnranked SearchCapability = "unranked"
)

// SearchFieldType is the value type of a search field.
// The design intentionally omits a separate dateTime type; use date or int64.
type SearchFieldType string

const (
	// SearchFieldTypeUnknown is the zero value, used for column shapes that
	// have no corresponding SearchFieldType (OBJECT, BINARY, UNKNOWN_TYPE from
	// the protobuf enum). Downstream switches can reference it by name.
	SearchFieldTypeUnknown SearchFieldType = ""
	SearchFieldTypeString  SearchFieldType = "string"
	// SearchFieldTypeInt64 covers integer-shaped fields. The protobuf column
	// enum distinguishes INT32 and INT64; this SFD type set collapses them
	// into a single int64. Standard fields never use INT32 today, and
	// numeric search behaviour is identical (bleve indexes through float64
	// internally).
	SearchFieldTypeInt64 SearchFieldType = "int64"
	// SearchFieldTypeDouble covers floating-point fields. The protobuf-level
	// distinction between FLOAT and DOUBLE is similarly collapsed; SFDs use
	// float64 for both.
	SearchFieldTypeDouble  SearchFieldType = "double"
	SearchFieldTypeBoolean SearchFieldType = "boolean"
	SearchFieldTypeDate    SearchFieldType = "date"
)

// SearchFieldDefinition is the internal representation of a single searchable
// field declared by a kind's manifest. It replaces the use of
// *resourcepb.ResourceTableColumnDefinition for search-mapping decisions.
// The protobuf type stays as the wire format for legacy table responses.
type SearchFieldDefinition struct {
	// Name is the logical field name as declared in the manifest.
	// It must be unique within a (group, resource, version) and must not
	// collide with any of the standard field names (the SEARCH_FIELD_*
	// constants in document.go).
	Name string

	// Path is the JSON path inside the resource that supplies this field's
	// value (e.g. "spec.email", "spec.members[*].name"). An empty Path marks
	// the field as computed: the standard extractor does not populate it and
	// a custom builder is expected to fill it in.
	Path string

	// Type is the value type produced by Path or by a custom builder.
	Type SearchFieldType

	// Array indicates that the field carries a list of values of Type.
	Array bool

	// Capabilities lists what the field can be used for at query time.
	// Order is not significant.
	Capabilities []SearchCapability

	// Description is informational; not used for indexing decisions.
	Description string

	// EmitZeroIfAbsent makes the path extractor emit the type's zero value
	// (false, 0, 0.0, "", or an empty array) when Path resolves to nil.
	// Without it, missing paths are skipped and the field is absent from the
	// indexed document. Set this when sort or range queries depend on every
	// document having the field present.
	EmitZeroIfAbsent bool
}

// HasCapability reports whether the field declares the given capability.
func (f SearchFieldDefinition) HasCapability(c SearchCapability) bool {
	return slices.Contains(f.Capabilities, c)
}

// SearchFieldDefinitionsToTableColumns builds legacy
// *resourcepb.ResourceTableColumnDefinition entries from a list of
// SearchFieldDefinitions. Used by the unified bleve search response and
// the IAM legacy SQL backends, both of which still populate column
// metadata in their wire-API responses. Both consumers go away when the
// new search endpoint replaces them.
//
// Lossy by design: SFD is search-only, so Properties.UniqueValues and
// Properties.NotNull are not carried over; SearchFieldTypeInt64 maps to
// INT64 (was sometimes INT32 in hand-written column-defs). Filterable is
// set when the SFD has SearchCapabilityFilter; FreeText when it has
// SearchCapabilityText. Name, Description, IsArray pass through.
func SearchFieldDefinitionsToTableColumns(sfds []SearchFieldDefinition) []*resourcepb.ResourceTableColumnDefinition {
	out := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(sfds))
	for _, def := range sfds {
		col := &resourcepb.ResourceTableColumnDefinition{
			Name:        def.Name,
			Type:        protoTypeFromSearchFieldType(def.Type),
			IsArray:     def.Array,
			Description: def.Description,
		}
		filterable := def.HasCapability(SearchCapabilityFilter)
		freeText := def.HasCapability(SearchCapabilityText)
		if filterable || freeText {
			col.Properties = &resourcepb.ResourceTableColumnDefinition_Properties{
				Filterable: filterable,
				FreeText:   freeText,
			}
		}
		out = append(out, col)
	}
	return out
}

// TableColumnsByName keys the table columns by field name, so the IAM legacy
// SQL search backends can look one up by a requested field name.
func TableColumnsByName(sfds []SearchFieldDefinition) map[string]*resourcepb.ResourceTableColumnDefinition {
	cols := SearchFieldDefinitionsToTableColumns(sfds)
	out := make(map[string]*resourcepb.ResourceTableColumnDefinition, len(cols))
	for _, c := range cols {
		out[c.Name] = c
	}
	return out
}

// protoTypeFromSearchFieldType maps a SearchFieldType back to its proto
// counterpart. SearchFieldType does not preserve INT32 / FLOAT / DATE_TIME
// distinctions, so this returns the wider variant (INT64, DOUBLE, DATE)
// in every case.
func protoTypeFromSearchFieldType(t SearchFieldType) resourcepb.ResourceTableColumnDefinition_ColumnType {
	switch t {
	case SearchFieldTypeString:
		return resourcepb.ResourceTableColumnDefinition_STRING
	case SearchFieldTypeInt64:
		return resourcepb.ResourceTableColumnDefinition_INT64
	case SearchFieldTypeDouble:
		return resourcepb.ResourceTableColumnDefinition_DOUBLE
	case SearchFieldTypeBoolean:
		return resourcepb.ResourceTableColumnDefinition_BOOLEAN
	case SearchFieldTypeDate:
		return resourcepb.ResourceTableColumnDefinition_DATE
	default:
		return resourcepb.ResourceTableColumnDefinition_UNKNOWN_TYPE
	}
}

// SearchFieldsProvider is the read-only interface that consumers of the new
// manifest-driven search metadata use to ask "what searchable fields does this
// (group, version, resource) declare?"
//
// The provider is keyed by schema.GroupVersionResource. For requests that
// carry an apiVersion the server does not know about, callers may fall back
// to PreferredVersion. That fallback is the consumer's responsibility; the
// Fields method itself does not perform it.
type SearchFieldsProvider interface {
	// Fields returns the declared search fields for a GroupVersionResource.
	// With a non-empty Version only that version's fields are returned.
	// With an empty Version Fields returns every field declared by any
	// version of (group, resource); a field declared in multiple versions
	// appears once, with the preferred version's declaration.
	//
	// When the same field name is declared in multiple served versions of
	// (group, resource), all declarations must agree on Type, Array, and
	// Capabilities — the attributes that feed into the kind's bleve
	// mapping. NewMapProvider rejects diverging declarations at
	// construction time. Path, EmitZeroIfAbsent, and Description may
	// differ across versions: they are extractor- or
	// presentation-side and the extractor applies them per-document with
	// the document's own version's declaration. The returned slice is
	// owned by the provider; do not mutate it.
	Fields(gvr schema.GroupVersionResource) []SearchFieldDefinition

	// PreferredVersion returns the served version that callers should use
	// when the requested apiVersion is unknown. Returns the empty string
	// when no preferred version has been registered.
	PreferredVersion(group, resource string) string

	// IndexAffectingHash returns a stable hex hash that mixes both the
	// shared StandardSearchFieldDefinitions and every per-(group, resource)
	// SearchFieldDefinition across all registered versions. Only fields
	// that change what gets indexed contribute: Name, Path, Type, Array,
	// Capabilities (sorted), and EmitZeroIfAbsent.
	// Description is intentionally excluded so presentation-only edits do
	// not trigger a rebuild.
	//
	// Including the standard set means a change to the shared mapping
	// shifts every registered kind's hash, which is the intended trigger
	// for an automatic rebuild via IndexBuildInfo.SearchFieldsHash.
	//
	// Returns the empty string when no SearchFieldDefinitions are
	// registered for the (group, resource). Callers treat "" as "no
	// expected hash" and skip the rebuild check.
	IndexAffectingHash(group, resource string) string
}

// mapProvider is an in-memory SearchFieldsProvider populated from Go-level
// registrations. It is the default implementation until the provider can read
// declarations directly from CUE-generated manifest data.
type mapProvider struct {
	fields           map[schema.GroupVersionResource][]SearchFieldDefinition
	preferredVersion map[schema.GroupResource]string
}

// NewMapProvider returns a SearchFieldsProvider backed by the given in-memory
// maps. Both arguments may be nil. The provider takes ownership of the maps;
// callers must not mutate them after the call.
//
// Panics on an invalid definition: in static build-time config that is a
// programmer error. Runtime callers use newMapProvider instead.
func NewMapProvider(fields map[schema.GroupVersionResource][]SearchFieldDefinition, preferredVersions map[schema.GroupResource]string) SearchFieldsProvider {
	p, err := newMapProvider(fields, preferredVersions)
	if err != nil {
		panic(err.Error())
	}
	return p
}

// newMapProvider is NewMapProvider's error-returning core, so a caller
// ingesting definitions at runtime can reject a bad set instead of crashing.
func newMapProvider(fields map[schema.GroupVersionResource][]SearchFieldDefinition, preferredVersions map[schema.GroupResource]string) (SearchFieldsProvider, error) {
	if fields == nil {
		fields = map[schema.GroupVersionResource][]SearchFieldDefinition{}
	}
	if preferredVersions == nil {
		preferredVersions = map[schema.GroupResource]string{}
	}
	for gvr, sfds := range fields {
		if err := validateSearchFieldDefinitions(sfds); err != nil {
			return nil, fmt.Errorf("invalid SearchFieldDefinitions for %s: %w", gvr.String(), err)
		}
	}
	if err := validateCrossVersionConsistency(fields); err != nil {
		return nil, fmt.Errorf("inconsistent SearchFieldDefinitions across versions: %w", err)
	}
	return &mapProvider{
		fields:           fields,
		preferredVersion: preferredVersions,
	}, nil
}

// mappingAttributes is the bleve-mapping-affecting projection of a
// SearchFieldDefinition used for cross-version equality. Only Type, Array,
// and Capabilities count: those are what GetBleveMappings reads to produce
// the kind's mapping, which is built once per (group, resource) from the
// union across versions. Path and EmitZeroIfAbsent are extractor-side
// concerns applied per-document with the document's own
// version's declaration, so they may legitimately differ between versions.
// Description is presentation-only.
//
// Capabilities are sorted, deduplicated, and joined into a single string so
// the struct is directly comparable with ==.
type mappingAttributes struct {
	Type         SearchFieldType
	Array        bool
	Capabilities string
}

func mappingAttributesOf(sfd SearchFieldDefinition) mappingAttributes {
	caps := slices.Clone(sfd.Capabilities)
	slices.Sort(caps)
	caps = slices.Compact(caps)
	capStrs := make([]string, len(caps))
	for i, c := range caps {
		capStrs[i] = string(c)
	}
	return mappingAttributes{
		Type:         sfd.Type,
		Array:        sfd.Array,
		Capabilities: strings.Join(capStrs, ","),
	}
}

// diffMappingAttributes returns the names of the attributes that differ
// between two projections, in a fixed order so error messages are
// deterministic.
func diffMappingAttributes(a, b mappingAttributes) []string {
	var diffs []string
	if a.Type != b.Type {
		diffs = append(diffs, "type")
	}
	if a.Array != b.Array {
		diffs = append(diffs, "array")
	}
	if a.Capabilities != b.Capabilities {
		diffs = append(diffs, "capabilities")
	}
	return diffs
}

// validateCrossVersionConsistency rejects declarations where two served
// versions of the same (group, resource) declare a field with the same
// name but a different Type, Array flag, or Capabilities set. The bleve
// mapping for a kind is built once per (group, resource) from the union
// across versions: divergence on a mapping-affecting attribute would
// silently pick one and lose the other, producing different query results
// depending on which version's declaration the indexer happened to read
// first.
//
// A field declared by only one version is fine: union without conflict.
// Path, EmitZeroIfAbsent, and Description may differ
// across versions: they do not feed into the mapping and the extractor
// applies them per-document with the document's own version's declaration.
func validateCrossVersionConsistency(fields map[schema.GroupVersionResource][]SearchFieldDefinition) error {
	type versionedField struct {
		version    string
		attributes mappingAttributes
	}
	perGroupResource := map[schema.GroupResource]map[string][]versionedField{}
	for gvr, sfds := range fields {
		gr := gvr.GroupResource()
		if perGroupResource[gr] == nil {
			perGroupResource[gr] = map[string][]versionedField{}
		}
		for _, sfd := range sfds {
			perGroupResource[gr][sfd.Name] = append(perGroupResource[gr][sfd.Name], versionedField{
				version:    gvr.Version,
				attributes: mappingAttributesOf(sfd),
			})
		}
	}
	var violations []string
	grs := make([]schema.GroupResource, 0, len(perGroupResource))
	for gr := range perGroupResource {
		grs = append(grs, gr)
	}
	slices.SortFunc(grs, func(a, b schema.GroupResource) int {
		if c := strings.Compare(a.Group, b.Group); c != 0 {
			return c
		}
		return strings.Compare(a.Resource, b.Resource)
	})
	for _, gr := range grs {
		names := perGroupResource[gr]
		sortedNames := make([]string, 0, len(names))
		for name := range names {
			sortedNames = append(sortedNames, name)
		}
		slices.Sort(sortedNames)
		for _, name := range sortedNames {
			entries := names[name]
			if len(entries) < 2 {
				continue
			}
			slices.SortFunc(entries, func(a, b versionedField) int { return strings.Compare(a.version, b.version) })
			// Compare every other version against the first sorted entry and
			// collect the union of differing attributes. The first entry is
			// just the reference point.
			var diffs []string
			for _, e := range entries[1:] {
				for _, d := range diffMappingAttributes(entries[0].attributes, e.attributes) {
					if !slices.Contains(diffs, d) {
						diffs = append(diffs, d)
					}
				}
			}
			if len(diffs) == 0 {
				continue
			}
			versions := make([]string, len(entries))
			for i, e := range entries {
				versions[i] = e.version
			}
			violations = append(violations, fmt.Sprintf("field %q on %s diverges across versions [%s] on %s", name, gr.String(), strings.Join(versions, ", "), strings.Join(diffs, ", ")))
		}
	}
	if len(violations) == 0 {
		return nil
	}
	return errors.New(strings.Join(violations, "; "))
}

// validateSearchFieldDefinitions returns a non-nil error when any declaration
// pairs a capability with a field type that cannot support it. The rules live
// in the shared searchfields package, which the app-SDK codegen validator also
// uses, so the two cannot drift: text, partial and facet require a string
// type; sort works on string, numeric and boolean; filter, retrieve and
// unranked work on any type.
func validateSearchFieldDefinitions(sfds []SearchFieldDefinition) error {
	var violations []string
	for _, sfd := range sfds {
		caps := make([]string, len(sfd.Capabilities))
		for i, c := range sfd.Capabilities {
			caps[i] = string(c)
		}
		if err := searchfields.Validate(string(sfd.Type), caps); err != nil {
			violations = append(violations, "field "+sfd.Name+": "+err.Error())
		}
	}
	if len(violations) == 0 {
		return nil
	}
	return errors.New(strings.Join(violations, "; "))
}

func (p *mapProvider) Fields(gvr schema.GroupVersionResource) []SearchFieldDefinition {
	if gvr.Version != "" {
		return p.fields[gvr]
	}
	// Empty version: return the union across every registered version of
	// (gvr.Group, gvr.Resource), deduplicated by Name. Preferred version
	// goes first, other versions are iterated in sorted order, so the
	// returned slice is deterministic. Cross-version consistency on Type,
	// Array, and Capabilities is enforced by NewMapProvider, so the dedup
	// never has to choose between conflicting mappings for the same name.
	var out []SearchFieldDefinition
	seen := map[string]bool{}
	appendNew := func(sfds []SearchFieldDefinition) {
		for _, sfd := range sfds {
			if seen[sfd.Name] {
				continue
			}
			seen[sfd.Name] = true
			out = append(out, sfd)
		}
	}
	pref := p.PreferredVersion(gvr.Group, gvr.Resource)
	if pref != "" {
		appendNew(p.fields[schema.GroupVersionResource{Group: gvr.Group, Version: pref, Resource: gvr.Resource}])
	}
	var otherVersions []string
	for key := range p.fields {
		if key.Group == gvr.Group && key.Resource == gvr.Resource && key.Version != pref {
			otherVersions = append(otherVersions, key.Version)
		}
	}
	slices.Sort(otherVersions)
	for _, v := range otherVersions {
		appendNew(p.fields[schema.GroupVersionResource{Group: gvr.Group, Version: v, Resource: gvr.Resource}])
	}
	return out
}

func (p *mapProvider) PreferredVersion(group, resource string) string {
	return p.preferredVersion[schema.GroupResource{Group: group, Resource: resource}]
}

// hashableField is the canonical projection of a SearchFieldDefinition used
// when computing the index-affecting hash. JSON tags are short so the
// marshalled form stays compact. The wire format is never exposed to
// callers, but it is the input to SHA-256 and the resulting hex is
// persisted in every index's IndexBuildInfo. Any change to the field set,
// tags, or sort order of this struct shifts every previously-computed hash
// and triggers a one-time reindex for every kind that uses
// SearchFieldsProvider — treat it as part of the on-disk format.
type hashableField struct {
	Name             string             `json:"n"`
	Path             string             `json:"p,omitempty"`
	Type             SearchFieldType    `json:"t"`
	Array            bool               `json:"a,omitempty"`
	Capabilities     []SearchCapability `json:"c,omitempty"`
	EmitZeroIfAbsent bool               `json:"z,omitempty"`
}

type hashableVersion struct {
	Version string          `json:"v"`
	Fields  []hashableField `json:"f"`
}

// hashablePayload is the canonical hash input. Standard search fields
// (shared by every kind) are mixed in alongside per-(group, resource)
// versioned fields so that changes to the standard set shift every kind's
// hash and trigger a rebuild via the SearchFieldsHash check.
type hashablePayload struct {
	Standard []hashableField   `json:"s"`
	Versions []hashableVersion `json:"v"`
}

// canonicalHashableFields normalises a SearchFieldDefinition slice into
// hashableField form: capabilities sorted, fields sorted by name, only the
// index-affecting subset retained.
func canonicalHashableFields(sfds []SearchFieldDefinition) []hashableField {
	fields := make([]hashableField, 0, len(sfds))
	for _, sfd := range sfds {
		caps := slices.Clone(sfd.Capabilities)
		slices.Sort(caps)
		fields = append(fields, hashableField{
			Name:             sfd.Name,
			Path:             sfd.Path,
			Type:             sfd.Type,
			Array:            sfd.Array,
			Capabilities:     caps,
			EmitZeroIfAbsent: sfd.EmitZeroIfAbsent,
		})
	}
	slices.SortFunc(fields, func(a, b hashableField) int {
		return strings.Compare(a.Name, b.Name)
	})
	return fields
}

func (p *mapProvider) IndexAffectingHash(group, resource string) string {
	var versions []string
	for gvr := range p.fields {
		if gvr.Group == group && gvr.Resource == resource {
			versions = append(versions, gvr.Version)
		}
	}
	if len(versions) == 0 {
		return ""
	}
	slices.Sort(versions)

	versionPayloads := make([]hashableVersion, 0, len(versions))
	for _, v := range versions {
		gvr := schema.GroupVersionResource{Group: group, Version: v, Resource: resource}
		versionPayloads = append(versionPayloads, hashableVersion{
			Version: v,
			Fields:  canonicalHashableFields(p.fields[gvr]),
		})
	}
	payload := hashablePayload{
		Standard: canonicalHashableFields(StandardSearchFieldDefinitions()),
		Versions: versionPayloads,
	}

	// json.Marshal can only return a non-nil error for inputs it cannot
	// encode — cyclic graphs, channels/funcs, float NaN/Inf, or types with a
	// failing MarshalJSON. payload is a slice of structs whose fields are
	// strings, bools, and slices of strings, none of which can produce any of
	// those failure modes today. The branch below is defensive: if a future
	// change introduces a type that can fail, returning "" silently disables
	// the search-field-change rebuild trigger for this kind — the log line
	// is the only way an operator would notice.
	blob, err := json.Marshal(payload)
	if err != nil {
		searchFieldLogger.Error("failed to marshal canonical search fields for hashing", "group", group, "resource", resource, "err", err)
		return ""
	}
	sum := sha256.Sum256(blob)
	return hex.EncodeToString(sum[:])
}

// SearchFieldsRegistry holds the per-kind search-field wiring shared by the
// index backend (which builds the bleve mapping) and the search server (which
// decides when an index must be rebuilt). A mutex guards all three maps so a
// future live-manifest source can replace them together, keeping the mapping
// the backend builds and the hash the server compares consistent.
type SearchFieldsRegistry struct {
	mu                   sync.RWMutex
	selectableFields     map[LowerGroupResource][]string
	searchFieldsHashes   map[LowerGroupResource]string
	searchFieldsProvider map[LowerGroupResource]SearchFieldsProvider
}

// NewSearchFieldsRegistry returns a registry seeded with the given per-kind
// maps. Nil maps are allowed; lookups then return zero values.
func NewSearchFieldsRegistry(
	selectableFields map[LowerGroupResource][]string,
	searchFieldsHashes map[LowerGroupResource]string,
	searchFieldsProvider map[LowerGroupResource]SearchFieldsProvider,
) *SearchFieldsRegistry {
	return &SearchFieldsRegistry{
		selectableFields:     selectableFields,
		searchFieldsHashes:   searchFieldsHashes,
		searchFieldsProvider: searchFieldsProvider,
	}
}

// For returns the mapping inputs for a kind: its selectable fields, the hash of
// its search-field definitions, and the provider that drives its bleve mapping.
func (r *SearchFieldsRegistry) For(key LowerGroupResource) (selectableFields []string, hash string, provider SearchFieldsProvider) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.selectableFields[key], r.searchFieldsHashes[key], r.searchFieldsProvider[key]
}

// Replace atomically swaps all three maps. Callers must not mutate the maps
// afterwards. A live-manifest source uses this to reload search fields.
func (r *SearchFieldsRegistry) Replace(
	selectableFields map[LowerGroupResource][]string,
	searchFieldsHashes map[LowerGroupResource]string,
	searchFieldsProvider map[LowerGroupResource]SearchFieldsProvider,
) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.selectableFields = selectableFields
	r.searchFieldsHashes = searchFieldsHashes
	r.searchFieldsProvider = searchFieldsProvider
}
