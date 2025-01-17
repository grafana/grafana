package advisor


plugincheck: {
	kind:       "PluginCheck"
	pluralName: "PluginChecks"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			schema: {
				spec: {
					// This can be customized per check
					data?: [string]: string
				}
				status: {
					report: #CheckReport
				}
			}
		}
	}
}
