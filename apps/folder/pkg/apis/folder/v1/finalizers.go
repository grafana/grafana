package v1

// CascadeDeleteFinalizer marks a folder for async, controller-driven cascade deletion of its
// subtree (direct child folders and dashboards for this PoC). It is stamped on new folders by
// admission (see pkg/registry/apis/folders' FolderAPIBuilder.Mutate) when the
// kubernetesFolderCascadeDeleteAsync feature flag is enabled, and processed by the cascade delete
// controller (pkg/registry/apis/folders/cascade_delete_controller.go).
//
// PoC limitation: there is no backfill migration, so only folders created while the flag is
// enabled carry this finalizer. Folders that predate it are unaffected and keep using the
// existing synchronous, in-request cascade delete (cascade_delete_storage.go).
const CascadeDeleteFinalizer = "cascade-delete"
