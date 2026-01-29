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
│                    MigrationRegistry                        │
│           (Global registry of MigrationDefinitions)         │
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

- **`service.go`**: Migration service entry point
- **`registry.go`**: `MigrationDefinition` and thread-safe `MigrationRegistry`
- **`resource_migration.go`**: `MigrationRunner` (logic) and `ResourceMigration` (SQL migration wrapper)
- **`resources.go`**: Migration registration and auto-migrate logic
- **`validator.go`**: `CountValidator` and `FolderTreeValidator` implementations
- **`migrator.go`**: `UnifiedMigrator` interface and BulkProcess streaming

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

### Adding a new validator

Create a `ValidatorFactory` function:

```go
func MyValidation(resource schema.GroupResource) ValidatorFactory {
    return func(client resourcepb.ResourceIndexClient, driverName string) Validator {
        return &MyValidator{resource: resource, client: client}
    }
}
```

### Adding a new resource type

1. Create a `MigrationDefinition` with ID, resources, migrators, and validators
2. Register it with `Registry.Register()` in `registry.go`
3. Implement the migrator function in `MigrationDashboardAccessor`

