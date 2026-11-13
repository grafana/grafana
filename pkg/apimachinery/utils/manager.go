package utils

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

	// ManagerKindFileProvisioning marks resources configured by a file the instance was
	// started with. Unlike ManagerKindClassicFP it is not a migration shim.
	ManagerKindFileProvisioning ManagerKind = "file-provisioning"

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
	case string(ManagerKindFileProvisioning):
		return ManagerKindFileProvisioning
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

// terraformUserAgentPattern matches the User-Agent based manager ID format used by Terraform providers.
// Format: "Terraform/{version} (+https://www.terraform.io) terraform-provider-{name}/{version}"
// Example: "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0"
var terraformUserAgentPattern = regexp.MustCompile(`^Terraform/[^ ]+ \(\+https://www\.terraform\.io\) terraform-provider-[^/]+/.+$`)

// IsTerraformUserAgentID checks if a Terraform manager identity uses the
// DEPRECATED User-Agent based format (e.g., "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0").
// Modern approach uses stable custom IDs like "grafana-terraform-provider" or "my-terraform-provider".
//
// HACK: This is a workaround to allow migration from User-Agent based manager IDs to stable custom IDs.
// The Terraform provider historically used the HTTP User-Agent header as the manager identity, which:
//   - Changes with every Terraform/provider version update
//   - Was never intended to be a stable identifier
//   - Cannot be customized by users
//
// This function enables one-way migration to user-defined stable IDs by detecting the User-Agent
// format and blocking reversion back to it. This special-casing for Terraform violates the general
// principle that manager identities should be immutable, but is necessary to fix the original
// design mistake of using User-Agent as an identifier.
//
// Format: "Terraform/{version} (+https://www.terraform.io) terraform-provider-{name}/{version}"
func IsTerraformUserAgentID(identity string) bool {
	return terraformUserAgentPattern.MatchString(identity)
}

// CheckManagerPropertiesOnUpdate reports whether the manager annotations may change
// from old to proposed. A manager is replaced by removing it and adding the new one,
// not by rewriting it in place, so a kind change is always refused and an identity
// change is refused for every kind that has a stable identity.
//
// These are the storage-independent rules, shared by unified storage and by the
// legacy SQL stores that keep the same annotations in a column. Whether the caller
// is allowed to manage the resource at all, and whether it may remove a manager, are
// authorization questions this does not answer: removing one is reported as allowed
// here and left to the caller to gate.
func CheckManagerPropertiesOnUpdate(old, proposed ManagerProperties, hasOld, hasProposed bool) error {
	if !hasOld || !hasProposed {
		return nil
	}

	if proposed.Kind != old.Kind {
		return NewForbiddenManagerKindChangeError(old, proposed)
	}

	// Classic shim kinds are exempt: their identity is absent or unstable (e.g. a
	// file-provisioning reader name, or empty for API/converted-Prometheus origins),
	// so it is not a user-defined stable ID and must not be treated as immutable.
	if proposed.Identity == old.Identity || proposed.Kind.IsClassic() {
		return nil
	}

	// HACK: Terraform managers get special treatment for identity changes.
	// See IsTerraformUserAgentID() for full explanation of why this exists.
	//
	// We allow one-way migration from deprecated User-Agent based IDs to stable custom IDs.
	// Once migrated to a custom ID, that identity is locked (cannot be changed).
	// User-Agent IDs can still be updated to other User-Agent IDs (for version updates).
	if proposed.Kind == ManagerKindTerraform {
		if IsTerraformUserAgentID(old.Identity) {
			return nil
		}
		if IsTerraformUserAgentID(proposed.Identity) {
			return newForbiddenManagerIdentityChangeError(
				"Cannot change Terraform manager ID back to User-Agent format; stable custom IDs are immutable")
		}
		return newForbiddenManagerIdentityChangeError(
			"Cannot change Terraform manager ID; stable custom IDs are immutable")
	}

	return newForbiddenManagerIdentityChangeError(
		"Cannot change resource manager identity; remove the existing manager first, then add the new one")
}

func newForbiddenManagerIdentityChangeError(message string) *apierrors.StatusError {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusForbidden,
		Reason:  metav1.StatusReasonForbidden,
		Message: message,
		Details: &metav1.StatusDetails{
			Causes: []metav1.StatusCause{{
				Type:  "ResourceManagerIdentityConflict",
				Field: "metadata.annotations[" + AnnoKeyManagerIdentity + "]",
			}},
		},
	}}
}

func NewForbiddenManagerKindChangeError(current, requested ManagerProperties) *apierrors.StatusError {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status: metav1.StatusFailure,
		Code:   http.StatusForbidden,
		Reason: metav1.StatusReasonForbidden,
		Message: fmt.Sprintf("Cannot change resource manager kind from %q (identity %q) to %q (identity %q); remove the existing manager first, then add the new one",
			current.Kind, current.Identity, requested.Kind, requested.Identity),
		Details: &metav1.StatusDetails{
			Causes: []metav1.StatusCause{{
				Type:  "ResourceManagerKindConflict",
				Field: "metadata.annotations[" + AnnoKeyManagerKind + "]",
			}},
		},
	}}
}

func IsForbiddenManagerKindChangeError(err error) bool {
	var statusErr apierrors.APIStatus
	if !errors.As(err, &statusErr) {
		return false
	}
	status := statusErr.Status()
	if status.Code != http.StatusForbidden || status.Reason != metav1.StatusReasonForbidden {
		return false
	}
	if status.Details != nil {
		for _, cause := range status.Details.Causes {
			if cause.Type == "ResourceManagerKindConflict" {
				return true
			}
		}
	}
	// Older API instances do not include a structured cause during rolling upgrades.
	return status.Message == "Cannot change resource manager kind; remove the existing manager first, then add the new one"
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
