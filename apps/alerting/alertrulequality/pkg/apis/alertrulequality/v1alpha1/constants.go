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
)
