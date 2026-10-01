package v0alpha1

// TeamLBACRuleStatus reports whether the stored rule can currently be
// enforced. The status is computed from datasource state and is not part of
// the canonical rule data in spec.
TeamLBACRuleStatus: {
	// conditions contains system-owned observations about the rule. The
	// Enforceable condition is the only condition currently defined.
	// +listType=map
	// +listMapKey=type
	conditions?: [...#Condition]
}

// Condition is a minimal Kubernetes-style condition for dynamically computed
// Team LBAC status.
#Condition: {
	// type identifies the condition. Enforceable is the only type currently
	// defined for TeamLBACRule.
	type: string
	// status is True when the rule is enforceable, False when it is dormant,
	// and Unknown when enforceability could not be determined.
	status: "True" | "False" | "Unknown" @cog(kind="enum",memberNames="True|False|Unknown")
	// reason is a stable, machine-readable explanation for the current status.
	// It is intentionally open-ended so clients tolerate reasons added later.
	reason: string
}
