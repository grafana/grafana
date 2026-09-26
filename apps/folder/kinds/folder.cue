package folder

foldersV1: {
	kind:       "Folder"
	pluralName: "Folders"
	embed: fields: [
		{name: "title", path: "spec.title"},
		{name: "description", path: "spec.description"},
	]

	schema: {
		spec: {
			title:        string
			description?: string
		}
		// status.cascadeDelete is a PoC field for async, finalizer-driven cascade deletion of a
		// folder's subtree. See pkg/registry/apis/folders/cascade_delete_controller.go.
		// NOTE: apps/folder/pkg/apis/folder/v1/folder_status_gen.go and folder_object_gen.go's
		// Status wiring were hand-written to match this shape rather than generated from it —
		// re-run app-sdk codegen to reconcile.
		status: {
			cascadeDelete?: {
				state?:    string
				remaining: int64
				errors?: [...string]
				started?:  int64
				finished?: int64
			}
		}
	}

	selectableFields: [
		"spec.title",
	]
}

foldersV1beta1: foldersV1
