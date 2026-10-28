package v1

// CascadeDeleteFinalizer is stamped on folders when folder.asyncCascadeDeleteThroughController
// is enabled. The folder controller removes it only once every descendant has been deleted, so the
// folder stays visible (with progress in status.cascadeDelete) until the cascade completes.
const CascadeDeleteFinalizer = "folder.grafana.app/controller-cascade-delete"
