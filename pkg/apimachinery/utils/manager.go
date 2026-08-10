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
	ManagerKindGrafana   ManagerKind = "grafana"

	// ManagerKindClassicFP marks resources that originate from the
	// legacy on-disk file provisioning system (dashboards, folders, correlations,
	// alerting with the "file" provenance). The manager identity, when present, is
	// the provisioner/reader name from the provisioning config. Previously this was
	// a "file:" prefix.
	//
	// Deprecated: shim/migration path only. New resources should use a real manager
	// kind (repo, terraform, kubectl, ...).
	ManagerKindClassicFP ManagerKind = "classic-file-provisioning"

	// ManagerKindClassicAPI marks resources created through the legacy provisioning
	// HTTP API (alerting "api" provenance) where the concrete tool that made the
	// call was not recorded, so there is no meaningful manager identity.
	//
	// Deprecated: shim/migration path only. Prefer ManagerKindTerraform,
	// ManagerKindKubectl, etc. for new resources.
	ManagerKindClassicAPI ManagerKind = "classic-api-provisioning"

	// ManagerKindClassicConvertedPrometheus marks resources imported by the Grafana
	// Alerting "Convert Prometheus" API, which converts Prometheus/Mimir/Cortex rule
	// groups into Grafana-managed rules (alerting "converted_prometheus" provenance).
	// The import has no owning manager instance, so there is no manager identity.
	//
	// Deprecated: shim/migration path only.
	ManagerKindClassicConvertedPrometheus ManagerKind = "classic-converted-prometheus"
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
	case string(ManagerKindGrafana):
		return ManagerKindGrafana
	case string(ManagerKindClassicFP): // nolint:staticcheck
		return ManagerKindClassicFP // nolint:staticcheck
	case string(ManagerKindClassicAPI): // nolint:staticcheck
		return ManagerKindClassicAPI // nolint:staticcheck
	case string(ManagerKindClassicConvertedPrometheus): // nolint:staticcheck
		return ManagerKindClassicConvertedPrometheus // nolint:staticcheck
	default:
		return ManagerKindUnknown
	}
}

// IsClassic returns true for shim kinds that represent legacy provisioning
// mechanisms (file/API provisioning, converted Prometheus). These origins have no
// stable per-instance manager, so unlike other kinds they are considered managed
// even without a manager Identity. Because their identity is absent or unstable, it
// must not be treated as immutable the way user-defined identities are.
func (k ManagerKind) IsClassic() bool {
	switch k { //nolint:staticcheck
	case ManagerKindClassicFP, ManagerKindClassicAPI, ManagerKindClassicConvertedPrometheus:
		return true
	default:
		return false
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
