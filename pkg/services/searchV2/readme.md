Here is a proposal about a new package layout which:

* will make different types of indexes work separately, each consuming `entity_events`, so less contention
* will allow doing isolated backups
* will allow doing re-indexing with different periods for different types of indexes

Entities:

* `StandardSearchService` - wrapper for all known indexes. For now only has reference to `dashboardSearch`.
* `dashboardSearch` - manages dashboard indexes for all organizations, every organization has its own `dashboardIndex`.
* every `dashboardIndex` has its own `*bluge.Writer`

```
type StandardSearchService struct {
  dashboardSearch *dashboardSearch
}

type dashboardSearch struct {
  indexes map[int64]*dashboardIndex
}

type dashboardIndex struct {
  writer *bluge.Writer
}

func (*dashboardSearch) run(ctx) error {
  // Create initial indexes for known orgs.
  // Start applying events, do full re-indexing, do backups etc.
}

func (*dashboardSearch) backup(ctx, currentEventID) error {
  // write meta.json
  // for each org do the backup using *bluge.Writer.
  // done.
}
```

Top level backup directory is configurable. Inside backup directory structure may look like this:

```
gf_index_backup
├── dashboard
|   ├-- meta.json
│   ├── org1
│   │   ├── 0000000004a7.seg
│   │   ├── 0000000004a8.seg
│   │   ├── 0000000004a9.seg
│   │   └── 000000000893.snp
│   └── org2
```

`meta.json` contains:

* the last event ID applied to the index version in the backup. Since we make backups periodically we may need to apply some missing updates from `entity_event` table to catch up the state.

As we don't have org id separation in `entity_event` table we manage indexes for all organizations in one goroutine. By different types of indexes are a separate consumers of `entity_event` table - so different types of indexes do not depend on each other at all.

We can have `IndexRunner`, `BackupManager`.

`IndexRunner` is responsible for lifecycle of index (actually this is our current `run` method), it excepts interface like:

```
type Index interface {
  Init(ctx, orgIDs) error // Index initially or load from existing backup.
  FullReIndex(ctx) error
  DoBackup(ctx, currentEventID) error
  HasOrgIndex(ctx, orgID) bool
  ReIndexForOrg(ctx, orgID) error
  ApplyUpdates(ctx, []EntityEvent) newEventID, error
}
```

BackupManager:

```
type BackupData struct {
  indexes map[int64]*bluge.Writer
  currentEventID int64
}

type BackupManager interface {
  DoBackup(BackupData) error
  LoadBackup() (BackupData, bool, error)
}
```

Notes:

* At this moment we still need to re-index periodically since not all changes come to `entity_event` table. Though we may try to apply some checks to avoid full-reindexing if we know that database state match state in index (i.e. no updates were missed).
* We can also save/load backup to remote storage, but need to preserve the structure.
* Also, in HA scenario we can theoretically only have one node that does re-indexing, then share backup to all nodes.
