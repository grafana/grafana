package kinds

// This is our ExampleKind definition, which contains kind metadata. It is the same across all versions of the kind.
exampleKind: {
    // Name is the human-readable name which is used for generated type names.
    kind: "Example"
    // Scope determines the scope of the kind in the API server. It currently allows two values:
    // * Namespaced - resources for this kind are created inside namespaces
    // * Cluster - resource for this kind are always cluster-wide (this can be thought of as a "global" namespace)
    // If not present, this defaults to "Namespaced"
    scope: "Namespaced"
    // [OPTIONAL]
    // The human-readable plural form of the "name" field.
    // Will default to <name>+"s" if not present.
    pluralName: "Examples"
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
    conversion: true
    // [OPTIONAL]
    // Codegen is a trait that tells the grafana-app-sdk, or other code generation tooling, how to process this kind.
    // If not present, default values within the codegen trait are used.
    // If you wish to specify codegen per-version, put this section in the version's object
    // (for example, exampleKindv1alpha1) instead.
    codegen: {
        // [OPTIONAL]
        // ts contains TypeScript code generation properties for the kind
        ts: {
            // [OPTIONAL]
            // enabled indicates whether the CLI should generate front-end TypeScript code for the kind.
            // Defaults to true if not present.
            enabled: true
        }
        // [OPTIONAL]
        // go contains go code generation properties for the kind
        go: {
            // [OPTIONAL]
            // enabled indicates whether the CLI should generate back-end go code for the kind.
            // Defaults to true if not present.
            enabled: true
        }
    }
}
