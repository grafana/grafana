package search

// esBulkActionMeta builds bulk action metadata with optional external_gte versioning.
// When rv > 0, Elasticsearch only applies the write when rv is >= the stored version.
func esBulkActionMeta(index, id string, rv int64) map[string]any {
	meta := map[string]any{"_index": index, "_id": id}
	if rv > 0 {
		meta["version"] = rv
		meta["version_type"] = "external_gte"
	}
	return meta
}
