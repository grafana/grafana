package kinds

grafana_upgrade_metadata: {
	kind:		"UpgradeMetadata"  // note: must be uppercase
	pluralName:	"UpgradeMetadatas" // note: must be uppercase
	current:	"v0alpha1"
	apiResource: {
		groupOverride: "upgrades.grafana.app"
	}
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: true
				backend:  true
			}
			schema: {
				spec: {
					starting_version: 	string
					target_version: 	string
					state: *"new" | "dismissed" | "failed" | "succeeded"
				}
			}
		}
	}
}
