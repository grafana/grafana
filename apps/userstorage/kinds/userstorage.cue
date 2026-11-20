package userstorage

userStorageV0alpha1: {
	kind:       "UserStorage"
	pluralName: "UserStorages"
	resource:   "user-storage"
	scope:      "Namespaced"

	// Access is decided by the user uid embedded in the name, not by a folder.
	folderScoped: false

	// The name of a new object must hold the uid of the user creating it.
	validation: {
		operations: [
			"CREATE",
		]
	}

	schema: {
		spec: {
			// Data is the key:value stored in the user storage for a service.
			data: [string]: string
		}
	}
}
