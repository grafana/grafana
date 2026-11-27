# Folder Controller

Watches `Folder` objects and, for each terminating folder carrying the `folder.grafana.app/controller-cascade-delete` finalizer, deletes its subfolders and dashboards and then releases the finalizer.

Folders get the finalizer when they are created, or when their delete starts, with the `folder.asyncCascadeDeleteThroughController` feature toggle on. A delete that starts with the toggle off removes it instead.

## Permissions

Two identities are involved, and each needs its own permissions.

### The user who deletes the folder

The controller deletes the contents as its own identity, so with the toggle on the folders API checks the requester's access to the contents on every delete, forced or not, before the folder is marked terminating. A folder that is already terminating, and a subfolder the controller deletes under one, are not checked again. A requester without any of these gets a `403`, and the folder is left untouched.

In addition to the permission to delete the folder itself, the requester needs:

- `alert.rules:delete` on the folder
- `dashboards:delete` on the folder
- `folders:write` on the folder's parent (General for a root folder)
- `variables:delete` on the folder, only when global variables are enabled

Only the folder being deleted is checked. Folder permissions are inherited and only add up, so they cover its subfolders.

### The controller

The controller authenticates with its own access token and needs access to the folders and the dashboards servers it is pointed at (`folders_server_url` and `dashboards_server_url` in the `[operator]` section): read and list folders, update folder status and remove the finalizer, delete folders, and read, list and delete dashboards.

The cascade integration test in `pkg/tests/apis/folder/cascade_controller_test.go` runs it with `folder.grafana.app/folders:*` and `dashboard.grafana.app/dashboards:*`.
