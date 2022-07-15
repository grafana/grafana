Here is a proposal about a new package layout which:

* will make different types of indexes work separately, each consuming `entity_events` individually in its own control goroutine, so less contention
* will allow doing re-indexing with different periods for different types of indexes
* will allow doing isolated backups, will simplify extending in custom way

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

Backup directory is configurable per index type. Inside backup directory structure may look like this:

```
dashboard
   ├-- meta.json
   ├── org1
   │   ├── 0000000004a7.seg
   │   ├── 0000000004a8.seg
   │   ├── 0000000004a9.seg
   │   └── 000000000893.snp
   └── org2
```

`meta.json` contains:

```
{
  "eventId": 12
}
```

* `eventId` - the last event ID applied to the index in the backup. Since we make backups periodically we may need to apply some missing updates from `entity_event` table to catch up the state.

As we don't have org id separation in `entity_event` table we manage indexes for all organizations in one goroutine. By different types of indexes are a separate consumers of `entity_event` table - so different types of indexes do not depend on each other at all.

`IndexManager` is responsible controlling index lifecycle (actually this is our current `run` method), it accepts interface like:

```
type Index interface {
  Init(ctx, orgIDs) error // Index initially or load from existing backup.
  FullReIndex(ctx) error
  HasOrgIndex(ctx, orgID) bool
  ReIndexForOrg(ctx, orgID) error
  ApplyUpdates(ctx, []EntityEvent) newEventID
  DoBackup(ctx, currentEventID) error
}
```

Index implementation may re-use `BackupManager`:

```
type BackupData struct {
  Indexes map[int64]*bluge.Writer
  EventID int64
}

type BackupManager interface {
  Save(BackupData) error
  Load() (BackupData, bool, error)
}
```

We can do backups after full-reindexing with the event id seen before re-indexing started.

Notes:

* At this moment we still need to re-index periodically since not all changes come to `entity_event` table.
* To reduce number of full re-indexes we can apply some checks – if we know that the database state matches the state in the index (i.e. no updates were missed) then we can skip re-index.
* We can also save/load backup to the remote storage, but need to preserve the structure.
* In HA scenario we can theoretically only have one node that does re-indexing, then share backup to all nodes - apply it and re-apply events from `entity_events`
* Re-indexing is still pretty resource greedy
