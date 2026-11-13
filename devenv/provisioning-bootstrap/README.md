# gdev provisioning bootstrap

Example `[provisioning] bootstrap_path` directory. At startup Grafana registers a **local**
repository named `bootstrap` over it and provisions everything declared here. No Git, no remote:
this is file provisioning, served by the same provisioning system that also backs Git Sync, so
the resources land as managed resources with a repository behind them.

```bash
cd devenv && ./setup.sh provisioning-bootstrap   # symlinks devenv/provisioning-bootstrap.ini to conf/custom.ini
cd .. && make run
```

Then open **Administration → Provisioning**. The `bootstrap` repository is listed but its
configuration is read-only, because it comes from the `bootstrap_path` setting; the resources it
provisions are editable, and writing through the UI writes the files back here.

A bootstrap directory can also declare repositories and connections, which is the point of the
feature: an instance configures its own Git Sync from files on disk. This example stays on plain
resources, so it works with nothing external set up.

## What it declares

| Path                                                | Resource     | Why it is here                                    |
| --------------------------------------------------- | ------------ | ------------------------------------------------- |
| `playlist.json`                                     | Playlist     | Org-scoped, so it sits at the root                |
| `gdev-provisioning/_folder.json`                    | Folder       | Gives the directory a stable folder UID and title |
| `gdev-provisioning/random-walk.json`                | Dashboard    | Folder-scoped, uses `gdev-testdata`               |
| `gdev-provisioning/notes/_folder.json`              | Folder       | Nested folder, built by the same sync             |
| `gdev-provisioning/notes/slow-queries.json`         | Dashboard    | Dashboard below the nested folder                 |
| `gdev-provisioning/notes/library-panel-readme.json` | LibraryPanel | Folder-scoped, so it cannot live at the root      |

The playlist selects dashboards by the `provisioning` tag, which both dashboards carry.

## Notes

- A directory without a `_folder.json` still becomes a folder; the file is what pins its UID and
  title, so without it the UID is derived from the path.
- `bootstrap_path` is granted to the bootstrap repository implicitly — it does not need an entry
  in `[paths] permitted_provisioning_paths`.
- Clearing `bootstrap_path` deletes the repository **and everything it provisioned**. Run
  `./setup.sh undev` and restart to clean up.
- Library panels and playlists are `:disabled` in the default `[provisioning] resources` set;
  `devenv/provisioning-bootstrap.ini` enables them, and serves library panels from unified
  storage so their manager annotations survive a round trip.
