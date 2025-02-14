package v1alpha1

import "k8s.io/apimachinery/pkg/runtime/schema"

const (
	// Group is the API group used by all kinds in this package
	Group = "investigation.grafana.app"
	// Version is the API version used by all kinds in this package
	Version = "v1alpha1"
)

var (
	// GroupVersion is a schema.GroupVersion consisting of the Group and Version constants for this package
	GroupVersion = schema.GroupVersion{
		Group:   Group,
		Version: Version,
	}
)
