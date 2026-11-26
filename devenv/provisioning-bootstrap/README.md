# gdev provisioning bootstrap

Example `[provisioning] bootstrap_path` directory. Grafana registers a **local** repository named
`bootstrap` over it at startup and provisions what it declares. No Git, no remote — file
provisioning through the system that also backs Git Sync, so the resources land managed.

```bash
cd devenv && ./setup.sh provisioning-bootstrap
cd .. && make run
```

Then open **Administration → Provisioning**. The repository's own configuration is read-only
(it comes from the setting); the resources it provisions are editable, and writing through the UI
writes the files back here.

A bootstrap directory can also declare repositories and connections — an instance configuring its
own Git Sync from disk. This example stays on plain resources so it needs nothing external.

## Instance-wide effects

Setup asks before applying these, or takes `BOOTSTRAP_FORCE=1` non-interactively. Prefer a
scratch instance.

- **Library panel storage is rerouted.** `dualWriterMode = 5` reads unified storage whatever the
  migration state, so panels held only in `library_element` are not listed while this is in place,
  and panels created meanwhile are not listed once it is removed. Nothing is deleted either way.
- **`devenv/datasources.yaml` is linked**, not just `gdev-testdata`: Grafana deletes the
  datasources in its `deleteDatasources` list, overwrites same-named ones, and sets the instance
  default. `undev` unlinks the file but cannot undo those database changes.
- **The default org must be org 1.** `datasources.yaml` sets no `orgId` so `gdev-testdata` is
  always created in org 1, while the repository follows `auto_assign_org_id`. Setup refuses a
  mismatch when it can see one.

## What it declares

| Path                                                | Resource     | Why it is here                               |
| --------------------------------------------------- | ------------ | -------------------------------------------- |
| `playlist.json`                                     | Playlist     | Org-scoped, so it sits at the root           |
| `gdev-provisioning/_folder.json`                    | Folder       | Pins the directory's folder UID and title    |
| `gdev-provisioning/README.md`                       | —            | Rendered in the folder's README tab          |
| `gdev-provisioning/random-walk.json`                | Dashboard    | Folder-scoped, uses `gdev-testdata`          |
| `gdev-provisioning/notes/_folder.json`              | Folder       | Nested folder, same sync                     |
| `gdev-provisioning/notes/README.md`                 | —            | Rendered in that folder's README tab         |
| `gdev-provisioning/notes/slow-queries.json`         | Dashboard    | Below the nested folder                      |
| `gdev-provisioning/notes/library-panel-readme.json` | LibraryPanel | Folder-scoped, so it cannot live at the root |

The playlist selects by the `provisioning` tag, which both dashboards carry.

## Cleanup

Clearing `bootstrap_path` deletes the repository **and everything it provisioned**, and those
finalizers still need the storage settings. So `undev` runs twice: the first clears
`bootstrap_path` only, then restart, then the second unlinks `conf/custom.ini` — but only once
Grafana confirms the repository is gone, since the restart starts the deletion and finalizers
finish it asynchronously.

## When deletion stalls

```bash
curl -su admin:admin \
  localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/bootstrap \
  | jq '{deletionTimestamp: .metadata.deletionTimestamp, finalizers: .metadata.finalizers}'
```

The log names the resource it is stuck on, usually a managed folder holding resources the
repository does not manage. Move or delete those contents and the next reconcile finishes it.

Forcing it is a last resort, and only works on a repository already marked for deletion — on a
live one the mutator re-seeds the finalizers. It abandons the unfinished cleanup and does **not**
release what survives: those resources keep `grafana.app/managedBy`, `managerId` and
`sourcePath`, so they still point at a repository that is gone until you strip those annotations.

```bash
curl -su admin:admin -X PATCH \
  -H 'Content-Type: application/merge-patch+json' -d '{"metadata":{"finalizers":[]}}' \
  localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/bootstrap
```

`rm data/grafana.db` is for a disposable instance only: it discards every dashboard, data source,
user and org, and does nothing for Postgres, MySQL, or a non-default path.

## Notes

- A directory without `_folder.json` still becomes a folder; the file pins its UID and title.
- `bootstrap_path` is granted implicitly — no `[paths] permitted_provisioning_paths` entry needed.
- Library panels and playlists are `:disabled` in the default `[provisioning] resources` set.
