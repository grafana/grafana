package v1beta1

keeper: {
	kind:       "Keeper"
	pluralName: "Keepers"
	scope:      "Namespaced"

	// Keeper metadata is kept in the secrets service's own tables rather than
	// unified storage, so a search would always come back empty.
	search: {
		endpoint: false
	}
	schema: {
		spec:   KeeperSpec
		status: KeeperStatus
	}
}

securevalue: {
	kind:       "SecureValue"
	pluralName: "SecureValues"
	scope:      "Namespaced"

	// Secure value metadata is kept in the secrets service's own tables rather
	// than unified storage, so a search would always come back empty.
	search: {
		endpoint: false
	}
	schema: {
		spec:   SecureValueSpec
		status: SecureValueStatus
	}
}

manifest: {
	kinds: [securevalue, keeper]
	codegen: {
		ts: {
			enabled: false
		}
		go: {
			enabled: true
		}
	}
}
