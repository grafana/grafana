# Unified storage data migrations

Automated migration system for moving Grafana resources from legacy SQL storage to unified storage.

## Overview

The migration system transfers resources from legacy SQL tables to Grafana's unified storage backend. It runs automatically during Grafana startup and validates data integrity after each migration.

### Supported resources

| Resource | API Group | Legacy table |
|----------|-----------|--------------|
| Folders | `folder.grafana.app` | `dashboard` |
| Dashboards | `dashboard.grafana.app` | `dashboard` |
| Library panels | `dashboard.grafana.app` | `library_element` |
| Playlists | `playlist.grafana.app` | `playlist` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ResourceMigration                        │
│        (Orchestrates per-organization migration)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
  UnifiedMigrator      Validators         BulkProcess API
  (Stream legacy     (Validate after      (Write to unified
   resources)         migration)           storage)
```

### Components

- **`service.go`**: Migration service entry point and registration
- **`migrator.go`**: Core migration logic using streaming BulkProcess API
- **`resource_migration.go`**: Per-organization migration execution
- **`validator.go`**: Post-migration validation (CountValidator, FolderTreeValidator)
- **`resources.go`**: Registry of migratable resource types

## How migrations work

### Migration flow

1. Grafana starts and checks migration status in `unifiedstorage_migration_log` table
2. For each organization, the migrator:
   - Reads resources from legacy SQL tables
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
info: storage.unified.resource_migration Starting migration for all organizations
info: storage.unified.resource_migration Migration completed successfully for all organizations
```

Failed migration:

```
error: storage.unified.resource_migration Migration validation failed
```

### Migration status

Query the migration log table to check status:

```sql
SELECT * FROM unifiedstorage_migration_log WHERE migration_id LIKE '%folders-dashboards%';
```

The `migration_id` is defined in `service.go` during registration. Ideally, it should be the resource type(s) being migrated.

## Development

### Adding a new validator

Implement the `Validator` interface:

```go
type Validator interface {
    Name() string
    Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error
}
```

Register the validator in `service.go` when creating the `ResourceMigration`.

### Adding a new resource type

1. Add the resource definition to `registeredResources` in `resources.go`
2. Implement the migrator function in the `MigrationDashboardAccessor` interface
3. Register the migration in `service.go`

