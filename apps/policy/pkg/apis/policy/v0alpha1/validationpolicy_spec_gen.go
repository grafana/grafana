// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ValidationPolicyResourceMatch struct {
	Group    string   `json:"group"`
	Versions []string `json:"versions"`
	Kinds    []string `json:"kinds"`
	// Defaults to CREATE and UPDATE.
	Operations []ValidationPolicyOperation `json:"operations,omitempty"`
}

// NewValidationPolicyResourceMatch creates a new ValidationPolicyResourceMatch object.
func NewValidationPolicyResourceMatch() *ValidationPolicyResourceMatch {
	return &ValidationPolicyResourceMatch{
		Versions: []string{},
		Kinds:    []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyResourceMatch.
func (ValidationPolicyResourceMatch) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyResourceMatch"
}

// +k8s:openapi-gen=true
type ValidationPolicyOperation string

const (
	ValidationPolicyOperationCREATE ValidationPolicyOperation = "CREATE"
	ValidationPolicyOperationUPDATE ValidationPolicyOperation = "UPDATE"
	ValidationPolicyOperationDELETE ValidationPolicyOperation = "DELETE"
)

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyOperation.
func (ValidationPolicyOperation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyOperation"
}

// +k8s:openapi-gen=true
type ValidationPolicyNamedExpression struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
}

// NewValidationPolicyNamedExpression creates a new ValidationPolicyNamedExpression object.
func NewValidationPolicyNamedExpression() *ValidationPolicyNamedExpression {
	return &ValidationPolicyNamedExpression{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyNamedExpression.
func (ValidationPolicyNamedExpression) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyNamedExpression"
}

// +k8s:openapi-gen=true
type ValidationPolicyValidation struct {
	// Identifies the validation in results. Defaults to its index.
	Name       *string `json:"name,omitempty"`
	Expression string  `json:"expression"`
	// Returned when the validation fails.
	Message *string `json:"message,omitempty"`
	// A CEL expression returning the message. Takes precedence over message.
	MessageExpression *string `json:"messageExpression,omitempty"`
	// Machine-readable reason returned when the validation fails. Defaults to Invalid.
	Reason *ValidationPolicyReason `json:"reason,omitempty"`
	// The field responsible for the failure, e.g. "spec.labels".
	FieldPath *string `json:"fieldPath,omitempty"`
}

// NewValidationPolicyValidation creates a new ValidationPolicyValidation object.
func NewValidationPolicyValidation() *ValidationPolicyValidation {
	return &ValidationPolicyValidation{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyValidation.
func (ValidationPolicyValidation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyValidation"
}

// +k8s:openapi-gen=true
type ValidationPolicyReason string

const (
	ValidationPolicyReasonInvalid      ValidationPolicyReason = "Invalid"
	ValidationPolicyReasonForbidden    ValidationPolicyReason = "Forbidden"
	ValidationPolicyReasonUnauthorized ValidationPolicyReason = "Unauthorized"
)

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyReason.
func (ValidationPolicyReason) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyReason"
}

// +k8s:openapi-gen=true
type ValidationPolicyFailurePolicy string

const (
	ValidationPolicyFailurePolicyFail   ValidationPolicyFailurePolicy = "Fail"
	ValidationPolicyFailurePolicyIgnore ValidationPolicyFailurePolicy = "Ignore"
)

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyFailurePolicy.
func (ValidationPolicyFailurePolicy) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyFailurePolicy"
}

// +k8s:openapi-gen=true
type ValidationPolicyParamKind struct {
	Group   string `json:"group"`
	Version string `json:"version"`
	Kind    string `json:"kind"`
}

// NewValidationPolicyParamKind creates a new ValidationPolicyParamKind object.
func NewValidationPolicyParamKind() *ValidationPolicyParamKind {
	return &ValidationPolicyParamKind{}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicyParamKind.
func (ValidationPolicyParamKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicyParamKind"
}

// +k8s:openapi-gen=true
type ValidationPolicySpec struct {
	// Selects the resources the policy applies to. The policy is type-checked against the
	// schema of every kind and version it matches.
	Match []ValidationPolicyResourceMatch `json:"match"`
	// Further filters matched resources. All conditions must be true for the policy to apply.
	MatchConditions []ValidationPolicyNamedExpression `json:"matchConditions,omitempty"`
	// Named expressions available as variables.<name> to later variables, match conditions
	// and validations.
	Variables []ValidationPolicyNamedExpression `json:"variables,omitempty"`
	// The rules a matched resource must satisfy.
	Validations []ValidationPolicyValidation `json:"validations"`
	// How evaluation errors are treated. Fail treats them as violations; Ignore drops them.
	FailurePolicy *ValidationPolicyFailurePolicy `json:"failurePolicy,omitempty"`
	// The kind of the parameter object available to expressions as params. Bindings select
	// the parameter object with paramRef.
	ParamKind *ValidationPolicyParamKind `json:"paramKind,omitempty"`
}

// NewValidationPolicySpec creates a new ValidationPolicySpec object.
func NewValidationPolicySpec() *ValidationPolicySpec {
	return &ValidationPolicySpec{
		Match:       []ValidationPolicyResourceMatch{},
		Validations: []ValidationPolicyValidation{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ValidationPolicySpec.
func (ValidationPolicySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.policy.pkg.apis.policy.v0alpha1.ValidationPolicySpec"
}
