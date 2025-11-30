# Unified Storage Data Migrations

Automated migration system for moving legacy resources from traditional SQL storage to Grafana's unified storage backend.

## Overview

The migration system migrates Grafana resources (folders, dashboards) from legacy SQL tables to unified storage while maintaining data integrity through built-in validators.

### Migration Path

```
Legacy SQL Storage → Validation → Unified Storage (Kubernetes-based)
     (dashboard table)              (resource + resource_history tables)
```

### Supported Resources

- **Folders**: Including nested folder hierarchies with parent-child relationships
- **Dashboards**: With folder associations preserved

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ResourceMigration                         │
│  (Orchestrates migration for specific resource types)        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├──> UnifiedMigrator
                   │    (Reads from legacy, writes to unified storage)
                   │
                   └──> Validators (run after migration)
                        ├─> CountValidator
                        │   (Verifies resource counts match)
                        └─> FolderTreeValidator
                            (Validates folder hierarchy)
```

### Key Files

- **`migrator.go`**: Core migration logic, handles reading from legacy SQL and writing to unified storage
- **`validator.go`**: Validation implementations (CountValidator, FolderTreeValidator)
- **`resource_migration.go`**: Migration execution framework
- **`service.go`**: Migration registration and startup integration

## How Migrations Work

### Automatic Execution

Migrations run automatically during Grafana startup when:

1. `disable_data_migrations = false` in configuration
2. Migration hasn't been completed previously (checked via `unifiedstorage_migration_log` table)
3. Database is accessible and unified storage is enabled

### Migration Flow

```
1. Grafana Startup
   ↓
2. Check unifiedstorage_migration_log table
   ↓
3. If not completed:
   ├─> Read legacy resources from SQL
   ├─> Transform to unified storage format
   ├─> Write to unified storage via BulkProcess API
   └─> Run validators
       ├─> CountValidator: Compare counts
       ├─> FolderTreeValidator: Verify hierarchy
       └─> Record success/failure in unifiedstorage_migration_log
   ↓
4. Continue Grafana startup
```

### Per-Organization Migration

Migrations run independently for each organization:
- Namespace format: `org-<orgId>` (e.g., `org-1`, `org-42`)
- Isolated validation per org
- Parallel execution possible

## Validators

### CountValidator

**Purpose**: Ensures all resources were migrated successfully by comparing counts.

**How it works**:
1. Counts resources in legacy SQL table (e.g., `SELECT COUNT(*) FROM dashboard WHERE org_id = ? AND is_folder = false`)
2. Counts resources in unified storage via Search API
3. Fails if counts don't match

**Example Configuration**:
```go
folderCountValidator := NewCountValidator(
    client,
    schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"},
    "dashboard",
    "org_id = ? and is_folder = true",
)
```

### FolderTreeValidator

**Purpose**: Validates that folder parent-child relationships are preserved correctly.

**How it works**:
1. Builds legacy folder hierarchy map from SQL:
   - Queries `dashboard` table for folders
   - Resolves `folder_uid` (string) to parent UID via uid→uid mapping
2. Builds unified storage hierarchy map via Search API:
   - Queries unified storage for folders
   - Extracts parent UID from `folder` column
3. Compares both maps and reports mismatches

**Example Validation**:
```
Legacy:   folder-child-1 → parent: folder-parent-1
Unified:  folder-child-1 → parent: folder-parent-1 ✓

Legacy:   folder-child-2 → parent: folder-parent-1
Unified:  folder-child-2 → parent: folder-parent-2 ✗
         → FAIL: Parent mismatch detected
```

## Configuration

### Required Settings

Enable unified storage and migrations:

```ini
[unified_storage]
disable_data_migrations = false  # CRITICAL: Enables migrations

[grafana-apiserver]
storage_type = unified
```

### Database-Specific Configuration

#### PostgreSQL
```ini
[database]
type = postgres
host = localhost:5432
name = grafanatest
user = grafanatest
password = grafanatest
```

#### MySQL
```ini
[database]
type = mysql
host = localhost:3306
name = grafanatest
user = grafanatest
password = grafanatest
```

#### SQLite
```ini
[database]
type = sqlite3
path = /var/lib/grafana/grafana.db
```

## Monitoring Migrations

### Log Messages

Successful migration logs:

```
info: storage.unified.RegisterMigrations Registering unified storage migrations
info: storage.unified.resource_migration.folders-dashboards Running validators count=3
info: storage.unified.resource_migration.folders-dashboards Validator CountValidator passed
info: storage.unified.resource_migration.folders-dashboards Validator FolderTreeValidator passed
info: storage.unified.resource_migration.folders-dashboards All validators passed
info: Unified storage migrations completed successfully
```

Failed migration logs:

```
error: validator CountValidator failed: count mismatch: legacy=100, unified=98
error: validator FolderTreeValidator failed: folder tree structure mismatch: 3 folders have incorrect parents
error: unified storage data migration failed: migration validation failed
```

### Migration Table

Check migration status in database:

```sql
-- PostgreSQL/MySQL
SELECT id, migration_id, success, error, timestamp 
FROM unifiedstorage_migration_log 
ORDER BY timestamp DESC;

