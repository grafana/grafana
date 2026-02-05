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
│              MigrationRegistrar (per team)                   │
│    Each team implements RegisterMigrations() to register     │
│    their MigrationDefinitions independently.                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ RegisterMigrations(registry)
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

- **`registry.go`**: `MigrationRegistrar` interface, `MigrationDefinition`, and thread-safe `MigrationRegistry`
- **`registry_builder.go`**: Wire provider `ProvideMigrationRegistry` and `BuildMigrationRegistry` convenience
- **`pkg/registry/apis/dashboard/migration_registrar.go`**: `DashboardFolderRegistrar` — registers folders and dashboards (owned by the dashboard team)
- **`pkg/registry/apps/playlist/migration_registrar.go`**: `PlaylistRegistrar` — registers playlists (owned by the playlist team)
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

Follow these steps to add a new resource migration. Each team owns their registrar
and migrator code, keeping migration logic decentralized.

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

#### 3. Create a registrar

Create a new file (e.g. `registrar_myresource.go`) in the `migrations` package:

```go
package migrations

import (
    myresource "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
    "k8s.io/apimachinery/pkg/runtime/schema"
)

type MyResourceRegistrar struct {
    migrator MyResourceMigrator
}

func NewMyResourceRegistrar(migrator MyResourceMigrator) *MyResourceRegistrar {
    return &MyResourceRegistrar{migrator: migrator}
}

func (r *MyResourceRegistrar) RegisterMigrations(registry *MigrationRegistry) {
    gr := schema.GroupResource{
        Group:    myresource.GROUP,
        Resource: myresource.RESOURCE,
    }

    registry.Register(MigrationDefinition{
        ID:          "myresources",
        MigrationID: "myresources migration",
        Resources: []ResourceInfo{
            {GroupResource: gr, LockTable: "my_resource_table"},
        },
        Migrators: map[schema.GroupResource]MigratorFunc{
            gr: r.migrator.MigrateMyResources,
        },
        Validators: []ValidatorFactory{
            CountValidation(gr, "my_resource_table", "org_id = ?"),
        },
    })
}
```

#### 4. Wire the registrar

Add your registrar to the Wire dependency chain:

**a.** Add a provider for your migrator interface (in your legacy package or provider file):

```go
func ProvideMyResourceMigrator(...) MyResourceMigrator {
    return &myResourceAccess{...}
}
```

**b.** Add the provider and registrar constructor to `wire.go`:

```go
myresource.ProvideMyResourceMigrator,
unifiedmigrations.NewMyResourceRegistrar,
```

**c.** Add the registrar to `ProvideRegistrars` in `registry_builder.go`:

```go
func ProvideRegistrars(
    dashFolders *DashboardFolderRegistrar,
    playlists   *PlaylistRegistrar,
    myResource  *MyResourceRegistrar,   // <-- add here
) []MigrationRegistrar {
    return []MigrationRegistrar{dashFolders, playlists, myResource}
}
```

**d.** Regenerate wire: run `make wire` from the repository root.

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
- [ ] Registrar created in `migrations/` package
- [ ] Wire provider added and `ProvideRegistrars` updated
- [ ] `wire_gen.go` regenerated (`make wire`)
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

Add your validator factory to the `Validators` slice in your registrar's
`MigrationDefinition`.
