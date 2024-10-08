package search

// Only string fields are supported for now - no nested objects or arrays.
func specFieldMappings(kind string) map[string][]string {
	mapping := map[string][]string{}

	// Add playlist mappings
	mapping["playlist"] = []string{
		"spec.title",
		"spec.interval",
	}

	return mapping
}
