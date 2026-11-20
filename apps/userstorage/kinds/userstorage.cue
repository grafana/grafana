package userstorage

userStorageV0alpha1: {
	kind:       "UserStorage"
	pluralName: "UserStorages"
	resource:   "user-storage"
	scope:      "Namespaced"

	// Access is decided by the user uid embedded in the name, not by a folder.
	// The router enforces it (pluginroute hardcodedOwnerFromName) until the
	// naming strategy can declare a <service>:<user_uid> name.
	folderScoped: false

	schema: {
		spec: {
			// Data is the key:value stored in the user storage for a service.
			data: [string]: string
		}
	}
}
