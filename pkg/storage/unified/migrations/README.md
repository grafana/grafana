# Unified storage data migrations

Automated migration system for moving Grafana resources from legacy SQL storage to unified storage.

## Overview

The migration system transfers resources from legacy SQL tables to Grafana's unified storage backend. It runs automatically during Grafana startup and validates data integrity after each migration.

### Supported resources

| Resource | API Group | Legacy table |
|----------|-----------|--------------|
| Folders | `folder.grafana.app` | `dashboard` |
| Dashboards | `dashboard.grafana.app` | `dashboard` |
| Playlists | `playlist.grafana.app` | `playlist` |
| Short URLs | `shorturl.grafana.app` | `short_url` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Migration provider functions (per team)            │
│    Each team defines a function returning a                  │
│    MigrationDefinition for their resources.                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ MigrationDefinition
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    MigrationRegistry                        │
│         Thread-safe registry of MigrationDefinitions         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    MigrationRunner                          │
│        (Executes per-organization migration logic)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
  UnifiedMigrator      Validators         BulkProcess API
  (Stream legacy     (Validate after      (Write to unified
   resources)         migration)           storage)
```

### Components

- **`registry.go`**: Core type definitions (`MigrationDefinition`, `MigrationRegistry`, `ResourceInfo`, `MigratorFunc`, `Validator`, `ValidatorFactory`)
- **`resource_migration.go`**: `MigrationRunner` (executes per-org logic) and `ResourceMigration` (SQL migration wrapper)
- **`resources.go`**: Migration registration and config validation
- **`migrator.go`**: `UnifiedMigrator` interface, BulkProcess streaming, and index rebuilding with retry
- **`validator.go`**: `CountValidator` and `FolderTreeValidator` implementations
- **`service.go`**: `UnifiedStorageMigrationServiceImpl` — Wire-provided entry point that runs migrations on startup

#### Migration registrars (owned by each team)

- **`pkg/registry/apis/dashboard/migration_registrar.go`**: `FoldersDashboardsMigration` — folders and dashboards definition
- **`pkg/registry/apps/playlist/migration_registrar.go`**: `PlaylistMigration` — playlists definition
- **`pkg/registry/apps/shorturl/migration_registrar.go`**: `ShortURLMigration` — short URLs definition

Each team also provides a migrator interface in a `migrator/` subpackage (e.g., `pkg/registry/apis/dashboard/migrator/`).

## How migrations work

### Migration flow

1. Grafana starts and `UnifiedStorageMigrationService.Run()` is called
2. The service validates that all expected resources are registered in the `MigrationRegistry`
3. For each `MigrationDefinition`, the system checks if `enableMigration = true` in the resource's config
4. `MigrationRunner` executes for each organization:
   - Reads resources from legacy SQL tables via team-owned `MigratorFunc` implementations
   - Streams resources to unified storage via BulkProcess API
   - Rebuilds search indexes (with exponential backoff retry)
   - Runs validators to verify data integrity
5. Records migration result in `unifiedstorage_migration_log` table

### Per-organization execution

Migrations run independently for each organization using namespace format `org-{orgId}`.

## Validators

### CountValidator

Compares resource counts between legacy SQL and unified storage. Accounts for rejected items during validation. Uses direct table queries for SQLite and the `GetStats` API for other databases.

### FolderTreeValidator

Verifies folder parent-child relationships are preserved after migration by comparing parent maps built from both legacy and unified storage.

## Configuration

To enable migrations, set the following in your Grafana configuration:

```ini
[unified_storage]
disable_data_migrations = false
```

## Monitoring

### Log messages

Successful migration:

```
info: storage.unified.migration_runner Starting migration for all organizations
info: storage.unified.migration_runner Migration completed successfully for all organizations
```

Failed migration:

```
error: storage.unified.migration_runner Migration validation failed
```

### Migration status

Query the migration log table to check status:

```sql
SELECT * FROM unifiedstorage_migration_log;
```

## Development

### Adding a new resource type

Follow these steps to add a new resource migration. Each team owns their
migration definition function, keeping migration logic decentralized.

#### 1. Implement the migrator function

Write a function matching the `MigratorFunc` signature that reads from your legacy
SQL table and streams resources to unified storage:

```go
func (a *myAccess) MigrateMyResources(
    ctx context.Context,
    orgId int64,
    opts MigrateOptions,
    stream resourcepb.BulkStore_BulkProcessClient,
) error {
    rows, err := a.listResources(ctx, orgId)
    if err != nil {
        return err
    }
    defer rows.Close()

    for rows.Next() {
        // Build the resource protobuf and send it to the stream
        err := stream.Send(&resourcepb.BulkRequest{
            // ... populate from legacy row
        })
        if err != nil {
            return err
        }
    }
    return nil
}
```

#### 2. Define a migrator interface

Define a small interface in a `migrator/` subpackage within your team's package:

```go
// pkg/registry/apps/myresource/migrator/migrator.go
package migrator

type MyResourceMigrator interface {
    MigrateMyResources(ctx context.Context, orgId int64, opts migrations.MigrateOptions,
        stream resourcepb.BulkStore_BulkProcessClient) error
}

func ProvideMyResourceMigrator(db legacydb.LegacyDatabaseProvider) MyResourceMigrator {
    return &myResourceMigrator{db: db}
}
```

#### 3. Create a migration definition function

Create a `migration_registrar.go` file in your team's package:

```go
package myresource

