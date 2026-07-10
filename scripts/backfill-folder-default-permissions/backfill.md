# Backfill algo

The TSV file contains the following columns:

- `stack_id`
- `cluster`

## Goal

Build a script that processes each stack from the TSV, discovers its provisioning repositories through the Provisioning Grafana app, identifies the root folders managed by those repositories, and ensures the expected resource permissions exist for each root folder.

## Repository discovery

For each stack, the script should:

1. Read `stack_id` and `cluster` from the TSV.
2. Select the correct Kubernetes context for the target cluster.
3. Retrieve the Cloud Access Policy token for the Provisioning Connection Operator.
4. Establish a port-forward to the Auth API.
5. Exchange the Cloud Access Policy token for an access token.
6. Establish a port-forward to the Provisioning Grafana app.
7. Query the repositories endpoint for the stack namespace:

```http
GET /apis/provisioning.grafana.app/v0alpha1/namespaces/{namespace}/repositories
```

Where the namespace is derived from the stack ID, for example:

```text
stacks-{stack_id}
```

The response from this endpoint is the source of truth for the repositories that need to be inspected.

## Root folder discovery

For each repository, the script should fetch the repository definition and read:

```text
spec.sync.target
```

The root-folder discovery logic depends on this value.

### Folder mode

If:

```text
spec.sync.target == "folder"
```

Then the repository itself represents the single root folder.

In this mode, the folder UID is the repository name:

```text
folder_uid = repoName
```

The root folder should be treated as:

```json
{
  "path": "",
  "group": "folder.grafana.app",
  "resource": "folders",
  "name": "{repoName}",
  "hash": "",
  "title": "Git Sync"
}
```

### Folderless mode

If:

```text
spec.sync.target == "folderless"
```

Then the repository acts as a virtual parent, and the script should query:

```http
GET /apis/provisioning.grafana.app/v0alpha1/namespaces/{namespace}/repositories/{repoName}/resources
```

Then filter the returned items to keep only root-level folder resources:

- `resource == "folders"`
- `path` does not contain `/`
- `folder == "{repoName}"`

These are the top-level folders managed by the repository.

For each matching item, the folder UID is the item’s `name` field:

```text
folder_uid = item.name
```

The `folder` field is not the folder UID in this mode. It points back to the repository name as the virtual parent.

### Other sync targets

If the repository uses another sync target, such as `instance`, the script should skip it unless that mode is explicitly supported.

## Permission workflow

After discovering the root folders, the script should:

1. Retrieve the Cloud Access Policy token for the Folder app that can be exchanged for access to the multi-tenant IAM app.
2. Establish a port-forward to the Auth API if needed for the token exchange.
3. Exchange the token for an access token.
4. Establish a port-forward to the multi-tenant IAM app.
5. For each discovered root folder:
   - check whether the expected resource permission already exists
   - skip it if it exists
   - create it if it is missing

Missing permissions should be created with:

- `editor` can edit
- `viewer` can view

## End-to-end workflow

For each row in the TSV:

1. Read `stack_id` and `cluster`.
2. Select the Kubernetes context for the target cluster.
3. Retrieve and exchange the Provisioning Connection Operator Cloud Access Policy token.
4. Port-forward to the Provisioning Grafana app.
5. List provisioning repositories for the stack.
6. For each repository:
   - fetch the repository definition
   - read `spec.sync.target`
   - determine root folders using the appropriate sync-mode logic
   - resolve the correct `folder_uid` for each root folder

7. Retrieve and exchange the Cloud Access Policy token required for the multi-tenant IAM app.
8. Port-forward to the multi-tenant IAM app.
9. For each discovered root folder:
   - check whether the expected resource permission exists for `folder_uid`
   - leave existing permissions unchanged
   - create missing permissions with the default `editor` and `viewer` rules

## Outcome

At the end of the run, every root folder discovered from the stack’s provisioning repositories should have the expected resource permissions.

The script should be safe to run repeatedly: existing permissions should be detected and preserved, while only missing permissions are created.
