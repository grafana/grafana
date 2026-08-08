package advisor

manifest: {
	appName:       "advisor"
	groupOverride: "advisor.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				checkv0alpha1,
				checktypev0alpha1,
			]
			routes: {
				namespaced: {
					"/register": {
						"POST": {
							name: "createRegister"
							response: {
								message: string
							}
						}
					}
					"/translations": {
						"GET": {
							name: "getTranslations"
							response: {
								// Flat map of i18n key -> translated string for the requested locale.
								translations: [string]: string
							}
						}
					}
				}
			}
		}
	}
	roles: {}
}
