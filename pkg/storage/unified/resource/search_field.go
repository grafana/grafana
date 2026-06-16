package resource

import (
	"slices"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

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
}

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
func NewMapProvider(fields map[schema.GroupVersionResource][]SearchFieldDefinition, preferredVersions map[schema.GroupResource]string) SearchFieldsProvider {
	if fields == nil {
		fields = map[schema.GroupVersionResource][]SearchFieldDefinition{}
	}
	if preferredVersions == nil {
		preferredVersions = map[schema.GroupResource]string{}
	}
	return &mapProvider{
		fields:           fields,
		preferredVersion: preferredVersions,
	}
}

func (p *mapProvider) Fields(gvr schema.GroupVersionResource) []SearchFieldDefinition {
	return p.fields[gvr]
}

func (p *mapProvider) PreferredVersion(group, resource string) string {
	return p.preferredVersion[schema.GroupResource{Group: group, Resource: resource}]
}
