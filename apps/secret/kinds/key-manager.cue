package core

keymanager: {
	kind:  "KeyManager"
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
	pluralName: "KeyManagers"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					#AWSKMSConfig: {
						arn: string
					}

					// User visible title for the key manager
					title: string

					// The APIs that are allowed to decrypt this secret
					provider: "awskms" @cuetsy(kind="enum")

					// Used when provider == awskms
					awskms?: #AWSKMSConfig
				}
			}
		}
	}
}
