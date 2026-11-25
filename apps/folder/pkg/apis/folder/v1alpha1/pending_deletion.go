package v1alpha1

// PendingDeletionName combines the exact API name with the Kubernetes incarnation UID,
// not the display title or the legacy Grafana UID alone.
func PendingDeletionName(folderName, folderUID string) string {
	return folderName + "-" + folderUID
}
