package v0alpha1

import "k8s.io/apimachinery/pkg/runtime/schema"

const (
	// APIGroup is the API group used by all kinds in this package
	APIGroup = "rules.alerting.grafana.app"
	// APIVersion is the API version used by all kinds in this package
	APIVersion = "v0alpha1"
)

var (
	// GroupVersion is a schema.GroupVersion consisting of the Group and Version constants for this package
	GroupVersion = schema.GroupVersion{
		Group:   APIGroup,
		Version: APIVersion,
	}
)
