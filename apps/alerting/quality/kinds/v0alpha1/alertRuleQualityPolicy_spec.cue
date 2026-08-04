package v0alpha1

// AlertRuleQualityPolicySpec is the org-wide definition of what a compliant
// Grafana-managed alert rule looks like.
//
// The kind is a per-org singleton: the only valid name is "default". Nothing in
// this module rejects other names — the admission check that does lives with the
// storage registration.
//
// What applies to an org with no resource is likewise decided by the consumer
// that serves the kind, not here.
AlertRuleQualityPolicySpec: {
	// requiredAnnotations lists the annotation keys every alert rule must set to
	// a non-empty value.
	//
	// Keys only, no per-key severity: required or not is the only axis a policy
	// expresses. Severity exists on findings and drives how the quality tab
	// ranks them, but it is a constant of the check, not a setting — so the tab
	// always ranks a missing runbook above a missing summary and that is not
	// configurable.
	//
	// Findings are reported in this order, so it is also the admin's chosen
	// order of importance.
	requiredAnnotations: [...string]

	// enforce turns the policy from advisory into a write-time gate: while it is
	// true, writes of rules that violate the policy are rejected.
	enforce: bool | *false
}
