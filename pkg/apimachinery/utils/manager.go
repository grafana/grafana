package utils

// ManagerProperties is used to identify the manager of the resource.
type ManagerProperties struct {
	// The kind of manager, which is responsible for managing the resource.
	// Examples include "git", "terraform", "kubectl", etc.
	Kind ManagerKind `json:"kind,omitempty"`

	// The identity of the manager, which refers to a specific instance of the manager.
	// The format & the value depends on the manager kind.
	Identity string `json:"id,omitempty"`

	// AllowsEdits indicates whether the manager allows edits to the resource.
	// If set to true, it means that other requesters can edit the resource.
	AllowsEdits bool `json:"allowEdits,omitempty"`

	// Suspended indicates whether the manager is suspended.
	// If set to true, then the manager skip updates to the resource.
	Suspended bool `json:"suspended,omitempty"`
}

// ManagerKind is the type of manager, which is responsible for managing the resource.
// It can be a user or a tool or a generic API client.
// +enum
type ManagerKind string

// Known values for ManagerKind.
const (
	ManagerKindUnknown   ManagerKind = ""
	ManagerKindRepo      ManagerKind = "repo"
	ManagerKindTerraform ManagerKind = "terraform"
	ManagerKindKubectl   ManagerKind = "kubectl"
	ManagerKindPlugin    ManagerKind = "plugin"

	// Deprecated: this is used as a shim/migration path for legacy file provisioning
	// Previously this was a "file:" prefix
	ManagerKindClassicFP ManagerKind = "classic-file-provisioning"
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
	case string(ManagerKindPlugin):
		return ManagerKindPlugin
	case string(ManagerKindClassicFP): // nolint:staticcheck
		return ManagerKindClassicFP // nolint:staticcheck
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
	Path string `json:"path,omitempty"`

	// The checksum of the source of the resource.
	// An example could be a git commit hash.
	Checksum string `json:"checksum,omitempty"`

	// The unix millis timestamp of the source of the resource.
	// An example could be the file modification time.
	TimestampMillis int64 `json:"timestampMillis,omitempty"`
}
