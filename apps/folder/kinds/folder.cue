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
		#CascadeDeleteStatus: {
			// state is the current phase of the cascade-delete operation.
			state: "" | "Pending" | "InProgress" | "Completed" | "Failed"
			// total is the count of resources discovered under this folder when the
			// cascade-delete operation started. Needed to make remaining (and any
			// progress percentage a client derives from it) meaningful, since it's
			// the fixed denominator both are measured against.
			total?: int64
			// remaining is the count of resources not yet deleted.
			remaining?: int64
			// errors lists the errors encountered while deleting resources.
			errors?: [...string]
			// started is when the cascade-delete operation began (Unix milliseconds).
			started?: int64
			// finished is when the cascade-delete operation completed (Unix milliseconds).
			finished?: int64
		}

		spec: {
			title:        string
			description?: string
		}

		status: {
			// cascadeDelete reports the progress of an in-flight cascade deletion of this
			// folder, driven by the folder controller via the CascadeDeleteFinalizer.
			cascadeDelete?: #CascadeDeleteStatus
		}
	}

	selectableFields: [
		"spec.title",
	]
}

foldersV1beta1: foldersV1
