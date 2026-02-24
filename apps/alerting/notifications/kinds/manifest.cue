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
				inhibitionRulev0alpha1,
				receiverv0alpha1,
				routeTreev0alpha1,
				templatev0alpha1,
				timeIntervalv0alpha1,
			]
			routes: {
				namespaced: {
					"/integrationtypeschemas": {
						"GET": {
							response: {
								items: [...#IntegrationTypeSchemaResource]
							}
							responseMetadata: typeMeta: false
						}
					}
				}
			}
		}
	}
	roles: {}
}

// Schema definitions for integration type schema endpoint response

#Field: {
	element:      string
	inputType:    string
	label:        string
	description:  string
	placeholder:  string
	propertyName: string
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
	versions: [...#IntegrationTypeSchemaVersion]
	deprecated?: bool
}

#IntegrationTypeSchemaVersion: {
	typeAlias?: string
	version:    string
	canCreate:  bool
	options: [...#Field]
	info?:       string
	deprecated?: bool
}

// IntegrationTypeSchemaResource - K8s-style wrapper for integration type schemas
#IntegrationTypeSchemaResource: {
	metadata: {
		name:      string
		namespace: string
	}
	spec: #IntegrationTypeSchema
}
