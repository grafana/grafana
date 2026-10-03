package v0alpha1

// A set of CEL validations applied to resources of one or more kinds when they are written.
// The shape follows Kubernetes ValidatingAdmissionPolicy.
#ValidationPolicySpec: {
	// Selects the resources the policy applies to. The policy is type-checked against the
	// schema of every kind and version it matches.
	match: [...#ResourceMatch]
	// Further filters matched resources. All conditions must be true for the policy to apply.
	matchConditions?: [...#NamedExpression]
	// Named expressions available as variables.<name> to later variables, match conditions
	// and validations.
	variables?: [...#NamedExpression]
	// The rules a matched resource must satisfy.
	validations: [...#Validation]
	// How evaluation errors are treated. Fail treats them as violations; Ignore drops them.
	failurePolicy?: #FailurePolicy
	// The kind of the parameter object available to expressions as params. Bindings select
	// the parameter object with paramRef.
	paramKind?: #ParamKind
}

#ResourceMatch: {
	group: string
	versions: [...string]
	kinds: [...string]
	// Defaults to CREATE and UPDATE.
	operations?: [...#Operation]
}

#Operation: "CREATE" | "UPDATE" | "DELETE"

#NamedExpression: {
	name:       string
	expression: string
}

#Validation: {
	// Identifies the validation in results. Defaults to its index.
	name?:      string
	expression: string
	// Returned when the validation fails.
	message?: string
	// A CEL expression returning the message. Takes precedence over message.
	messageExpression?: string
	// Machine-readable reason returned when the validation fails. Defaults to Invalid.
	reason?: #Reason
	// The field responsible for the failure, e.g. "spec.labels".
	fieldPath?: string
}

#Reason: "Invalid" | "Forbidden" | "Unauthorized"

#FailurePolicy: "Fail" | "Ignore"

#ParamKind: {
	group:   string
	version: string
	kind:    string
}

#ValidationPolicyStatus: {
	// Errors from the most recent attempt to compile the policy.
	compileErrors?: [...string]
}
