Search service has:

* `searchIndex` - manages all organization indexes
* `orgIndex` - organization index, every organization has its own `orgIndex`
* every `orgIndex` has different index types (separate `*bluge.Writer`)

Index backup is global as we don't have org id separation in `entity_event` table. And manage indexes for all organizations in one goroutine.

On Grafana start we check whether search index backup exists.

* if yes - load all in-memory `orgIndex` from backup, load last event ID applied to the index in backup, apply missing updates
* if not - build orgIndex from scratch, at the end of building create backup.

Backup directory is configurable, inside backup directory structure looks like this:

```
gf_index
├── event_id.txt
├── org_1
│   └── dashboard
│       ├── 0000000004a7.seg
│       ├── 0000000004a8.seg
│       ├── 0000000004a9.seg
│       └── 000000000893.snp
└── org_2
```

`event_id.txt` contains the last event ID applied to the index version in the backup. Since we make backups periodically we may need to apply some missing updates from `entity_event` table to catch up the state. 

At this moment we still need to re-index periodically since not all changes come to `entity_event` table. Though we may try to apply some checks to avoid full-reindexing if we know that database state match state in index (i.e. no updates were missed).

We can also save/load backup to remote storage, but need to preserve the structure.
