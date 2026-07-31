package resource

// StandardSearchFieldDefinitions returns the standard searchable fields that
// every kind shares, in their internal SearchFieldDefinition form. The bleve
// mapping builder iterates this list to emit top-level field mappings.
//
// Not every standard field appears here. Fields excluded:
//
//   - Pseudo / wire-only columns (_id, _legacy_id, _score, _explain,
//     _all_columns, rv, kind, namespace, group/resource): they exist solely
//     to populate ResourceTable column metadata in the gRPC response and are
//     not indexed.
//   - Sub-document fields under "manager." and "source.": nested documents
//     whose bleve mappings are emitted hardcoded.
//   - Fields under "labels." and "reference.": open key sets, served by
//     dynamic bleve mappings rather than static field declarations.
func StandardSearchFieldDefinitions() []SearchFieldDefinition {
	return []SearchFieldDefinition{
		{
			Name:         SEARCH_FIELD_NAME,
			Type:         SearchFieldTypeString,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort},
			Description:  "Kubernetes name. Unique identifier within a namespace+group+resource.",
		},
		{
			Name: SEARCH_FIELD_TITLE,
			Type: SearchFieldTypeString,
			// Title gets every capability today: keyword variant (title_phrase)
			// for filtering, exact match, sorting, and DocValues-backed reads;
			// text variant for full-token search; ngram for partial matching.
			Capabilities: []SearchCapability{
				SearchCapabilityFilter,
				SearchCapabilityText,
				SearchCapabilityPartial,
				SearchCapabilitySort,
				SearchCapabilityRetrieve,
			},
			Description: "Display name for the resource.",
		},
		{
			Name: SEARCH_FIELD_DESCRIPTION,
			Type: SearchFieldTypeString,
			// unranked: description is indexed as text (the proto column declares
			// FreeText:true), but no caller scores against it today; skipping
			// BM25 frequency and length stats keeps the index small.
			Capabilities: []SearchCapability{SearchCapabilityText, SearchCapabilityRetrieve, SearchCapabilityUnranked},
			Description:  "Free-text description of the resource.",
		},
		{
			Name:         SEARCH_FIELD_TAGS,
			Type:         SearchFieldTypeString,
			Array:        true,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityFacet, SearchCapabilityRetrieve},
			Description:  "Unique tags.",
		},
		{
			Name: SEARCH_FIELD_FOLDER,
			Type: SearchFieldTypeString,
			// sort here unlocks DocValues on the keyword variant. The authz
			// searcher reads folder column-wise via DocValues for every
			// matching document; sort capability is the same implementation
			// requirement.
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort, SearchCapabilityRetrieve},
			Description:  "Kubernetes name of the folder containing the resource.",
		},
		{
			Name:         SEARCH_FIELD_CREATED_BY,
			Type:         SearchFieldTypeString,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
			Description:  "Who created the resource (format: user:<uid>).",
		},
		{
			Name:         SEARCH_FIELD_OWNER_REFERENCES,
			Type:         SearchFieldTypeString,
			Array:        true,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
			Description:  "Owner references in format {Group}/{Kind}/{Name}.",
		},
		// Objects with no manager hold an empty value here, so "unmanaged only" is a
		// filter for the empty string and "anything managed" is one against it.
		{
			Name:         SEARCH_FIELD_MANAGED_BY,
			Type:         SearchFieldTypeString,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityFacet},
			Description:  "Manager identity in format {kind}:{id}, empty when unmanaged.",
		},
		// created and updated are unix-millis timestamps, mapped as numeric bleve
		// fields and stored so retrieve returns the value in search results. They
		// are retrieve-only: filtering would need range queries, which the search
		// API does not support (and exact-millisecond equality is not a useful
		// query), and sort would first require every index to carry the numeric
		// mapping.
		{
			Name:         SEARCH_FIELD_CREATED,
			Type:         SearchFieldTypeInt64,
			Capabilities: []SearchCapability{SearchCapabilityRetrieve},
			Description:  "Creation timestamp (unix millis).",
		},
		{
			Name:         SEARCH_FIELD_UPDATED,
			Type:         SearchFieldTypeInt64,
			Capabilities: []SearchCapability{SearchCapabilityRetrieve},
			Description:  "Update timestamp (unix millis).",
		},
	}
}

// TrashSearchFieldDefinitions returns the fields only a deleted document carries.
// Kept out of the standard set, which is hashed into IndexAffectingHash (adding to
// it rebuilds every index with a search fields provider) and is what the /search
// field set is built from.
//
// Capabilities mirror trashFieldSet() in the search API layer: if the two
// disagree, a request the API layer accepts misbehaves here.
//
// title and folder are absent on purpose, so trash serves them from the standard
// declarations and analyzes them exactly as live search does.
func TrashSearchFieldDefinitions() []SearchFieldDefinition {
	return []SearchFieldDefinition{
		{
			Name:         SEARCH_FIELD_DELETED_BY,
			Type:         SearchFieldTypeString,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort, SearchCapabilityRetrieve},
			Description:  "Who deleted the resource (format: user:<uid>).",
		},
		// Numeric so it sorts in time order rather than lexically, and so a retention
		// window can be a range query later. Milliseconds are exact as a float64, which
		// is how bleve stores numbers.
		{
			Name:         SEARCH_FIELD_DELETION_TIME,
			Type:         SearchFieldTypeInt64,
			Capabilities: []SearchCapability{SearchCapabilitySort, SearchCapabilityRetrieve},
			Description:  "Deletion timestamp (unix millis).",
		},
		// A string, unlike deletion_time: resource versions are snowflake ids around
		// 1.8e18, where a float64 can only represent multiples of 256, so a number
		// would come back rounded. Restore submits this value, so it has to be exact.
		{
			Name:         SEARCH_FIELD_DELETED_RV,
			Type:         SearchFieldTypeString,
			Capabilities: []SearchCapability{SearchCapabilityRetrieve},
			Description:  "Resource version of the delete.",
		},
	}
}

// Derived once: fixed at build time, read on every search request.
var trashSearchFieldNames = func() map[string]bool {
	names := map[string]bool{}
	for _, def := range TrashSearchFieldDefinitions() {
		names[def.Name] = true
	}
	return names
}()

// IsTrashSearchField reports whether name is a field only deleted documents carry.
func IsTrashSearchField(name string) bool {
	return trashSearchFieldNames[name]
}