-- SQLite
SELECT id, migration_id, success, error, timestamp 
FROM unifiedstorage_migration_log 
ORDER BY timestamp DESC;
```

### API Verification

Verify migrated resources via API:

```bash
# List folders
curl -u admin:admin http://localhost:3000/api/folders

# Search dashboards
curl -u admin:admin http://localhost:3000/api/search?type=dash-db

# Check specific folder
curl -u admin:admin http://localhost:3000/api/folders/{uid}
```

## Troubleshooting

### Migration Not Running

**Symptoms**:
- No migration logs during startup
- `unifiedstorage_migration_log` table has no unified storage entries

**Checks**:
1. Verify `disable_data_migrations = false` in config
2. Ensure `unifiedStorage = true` feature toggle is enabled
3. Check database connectivity: `/api/health` should show `"database": "ok"`
4. Review startup logs for errors

### CountValidator Failures

**Symptom**: `count mismatch: legacy=X, unified=Y`

**Common Causes**:
- Resources failed validation during bulk processing
- Network issues during migration
- Resource schema validation errors
- Permissions issues

**Investigation**:
```bash
# Check for rejected resources
grep -i "rejected\|validation failed" /var/log/grafana/grafana.log

# Verify resource counts
psql -c "SELECT COUNT(*) FROM dashboard WHERE org_id = 1 AND is_folder = false"
```

### FolderTreeValidator Failures

**Symptom**: `folder tree structure mismatch: N folders have incorrect parents`

**Common Causes**:
- Circular folder references in legacy data
- Missing parent folders
- Race conditions during migration
- Data corruption in legacy storage

**Investigation**:
```bash
# Find parent mismatches in logs
grep "Folder parent mismatch" /var/log/grafana/grafana.log

# Check folder hierarchy in SQL
SELECT uid, title, folder_id, folder_uid 
FROM dashboard 
WHERE org_id = 1 AND is_folder = true 
ORDER BY folder_id;
```

### Retry Migration

If migration fails and needs to be retried:

1. **Delete migration record**:
```sql
DELETE FROM unifiedstorage_migration_log 
WHERE migration_id LIKE '%folders-dashboards%';
```

2. **Restart Grafana**:
```bash
systemctl restart grafana-server
```

### Common Issues

#### Issue: "database connection refused"
**Solution**: Verify database is running and accessible, check connection string

#### Issue: "permission denied on table resource"
**Solution**: Grant required permissions to Grafana database user

#### Issue: "namespace not found"
**Solution**: Ensure organization exists in database, use correct namespace format

#### Issue: "validator timeout"
**Solution**: Increase timeout settings for large datasets, consider batching

## Development

### Adding a New Validator

1. Implement the `Validator` interface:
```go
type MyValidator struct {
    client resourcepb.ResourceIndexClient
    // ... fields
}

func (v *MyValidator) Name() string {
    return "MyValidator"
}

func (v *MyValidator) Validate(
    ctx context.Context, 
    sess *xorm.Session, 
    response *resourcepb.BulkResponse, 
    log log.Logger,
) error {
    // Validation logic
}
```

2. Register in `service.go`:
```go
myValidator := NewMyValidator(client, options)
migration := NewResourceMigration(
    migrator,
    resources,
    "migration-id",
    []Validator{existingValidator, myValidator},
)
```

### Testing Validators

Create test scenarios in `validator_test.go`:
```go
func TestMyValidator(t *testing.T) {
    validator := NewMyValidator(mockClient, options)
    response := &resourcepb.BulkResponse{
        // Test data
    }
    err := validator.Validate(ctx, sess, response, logger)
    require.NoError(t, err)
}
```

## References

### Code Structure

```
pkg/storage/unified/migrations/
├── migrator.go              # Core migration logic
├── validator.go             # Validator implementations
├── resource_migration.go    # Migration execution framework
├── service.go              # Registration and startup
└── README.md               # This file
```

### External Resources

- [Grafana Unified Storage Design](https://github.com/grafana/grafana/blob/main/pkg/storage/unified/README.md)
- [Kubernetes API Conventions](https://kubernetes.io/docs/reference/using-api/api-concepts/)

## Support

For migration issues:

1. **Check logs first**: Look for validator errors and stack traces
2. **Verify configuration**: Ensure all required settings are present
3. **Test database connectivity**: Use health API and direct database queries
4. **Review validator output**: Specific error messages indicate the issue
5. **Consult testing guide**: Comprehensive troubleshooting in on-prem migrations README

For questions or bug reports, refer to migration code in `pkg/storage/unified/migrations/`.
