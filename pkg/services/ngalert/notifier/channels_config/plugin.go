package channels_config

// NotifierPlugin holds meta information about a notifier.
type NotifierPlugin struct {
	Type        string           `json:"type"`
	Name        string           `json:"name"`
	Heading     string           `json:"heading"`
	Description string           `json:"description"`
	Info        string           `json:"info"`
	Options     []NotifierOption `json:"options"`
}

// VersionedNotifierPlugin represents a notifier plugin with multiple versions and detailed configuration options.
// It includes metadata such as type, name, description, and version-specific details.
type VersionedNotifierPlugin struct {
	Type           string                  `json:"type"`
	CurrentVersion NotifierVersion         `json:"currentVersion"`
	Name           string                  `json:"name"`
	Heading        string                  `json:"heading"`
	Description    string                  `json:"description"`
	Info           string                  `json:"info"`
	Versions       []NotifierPluginVersion `json:"versions"`
}

// GetVersion retrieves a specific version of the notifier plugin by its version string. Returns the version and a boolean indicating success.
func (p VersionedNotifierPlugin) GetVersion(v NotifierVersion) (NotifierPluginVersion, bool) {
	for _, version := range p.Versions {
		if version.Version == v {
			return version, true
		}
	}
	return NotifierPluginVersion{}, false
}

// GetCurrentVersion retrieves the current version of the notifier plugin based on the CurrentVersion property.
// Panics if the version specified in CurrentVersion is not found in the configured versions.
func (p VersionedNotifierPlugin) GetCurrentVersion() NotifierPluginVersion {
	v, ok := p.GetVersion(p.CurrentVersion)
	if !ok {
		panic("version not found for current version: " + p.CurrentVersion)
	}
	return v
}

// NotifierPluginVersion represents a version of a notifier plugin, including configuration options and metadata.
type NotifierPluginVersion struct {
	Version   NotifierVersion  `json:"version"`
	CanCreate bool             `json:"canCreate"`
	Options   []NotifierOption `json:"options"`
	Info      string           `json:"info"`
}

// NotifierOption holds information about options specific for the NotifierPlugin.
type NotifierOption struct {
	Element        ElementType      `json:"element"`
	InputType      InputType        `json:"inputType"`
	Label          string           `json:"label"`
	Description    string           `json:"description"`
	Placeholder    string           `json:"placeholder"`
	PropertyName   string           `json:"propertyName"`
	SelectOptions  []SelectOption   `json:"selectOptions"`
	ShowWhen       ShowWhen         `json:"showWhen"`
	Required       bool             `json:"required"`
	ValidationRule string           `json:"validationRule"`
	Secure         bool             `json:"secure"`
	DependsOn      string           `json:"dependsOn"`
	SubformOptions []NotifierOption `json:"subformOptions"`
}

// ElementType is the type of element that can be rendered in the frontend.
type ElementType string

const (
	// ElementTypeInput will render an input
	ElementTypeInput = "input"
	// ElementTypeSelect will render a select
	ElementTypeSelect = "select"
	// ElementTypeCheckbox will render a checkbox
	ElementTypeCheckbox = "checkbox"
	// ElementTypeTextArea will render a textarea
	ElementTypeTextArea = "textarea"
	// ElementTypeKeyValueMap will render inputs to add arbitrary key-value pairs
	ElementTypeKeyValueMap = "key_value_map"
	// ElementSubformArray will render a sub-form with schema defined in SubformOptions
	ElementTypeSubform = "subform"
	// ElementSubformArray will render a multiple sub-forms with schema defined in SubformOptions
	ElementSubformArray = "subform_array"
	// ElementStringArray will render a set of fields to manage an array of strings.
	ElementStringArray = "string_array"
)

// InputType is the type of input that can be rendered in the frontend.
type InputType string

const (
	// InputTypeText will render a text field in the frontend
	InputTypeText = "text"
	// InputTypePassword will render a password field in the frontend
	InputTypePassword = "password"
)

// SelectOption is a simple type for Options that have dropdown options. Should be used when Element is ElementTypeSelect.
type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// ShowWhen holds information about when options are dependant on other options.
// Should be used when Element is ElementTypeSelect.
// Does not work for ElementTypeCheckbox.
type ShowWhen struct {
	Field string `json:"field"`
	Is    string `json:"is"`
}