import (
    myresource "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
    "github.com/grafana/grafana/pkg/registry/apps/myresource/migrator"
    "github.com/grafana/grafana/pkg/storage/unified/migrations"
    "k8s.io/apimachinery/pkg/runtime/schema"
)

func MyResourceMigration(migrator migrator.MyResourceMigrator) migrations.MigrationDefinition {
    gr := schema.GroupResource{
        Group:    myresource.GROUP,
        Resource: myresource.RESOURCE,
    }

    return migrations.MigrationDefinition{
        ID:          "myresources",
        MigrationID: "myresources migration",
        Resources: []migrations.ResourceInfo{
            {GroupResource: gr, LockTables: []string{"my_resource_table"}},
        },
        Migrators: map[schema.GroupResource]migrations.MigratorFunc{
            gr: migrator.MigrateMyResources,
        },
        Validators: []migrations.ValidatorFactory{
            migrations.CountValidation(gr, "my_resource_table", "org_id = ?"),
        },
    }
}
```

#### 4. Wire the migration

Add your migration to the Wire dependency chain:

**a.** Add the migrator provider to `wire.go`:

```go
myresourcemigrator.ProvideMyResourceMigrator,
```

**b.** Register the definition in `provideMigrationRegistry` in `pkg/server/wire.go`:

```go
func provideMigrationRegistry(
    dashMigrator dashboardmigrator.FoldersDashboardsMigrator,
    playlistMigrator playlistmigrator.PlaylistMigrator,
    shortURLMigrator shorturlmigrator.ShortURLMigrator,
    myResourceMigrator myresourcemigrator.MyResourceMigrator, // <-- add parameter
) *unifiedmigrations.MigrationRegistry {
    r := unifiedmigrations.NewMigrationRegistry()
    r.Register(dashboardmigration.FoldersDashboardsMigration(dashMigrator))
    r.Register(playlistmigration.PlaylistMigration(playlistMigrator))
    r.Register(shorturlmigration.ShortURLMigration(shortURLMigrator))
    r.Register(myresource.MyResourceMigration(myResourceMigrator)) // <-- register
    return r
}
```

**c.** Regenerate wire: run `make gen-go` from the repository root.

#### 5. Configure the resource

Add your resource to the unified storage configuration in `conf/defaults.ini`
or your custom config:

```ini
[unified_storage.myresources.myresource.grafana.app]
dualWriterMode = 0
```

#### Checklist

- [ ] Migrator function implemented and tested
- [ ] Migrator interface defined in a `migrator/` subpackage
- [ ] Migration definition function created in your team's package (`migration_registrar.go`)
- [ ] Migrator provider added to `wire.go`
- [ ] `provideMigrationRegistry` updated in `pkg/server/wire.go`
- [ ] `wire_gen.go` regenerated (`make gen-go`)
- [ ] Validators added (at minimum, `CountValidation`)
- [ ] Configuration added to `conf/defaults.ini`
- [ ] Integration test case added to `testcases/` package

### Adding a new validator

Create a `ValidatorFactory` function:

```go
func MyValidation(resource schema.GroupResource) ValidatorFactory {
    return func(client resourcepb.ResourceIndexClient, driverName string) Validator {
        return &MyValidator{resource: resource, client: client}
    }
}
```

The validator must implement the `Validator` interface:

```go
type Validator interface {
    Name() string
    Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error
}
```

Add your validator factory to the `Validators` slice in your migration definition's
`MigrationDefinition`.

## Testing

### Pre-migration delete

Before migrating each resource type, the migration system performs a **full delete** of all existing data for that resource in unified storage. This ensures a clean state and prevents duplicate or stale data. The delete happens within the same transaction as the migration write, so if the migration fails, the delete is rolled back.

### Re-running a migration

After a successful migration, a row is recorded in the `unifiedstorage_migration_log` table. On subsequent startups, Grafana checks this table and **skips** any migration that already has an entry.

To re-run a migration (e.g., for testing), delete the corresponding row from the log table:

```sql
-- View existing migration entries
SELECT * FROM unifiedstorage_migration_log;

-- Delete a specific entry to allow re-running that migration
DELETE FROM unifiedstorage_migration_log WHERE migration_id = 'folders and dashboards migration';
DELETE FROM unifiedstorage_migration_log WHERE migration_id = 'playlists migration';
DELETE FROM unifiedstorage_migration_log WHERE migration_id = 'shorturls migration';
```

After removing the row, restart Grafana to trigger the migration again. Since the migration performs a full delete of the target resources before writing, re-running is safe and will not result in duplicate data.

### Test cases

The `testcases/` package provides reusable test cases for each resource migration. Each test case implements the `ResourceMigratorTestCase` interface:

```go
type ResourceMigratorTestCase interface {
    Name() string
    Resources() []schema.GroupVersionResource
    Setup(t *testing.T, helper *apis.K8sTestHelper)
    Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool)
}
```

Existing test cases:

| Test case | File | What it covers |
|-----------|------|----------------|
| `NewFoldersAndDashboardsTestCase` | `testcases/folders_dashboards.go` | Nested folders, dashboards with library panels |
| `NewPlaylistsTestCase` | `testcases/playlists.go` | Playlists with dashboard UID, tag, and mixed items |

Each resource owner is responsible for writing and maintaining a test case for their resource as part of the development process. When adding a new resource migration, create a corresponding test case in `testcases/` that sets up representative data via `Setup` and verifies it via `Verify`. Extend existing test cases to cover additional scenarios as needed (e.g., edge cases, specific field mappings, or error conditions).
