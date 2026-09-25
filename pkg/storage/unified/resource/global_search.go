package resource

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"slices"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GlobalSearchFieldsHash fingerprints what a namespace-wide index contains: its
// field set and the resource types it covers. An existing index recording a
// different value is rebuilt.
//
// The field set has to be here: it decides the mapping, and the mapping is part
// of the stored index. The covered types are here only for now. Without them an
// index reused after a type is added would never hold that type's existing
// objects, and one reused after a type is dropped would keep serving them. A full
// rebuild is the wrong answer to a coverage change, though: adding one type to a
// long list should index only that type. This has to be replaced by syncing just
// the types that changed before the index is switched on by default.
func GlobalSearchFieldsHash() string {
	covered := make([]string, 0, len(GlobalSearchResourceTypes()))
	for _, gr := range GlobalSearchResourceTypes() {
		covered = append(covered, gr.String())
	}
	slices.Sort(covered)

	payload := struct {
		Fields  []hashableField `json:"f"`
		Covered []string        `json:"c"`
	}{
		Fields:  canonicalHashableFields(GlobalSearchFieldDefinitions()),
		Covered: covered,
	}

	blob, err := json.Marshal(payload)
	if err != nil {
		// Returning nothing disables the rebuild-on-change check, so the log line is
		// the only sign. See IndexAffectingHash for why this cannot happen today.
		searchFieldLogger.Error("failed to marshal the namespace-wide search fields for hashing", "err", err)
		return ""
	}
	sum := sha256.Sum256(blob)
	return hex.EncodeToString(sum[:])
}

// GlobalSearchResourceTypes lists the resource types a namespace-wide index
// covers.
//
// Written out for now. The list is meant to come from the manifests, with each
// kind opting in, which also gives the owner of a kind somewhere to say so.
// Until then it stays short and explicit, because adding a type means checking
// how its documents are authorized first.
func GlobalSearchResourceTypes() []schema.GroupResource {
	return []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "folder.grafana.app", Resource: "folders"},
	}
}

// keepStandardFieldsOnly drops what a document carries for its own resource type,
// leaving the fields every resource has.
//
// A namespace-wide index declares no resource-specific fields, so these values
// would be built, handed over, and dropped by the index, once per document and
// with a warning each time.
func keepStandardFieldsOnly(doc *IndexableDocument) *IndexableDocument {
	if doc == nil {
		return nil
	}
	doc.Fields = nil
	doc.SelectableFields = nil
	return doc
}

// indexSources returns the resource types whose documents belong in the index
// for key. A namespace-wide index draws from every covered type; every other
// index draws from its own type only.
func indexSources(key NamespacedResource) []NamespacedResource {
	if !key.IsGlobal() {
		return []NamespacedResource{key}
	}
	types := GlobalSearchResourceTypes()
	out := make([]NamespacedResource, 0, len(types))
	for _, gr := range types {
		out = append(out, NamespacedResource{
			Namespace: key.Namespace,
			Group:     gr.Group,
			Resource:  gr.Resource,
		})
	}
	return out
}

// GlobalSearchFieldDefinitions returns the searchable fields of a
// namespace-wide index. It starts from the standard set, because such an index
// holds nothing resource-specific, and differs in two ways:
//
//   - The resource type of each document is filterable, so a query can pick out
//     one type from an index holding several.
//   - created and updated are filterable and sortable, so results of different
//     types can be ordered by time. The per-resource indexes cannot have this
//     yet: indexing those fields changes the index-affecting hash and would
//     rebuild every index in the deployment.
func GlobalSearchFieldDefinitions() []SearchFieldDefinition {
	standard := StandardSearchFieldDefinitions()
	out := make([]SearchFieldDefinition, 0, len(standard)+1)
	out = append(out, SearchFieldDefinition{
		Name: SEARCH_FIELD_GROUP_RESOURCE,
		Type: SearchFieldTypeString,
		// Faceted as well as filtered, so a caller can count how many hits each
		// resource type contributed without a query per type.
		Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityFacet},
		Description:  "Resource type of the document, as {group}/{resource}.",
	})
	for _, def := range standard {
		if def.Name == SEARCH_FIELD_CREATED || def.Name == SEARCH_FIELD_UPDATED {
			def.Capabilities = append(slices.Clone(def.Capabilities), SearchCapabilityFilter, SearchCapabilitySort)
		}
		out = append(out, def)
	}
	return out
}

// IndexFieldDefinitions returns the field sets an index declares beyond its own
// resource's fields: the standard fields, and the fields only a deleted document
// carries. A namespace-wide index has its own standard set and holds no deleted
// documents, so it declares no deleted-document fields.
func IndexFieldDefinitions(group, resource string) (standard, deleted []SearchFieldDefinition) {
	key := NamespacedResource{Group: group, Resource: resource}
	if key.IsGlobal() {
		return GlobalSearchFieldDefinitions(), nil
	}
	return StandardSearchFieldDefinitions(), TrashSearchFieldDefinitions()
}
