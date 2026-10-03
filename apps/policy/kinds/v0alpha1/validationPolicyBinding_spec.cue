package v0alpha1

// Connects a ValidationPolicy in the same namespace to the actions taken when it is violated.
// The binding applies to resources in its own namespace.
#ValidationPolicyBindingSpec: {
	policyName: string
	actions: [...#Action]
	// Selects the parameter object, in the same namespace. Required when the policy declares
	// a paramKind. When the object does not exist, the binding does not apply.
	paramRef?: #ParamRef
}

// Deny rejects the request. Warn admits it and returns a warning to the caller.
#Action: "Deny" | "Warn"

#ParamRef: {
	name: string
}

#ValidationPolicyBindingStatus: {}
