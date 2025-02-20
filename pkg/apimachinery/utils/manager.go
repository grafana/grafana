package utils

import "time"

// ManagerProperties is used to identify the manager of the resource.
type ManagerProperties struct {
	// The kind of manager, which is responsible for managing the resource.
	// Examples include "git", "terraform", "kubectl", etc.
	Kind ManagerKind

	// The identity of the manager, which refers to a specific instance of the manager.
	// The format & the value depends on the manager kind.
	Identity string

	// AllowsEdits indicates whether the manager allows edits to the resource.
	// If set to true, it means that other requesters can edit the resource.
	AllowsEdits bool

	// Suspended indicates whether the manager is suspended.
	// If set to true, then the manager skip updates to the resource.
	Suspended bool
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
	// The path to the source of the resource.
	// Can be a file path, a URL, etc.
	Path string

	// The checksum of the source of the resource.
	// An example could be a git commit hash.
	Checksum string

	// The timestamp of the source of the resource.
	// An example could be the file modification time.
	Timestamp time.Time
}
