package v0alpha1

const (
	// FolderAnnotationKey is the annotation that designates the parent folder UID for a resource.
	// Keep in sync with apps/alerting/rules/pkg/apis/alerting/v0alpha1.FolderAnnotationKey.
	FolderAnnotationKey = "grafana.app/folder"

	// ChildNamePrefix is the prefix attached to every child resource created by the reconciler.
	// It is purely a naming convention — the authoritative list of children is the
	// PrometheusRuleFileStatus.Managed* slices, since AlertRule and RecordingRule live in
	// legacy storage that does not preserve arbitrary labels we could otherwise filter on.
	ChildNamePrefix = "prf-"
)

// GetParentFolderUID returns the parent folder UID annotation on the PrometheusRuleFile.
// Returns the empty string if not set.
func (o *PrometheusRuleFile) GetParentFolderUID() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	return o.Annotations[FolderAnnotationKey]
}
