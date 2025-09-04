package v1beta1

keeper: {
	kind:       "Keeper"
	pluralName: "Keepers"
	scope:      "Namespaced"
	schema: {
		spec: KeeperSpec
	}
}

securevalue: {
	kind:       "SecureValue"
	pluralName: "SecureValues"
	scope:      "Namespaced"
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
