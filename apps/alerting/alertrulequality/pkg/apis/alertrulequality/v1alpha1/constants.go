package v1alpha1

import "k8s.io/apimachinery/pkg/runtime/schema"

const (
	// APIGroup is the API group used by all kinds in this package.
	APIGroup = "alertrulequality.grafana.app"
	// APIVersion is the API version used by all kinds in this package.
	APIVersion = "v1alpha1"

	OpenAPIPrefix = "com.github.grafana.grafana.apps.alerting.alertrulequality.pkg.apis.alertrulequality.v1alpha1."

	// DefaultPolicyName is the only accepted name for an AlertRuleQualityPolicy. The
	// policy is org-wide, so it is a singleton and admission rejects any other name.
	DefaultPolicyName = "default"
)

var (
	// GroupVersion is a schema.GroupVersion consisting of the Group and Version constants for this package.
	GroupVersion = schema.GroupVersion{
		Group:   APIGroup,
		Version: APIVersion,
	}

	// SuggestedAnnotations is the starting point offered to an admin who has not
	// configured a policy yet: it is what the settings UI prefills and what the alert
	// quality view reports against.
	//
	// It is deliberately NOT a fallback for enforcement. A required annotation rejects
	// rule writes, so an org with no policy, or a policy with an empty list, requires
	// nothing. Consumers that validate must read the policy; only consumers that
	// display or prefill may fall back to this list.
	SuggestedAnnotations = []string{"summary", "description", "runbook_url"}
)
