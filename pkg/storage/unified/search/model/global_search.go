package model

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"slices"

	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GlobalSearchFieldsHash fingerprints the field set of a namespace-wide index,
// which decides its mapping. An existing index recording a different value is
// rebuilt.
//
// The covered types are not part of it: the index records which types it holds,
// and the rebuild scan adds or removes only the types that changed.
func GlobalSearchFieldsHash() string {
	payload := struct {
		Fields []hashableField `json:"f"`
	}{
		Fields: canonicalHashableFields(GlobalSearchFieldDefinitions()),
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

// GlobalIndexCoversType reports whether a global index holds documents of this
// resource type.
func GlobalIndexCoversType(gr schema.GroupResource) bool {
	return slices.Contains(GlobalSearchResourceTypes(), gr)
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
	key := resourcecontract.NamespacedResource{Group: group, Resource: resource}
	if key.IsGlobal() {
		return GlobalSearchFieldDefinitions(), nil
	}
	return StandardSearchFieldDefinitions(), TrashSearchFieldDefinitions()
}
