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

- **`registry.go`**: `MigrationDefinition` and thread-safe `MigrationRegistry`
- **`pkg/registry/apis/dashboard/migration_registrar.go`**: `FoldersDashboardsMigration` — returns the folders and dashboards definition (owned by the dashboard team)
- **`pkg/registry/apps/playlist/migration_registrar.go`**: `PlaylistMigration` — returns the playlists definition (owned by the playlist team)
- **`resource_migration.go`**: `MigrationRunner` (logic) and `ResourceMigration` (SQL migration wrapper)
- **`resources.go`**: Migration registration and auto-migrate logic
- **`validator.go`**: `CountValidator` and `FolderTreeValidator` implementations
- **`migrator.go`**: `UnifiedMigrator` interface and BulkProcess streaming
- **`service.go`**: Migration service entry point

## How migrations work

### Migration flow

1. Grafana starts and checks migration status in `unifiedstorage_migration_log` table
2. `MigrationRunner` executes for each organization:
   - Reads resources from legacy SQL tables via `UnifiedMigrator`
   - Streams resources to unified storage via BulkProcess API
   - Runs validators to verify data integrity
3. Records migration result in `unifiedstorage_migration_log` table

### Per-organization execution

Migrations run independently for each organization using namespace format `org-{orgId}`.

## Validators

### CountValidator

Compares resource counts between legacy SQL and unified storage. Accounts for rejected items during validation.

### FolderTreeValidator

Verifies folder parent-child relationships are preserved after migration.

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
SELECT * FROM unifiedstorage_migration_log WHERE migration_id LIKE '%folders-dashboards%';
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
    opts legacy.MigrateOptions,
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

Define a small interface in the legacy or types package so that Wire can provide it:

```go
type MyResourceMigrator interface {
    MigrateMyResources(ctx context.Context, orgId int64, opts legacy.MigrateOptions,
        stream resourcepb.BulkStore_BulkProcessClient) error
}
```

#### 3. Create a migration definition function

Create a new file (e.g. `migration_registrar.go`) in your team's package:

```go
package myresource

import (
    myresource "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
    "github.com/grafana/grafana/pkg/storage/unified/migrations"
    "k8s.io/apimachinery/pkg/runtime/schema"
)

func MyResourceMigration(migrator MyResourceMigrator) migrations.MigrationDefinition {
    gr := schema.GroupResource{
        Group:    myresource.GROUP,
        Resource: myresource.RESOURCE,
    }

    return migrations.MigrationDefinition{
        ID:          "myresources",
        MigrationID: "myresources migration",
        Resources: []migrations.ResourceInfo{
            {GroupResource: gr, LockTable: "my_resource_table"},
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

**a.** Add a provider for your migrator interface (in your legacy package or provider file):

```go
func ProvideMyResourceMigrator(...) MyResourceMigrator {
    return &myResourceAccess{...}
}
```

**b.** Add the provider to `wire.go`:

```go
myresource.ProvideMyResourceMigrator,
```

**c.** Register the definition in `provideMigrationRegistry` in `pkg/server/wire.go`:

```go
func provideMigrationRegistry(
    accessor legacy.MigrationDashboardAccessor,
    playlistMigrator legacy.PlaylistMigrator,
    myResourceMigrator myresource.MyResourceMigrator, // <-- add parameter
) *unifiedmigrations.MigrationRegistry {
    r := unifiedmigrations.NewMigrationRegistry()
    r.Register(dashboardmigration.FoldersDashboardsMigration(accessor))
    r.Register(playlistmigration.PlaylistMigration(playlistMigrator))
    r.Register(myresource.MyResourceMigration(myResourceMigrator)) // <-- register
    return r
}
```

**d.** Regenerate wire: run `make gen-go` from the repository root.

#### 5. Configure the resource

Add your resource to the unified storage configuration in `conf/defaults.ini`
or your custom config:

```ini
[unified_storage.myresources.myresource.grafana.app]
dualWriterMode = 0
```

#### Checklist

- [ ] Migrator function implemented and tested
- [ ] Migrator interface defined
- [ ] Migration definition function created in your team's package
- [ ] `provideMigrationRegistry` updated in `pkg/server/wire.go`
- [ ] `wire_gen.go` regenerated (`make gen-go`)
- [ ] Validators added (at minimum, `CountValidation`)
- [ ] Configuration added to `conf/defaults.ini`
- [ ] Integration tested with `grafana-cli datamigrations to-unified-storage`

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
