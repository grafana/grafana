package v1

// CascadeDeleteFinalizer is set on a Folder while the folder controller is
// cascading its deletion to contained resources. It is removed once the
// cascade completes, allowing the Folder itself to be garbage collected.
const CascadeDeleteFinalizer = "folder.grafana.app/cascade-delete"
