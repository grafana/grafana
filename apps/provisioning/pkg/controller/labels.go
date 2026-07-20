package controller

const (
	// LabelPendingDelete mirrors the label written by the tenant watcher
	// (pkg/storage/unified/resource/tenant_watcher.go) to signal that a
	// namespace/stack is being soft-deleted by the cloud platform.
	LabelPendingDelete = "cloud.grafana.com/pending-delete"
)

// IsPendingDelete reports whether an object's namespace is undergoing a
// soft-delete, as indicated by the pending-delete label.
func IsPendingDelete(labels map[string]string) bool {
	return labels[LabelPendingDelete] == "true"
}
