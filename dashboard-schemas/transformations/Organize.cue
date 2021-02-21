package transformations

// Reorder, hide, or rename fields/columns.
#Organize: {
	// Transformation ID.
	id: string | *"organize"
	// Configuration options.
	options: {
		// Exclude fields by name.
		excludeByName: {}
		// Set field order by name.
		indexByName: {}
		// Rename a field by name.
		renameByName: {}
	}
}
