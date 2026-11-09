package folder

foldersV1: {
	kind:       "Folder"
	pluralName: "Folders"
	search: {
		hybrid: true
		global: true
	}
	embed: fields: [
		{name: "title", path: "spec.title"},
		{name: "description", path: "spec.description"},
	]

	schema: {
		spec: {
			title:        string
			description?: string
		}
		status: {
			// Progress of a finalizer-driven cascade delete. Absent until deletion starts.
			cascadeDelete?: #CascadeDeleteStatus
		}
		#CascadeDeleteStatus: {
			// Current phase of the cascade delete.
			state: "" | "Pending" | "InProgress" | "Completed" | "Failed"
			// Direct children discovered when the cascade started; the fixed denominator for remaining.
			total?: int64
			// Direct children not yet deleted, recomputed on each reconcile.
			remaining?: int64
			// Errors encountered while deleting direct children.
			errors?: [...string]
			// When the cascade started, in Unix milliseconds.
			started?: int64
			// When the cascade reached a terminal state, in Unix milliseconds.
			finished?: int64
		}
	}

	selectableFields: [
		"spec.title",
	]
}

foldersV1beta1: foldersV1
