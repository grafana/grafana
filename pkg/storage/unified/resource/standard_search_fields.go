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
			Capabilities: []SearchCapability{SearchCapabilityFilter},
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
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
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
		// created and updated are advertised in the proto column list but were
		// never indexed before this declaration. Capabilities here are a
		// compromise:
		//
		//   - retrieve: the actual intent — surface the timestamp in search
		//     results so clients can display it.
		//   - filter: required only because the bleve capability mapper does
		//     not currently emit a mapping for retrieve-only fields. Filter
		//     gives us a keyword mapping with Store: true. Exact-ms equality
		//     filters are not a useful query and we expect no consumer to rely
		//     on them.
		//   - sort: omitted because the mapper emits a keyword mapping
		//     regardless of Type, so int64 values would sort lexically.
		//
		// The end state is store-only with proper numeric semantics; both
		// require a type-aware mapper, tracked as a follow-up.
		{
			Name:         SEARCH_FIELD_CREATED,
			Type:         SearchFieldTypeInt64,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
			Description:  "Creation timestamp (unix millis).",
		},
		{
			Name:         SEARCH_FIELD_UPDATED,
			Type:         SearchFieldTypeInt64,
			Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
			Description:  "Update timestamp (unix millis).",
		},
	}
}
