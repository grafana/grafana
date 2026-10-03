package v0alpha1

// What alert rules in the namespace must and must not carry. A namespace may have several
// RulePolicies; a rule must satisfy all of them.
#RulePolicySpec: {
	// What happens when an alert rule write breaks the policy. Deny rejects the write. Warn admits
	// it with a warning, so a policy can be assessed before it is enforced.
	enforcement: #Enforcement
	// Labels that must be present and non-empty on every alert rule.
	requiredLabels?: [...string]
	// Annotations that must be present and non-empty on every alert rule.
	requiredAnnotations?: [...string]
	// Labels that must not be present on any alert rule, even with an empty value.
	forbiddenLabels?: [...string]
	// Annotations that must not be present on any alert rule, even with an empty value.
	forbiddenAnnotations?: [...string]
}

#Enforcement: "Deny" | "Warn"

#RulePolicyStatus: {}
