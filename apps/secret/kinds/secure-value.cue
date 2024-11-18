package core

securevalue: {
	kind:  "SecureValue"
	group: "secret"
	apiResource: {
		scope:         "Namespaced"
		groupOverride: "secret.grafana.app"
		mutation:
			operations: ["create", "update"]
		validation:
			operations: ["create", "update"]
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "SecureValues"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					// Visible title for this secret
					title: string

					// The raw value is only valid for write.  Read/List will always be empty
					// Writing with an empty value will always fail
					value: string

					// The APIs that are allowed to decrypt this secret
					// Support and behavior is still TBD, but could likely look like:
					// * testdata.grafana.app/{name1}
					// * testdata.grafana.app/{name2}
					// * runner.k6.grafana.app  -- allow any k6 test runner
					// Rather than a string pattern, we may want a more explicit object:
					// [{ group:"testdata.grafana.app", name="name1"},
					//  { group:"runner.k6.grafana.app"}]
					apis: [...string]

					// Name of the manager
					// This is only supported in enterprise
					manager: string

					// When using a remote Key manager, the path is used to
					// reference a value inside the remote storage
					// NOTE: this value is only expected on write
					path: string
				}
			}
		}
	}
}
