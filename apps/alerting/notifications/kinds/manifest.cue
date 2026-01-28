package kinds

manifest: {
	appName:       "alerting-notifications"
	groupOverride: "notifications.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				receiverv0alpha1,
				routeTreev0alpha1,
				templatev0alpha1,
				timeIntervalv0alpha1,
			]
			routes: {
				namespaced: {
					"/receivers/schema": {
						"GET": {
							response: {
								schemas: [...#IntegrationTypeSchema]
							}
							responseMetadata: typeMeta: false
						}
					}
				}
			}
		}
	}
}

// Schema definitions for receiver schema endpoint response

#Field: {
	element:        string
	inputType:      string
	label:          string
	description:    string
	placeholder:    string
	propertyName:   string
	selectOptions?: [...#SelectOption] | null
	showWhen:       #ShowWhen
	required:       bool
	protected?:     bool
	validationRule: string
	secure:         bool
	dependsOn:      string
	subformOptions?: [...#Field] | null
}

#SelectOption: {
	label:       string
	value:       string | number
	description: string
}

#ShowWhen: {
	field: string
	is:    string
}

// IntegrationTypeSchema - receiver integration schema format
#IntegrationTypeSchema: {
	type:           string
	currentVersion: string
	name:           string
	heading?:       string
	description?:   string
	info?:          string
	versions: [...#IntegrationSchemaVersion]
	deprecated?: bool
}

#IntegrationSchemaVersion: {
	typeAlias?: string
	version:    string
	canCreate:  bool
	options: [...#Field]
	info?:       string
	deprecated?: bool
}
