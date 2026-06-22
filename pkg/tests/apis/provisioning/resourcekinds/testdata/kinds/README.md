# Resource-kind descriptors

Each `*.json` file in this directory adds one resource type to the generic provisioning
harness (`pkg/tests/apis/provisioning/resourcekinds`). Dropping a descriptor here is all that is
needed to run the full battery — export, selective export, sync/pull, files CRUD, and bulk
delete/move jobs — against a new kind. No Go changes are required.

## Format

```json
{
  "folderScoped": false,
  "featureFlags": ["playlistsRBAC"],
  "manifest": {
    "apiVersion": "playlist.grafana.app/v1",
    "kind": "Playlist",
    "metadata": { "name": "placeholder" },
    "spec": { "title": "placeholder" }
  }
}
```

- **`manifest`** — a sample resource manifest. The harness patches `metadata.name` and
  `spec.title` per test instance; other fields are sent as-is. The plural resource is resolved
  from `apiVersion` + `kind` via API discovery, so it is not declared here.
- **`folderScoped`** — `true` if provisioning stamps a `grafana.app/folder` annotation on the
  resource (the kind is declared with the `:folder` capability). Folder-scoped kinds are synced
  inside a subdirectory so the folder annotation is exercised.
- **`featureFlags`** — extra feature toggles the kind's apiserver/authorizer needs (raw toggle
  names). Often empty; playlists need `playlistsRBAC`.

The file name (without `.json`) is the kind's label, used in subtest names and repository names.

## Preconditions

For the battery to pass, the kind must actually round-trip: its API must be served by the test
server, the provisioning identity must be authorized for it, and its write path must not reject
repository-managed folders. Kinds that ship `:disabled` are enabled automatically here via their
generated `[provisioning] resources` token.
