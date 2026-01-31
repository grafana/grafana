package v0alpha1

IntegrationTypeSchemaSpec: {
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
