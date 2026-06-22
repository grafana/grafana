package resource

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

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
	// on the keyword variant, which the authz searcher reads column-wise to
	// check folder permissions on every matching document.
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

	// CopyFromStandard copies a value from one of the IndexableDocument's
	// standard top-level fields into doc.Fields[Name]. Used to expose a
	// standard field (e.g. Created) under a resource-specific name in the
	// per-kind fields.* sub-document, because some top-level fields lack a
	// bleve FieldMapping and are otherwise unindexed / unretrievable.
	//
	// Mutually exclusive with Path: when CopyFromStandard is set, the
	// extractor reads from the already-built IndexableDocument instead of
	// from the raw JSON.
	//
	// This is a workaround for the current top-level mapping asymmetry.
	// A planned follow-up promotes Created, Updated and similar fields to
	// StandardSearchFieldDefinitions with their own top-level
	// FieldMappings; once that lands, kinds can read those fields directly
	// and the CopyFromStandard mirror becomes redundant.
	CopyFromStandard StandardField
}

// StandardField identifies a top-level field of IndexableDocument that
// CopyFromStandard can mirror into doc.Fields. The set is intentionally
// closed; adding a new value requires extending the switch in document.go.
type StandardField string

const (
	StandardFieldUnknown   StandardField = ""
	StandardFieldCreated   StandardField = "Created"
	StandardFieldUpdated   StandardField = "Updated"
	StandardFieldCreatedBy StandardField = "CreatedBy"
	StandardFieldUpdatedBy StandardField = "UpdatedBy"
)

// HasCapability reports whether the field declares the given capability.
func (f SearchFieldDefinition) HasCapability(c SearchCapability) bool {
	return slices.Contains(f.Capabilities, c)
}

// SearchFieldsFromTableColumns translates the legacy
// *resourcepb.ResourceTableColumnDefinition column list into the new internal
// SearchFieldDefinition representation. Bleve mapping code uses the new type
// while the rest of the codebase continues to declare fields with the protobuf
// type.
//
// Translation rules preserve current behavior:
//   - Filterable + STRING  -> [filter, retrieve]
//   - everything else      -> [retrieve]
//
// Nil entries are dropped. Protobuf types that have no corresponding
// SearchFieldType (OBJECT, BINARY, UNKNOWN_TYPE) yield SearchFieldTypeUnknown.
func SearchFieldsFromTableColumns(cols []*resourcepb.ResourceTableColumnDefinition) []SearchFieldDefinition {
	out := make([]SearchFieldDefinition, 0, len(cols))
	for _, c := range cols {
		if c == nil {
			continue
		}
		sf := SearchFieldDefinition{
			Name:        c.Name,
			Type:        searchFieldTypeFromProto(c.Type),
			Array:       c.IsArray,
			Description: c.Description,
		}
		if c.Properties != nil && c.Properties.Filterable && c.Type == resourcepb.ResourceTableColumnDefinition_STRING {
			sf.Capabilities = []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}
		} else {
			sf.Capabilities = []SearchCapability{SearchCapabilityRetrieve}
		}
		out = append(out, sf)
	}
	return out
}

