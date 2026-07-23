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
		{
			Name:         SEARCH_FIELD_MANAGED_BY,
			Type:         SearchFieldTypeString,
			Capabilities: []SearchCapability{SearchCapabilityFacet},
			Description:  "Manager identity in format {kind}:{id}; used for faceting.",
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
