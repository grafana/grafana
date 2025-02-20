package utils

import "time"

// ManagerProperties is used to identify the manager of the resource.
//
// This is used to identify the manager of the resource.
//
// The manager kind is the type of manager, such as "ui", "api/generic", "api/kubectl", or "api/terraform".
//
// The manager identity is the identity of the manager, such as the username of the user who created the resource,
// or the name of the tool that created the resource.
//
// The is exclusive flag indicates whether the manager is the exclusive owner of the resource.
// If set to true, then only updates coming from the manager will be accepted.
type ManagerProperties struct {
	Kind        ManagerKind
	Identity    string
	AllowsEdits bool
	Suspended   bool
}

// ManagerKind is the type of manager, which is responsible for managing the resource.
// It can be a user or a tool or a generic API client.
type ManagerKind string

// Known values for ManagerKind.
const (
	ManagerKindUnknown   ManagerKind = ""
	ManagerKindRepo      ManagerKind = "repo"
	ManagerKindTerraform ManagerKind = "terraform"
	ManagerKindKubectl   ManagerKind = "kubectl"
)

// ParseManagerKindString parses a string into a ManagerKind.
// It returns the ManagerKind and a boolean indicating whether the string was a valid ManagerKind.
// For unknown values, it returns ManagerKindUnknown and false.
func ParseManagerKindString(v string) ManagerKind {
	switch v {
	case string(ManagerKindRepo):
		return ManagerKindRepo
	case string(ManagerKindTerraform):
		return ManagerKindTerraform
	case string(ManagerKindKubectl):
		return ManagerKindKubectl
	default:
		return ManagerKindUnknown
	}
}

// SourceProperties is used to identify the source of a provisioned resource.
// It is used by managers for reconciling data from a source to Grafana.
// Not all managers use these properties, some (like Terraform) don't have a concept of a source.
type SourceProperties struct {
	Path      string
	Hash      string
	Timestamp time.Time
}