// searchFieldTypeFromProto maps the protobuf column type to the new
// SearchFieldType. INT32 collapses into Int64 and FLOAT into Double:
// bleve stores both as float64 and the SFD type set does not preserve the
// distinction. DATE_TIME collapses to date because the new design omits a
// separate dateTime type. OBJECT, BINARY, and UNKNOWN_TYPE return
// SearchFieldTypeUnknown because they are not part of the new type set.
func searchFieldTypeFromProto(t resourcepb.ResourceTableColumnDefinition_ColumnType) SearchFieldType {
	switch t {
	case resourcepb.ResourceTableColumnDefinition_STRING:
		return SearchFieldTypeString
	case resourcepb.ResourceTableColumnDefinition_BOOLEAN:
		return SearchFieldTypeBoolean
	case resourcepb.ResourceTableColumnDefinition_INT32,
		resourcepb.ResourceTableColumnDefinition_INT64:
		return SearchFieldTypeInt64
	case resourcepb.ResourceTableColumnDefinition_FLOAT,
		resourcepb.ResourceTableColumnDefinition_DOUBLE:
		return SearchFieldTypeDouble
	case resourcepb.ResourceTableColumnDefinition_DATE,
		resourcepb.ResourceTableColumnDefinition_DATE_TIME:
		return SearchFieldTypeDate
	default:
		return SearchFieldTypeUnknown
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
	// Fields returns the declared search fields for the exact
	// GroupVersionResource. Returns nil if nothing is registered for that
	// key; the caller decides how to handle missing versions (usually by
	// retrying with PreferredVersion).
	//
	// The returned slice is owned by the provider; callers must not mutate
	// it.
	Fields(gvr schema.GroupVersionResource) []SearchFieldDefinition

	// PreferredVersion returns the served version that callers should use
	// when the requested apiVersion is unknown. Returns the empty string
	// when no preferred version has been registered.
	PreferredVersion(group, resource string) string

	// IndexAffectingHash returns a stable hex hash that mixes both the
	// shared StandardSearchFieldDefinitions and every per-(group, resource)
	// SearchFieldDefinition across all registered versions. Only fields
	// that change what gets indexed contribute: Name, Path, Type, Array,
	// Capabilities (sorted), EmitZeroIfAbsent, CopyFromStandard.
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
// Panics if any SearchFieldDefinition violates validateSearchFieldDefinitions
// (e.g. SearchCapabilitySort declared on a numeric or boolean type). Such a
// declaration is a programmer error in static configuration; the process
// cannot serve correct results with an invalid mapping.
func NewMapProvider(fields map[schema.GroupVersionResource][]SearchFieldDefinition, preferredVersions map[schema.GroupResource]string) SearchFieldsProvider {
	if fields == nil {
		fields = map[schema.GroupVersionResource][]SearchFieldDefinition{}
	}
	if preferredVersions == nil {
		preferredVersions = map[schema.GroupResource]string{}
	}
	for gvr, sfds := range fields {
		if err := validateSearchFieldDefinitions(sfds); err != nil {
			panic("invalid SearchFieldDefinitions for " + gvr.String() + ": " + err.Error())
		}
	}
	return &mapProvider{
		fields:           fields,
		preferredVersion: preferredVersions,
	}
}

// sortableTypes lists SearchFieldTypes that can carry SearchCapabilitySort
// under today's bleve mapper. The mapper emits a keyword/text mapping for
// every field regardless of Type, so sort works only for fields whose
// extracted value is already string-shaped. The allowlist is intentionally
// minimal: extend it when a concrete consumer needs sort on a new type.
var sortableTypes = []SearchFieldType{
	SearchFieldTypeString,
}

// validateSearchFieldDefinitions returns a non-nil error when any declaration
// uses a capability that the current bleve mapper cannot honour. The only
// rule enforced today is that SearchCapabilitySort requires a string-mapped
// Type; numeric and boolean fields would otherwise be sorted lexically
// because the mapper does not emit numeric mappings yet.
func validateSearchFieldDefinitions(sfds []SearchFieldDefinition) error {
	var violations []string
	for _, sfd := range sfds {
		if slices.Contains(sfd.Capabilities, SearchCapabilitySort) && !slices.Contains(sortableTypes, sfd.Type) {
			violations = append(violations, "field "+sfd.Name+": sort capability is not supported for type "+string(sfd.Type))
		}
	}
	if len(violations) == 0 {
		return nil
	}
	return errors.New(strings.Join(violations, "; "))
}

func (p *mapProvider) Fields(gvr schema.GroupVersionResource) []SearchFieldDefinition {
	return p.fields[gvr]
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
	CopyFromStandard StandardField      `json:"s,omitempty"`
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
			CopyFromStandard: sfd.CopyFromStandard,
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
