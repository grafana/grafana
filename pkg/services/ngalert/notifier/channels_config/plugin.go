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
