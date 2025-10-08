# Dashboard migrations

This document describes the Grafana dashboard migration system, including metrics, logging, and testing infrastructure for dashboard schema migrations and API version conversions.

## Overview

## Metrics

The dashboard migration system now provides comprehensive observability through:
- **Prometheus metrics** for tracking conversion success/failure rates and performance
- **Structured logging** for debugging and monitoring conversion operations
- **Automatic instrumentation** via wrapper functions that eliminate code duplication
- **Error classification** to distinguish between different types of migration failures

### 1. Dashboard conversion success metric

**Metric Name:** `grafana_dashboard_migration_conversion_success_total`

**Type:** Counter

**Description:** Total number of successful dashboard conversions

**Labels:**
- `source_version_api` - Source API version (e.g., "dashboard.grafana.app/v0alpha1")
- `target_version_api` - Target API version (e.g., "dashboard.grafana.app/v1beta1")
- `source_schema_version` - Source schema version (e.g., "16") - only for v0/v1 dashboards
- `target_schema_version` - Target schema version (e.g., "41") - only for v0/v1 dashboards

**Example:**
```prometheus
grafana_dashboard_migration_conversion_success_total{
  source_version_api="dashboard.grafana.app/v0alpha1",
  target_version_api="dashboard.grafana.app/v1beta1",
  source_schema_version="16",
  target_schema_version="41"
} 1250
```

### 2. Dashboard conversion failure metric

**Metric Name:** `grafana_dashboard_migration_conversion_failure_total`

**Type:** Counter

**Description:** Total number of failed dashboard conversions

**Labels:**
- `source_version_api` - Source API version
- `target_version_api` - Target API version  
- `source_schema_version` - Source schema version (only for v0/v1 dashboards)
- `target_schema_version` - Target schema version (only for v0/v1 dashboards)
- `error_type` - Classification of the error (see Error Types section)

**Example:**
```prometheus
grafana_dashboard_migration_conversion_failure_total{
  source_version_api="dashboard.grafana.app/v0alpha1",
  target_version_api="dashboard.grafana.app/v1beta1",
  source_schema_version="14",
  target_schema_version="41",
  error_type="schema_version_migration_error"
} 42
```

## Error types

The `error_type` label classifies failures into three categories:

### 1. `conversion_error`
- General conversion failures not related to schema migration
- API-level conversion issues
- Programming errors in conversion functions

### 2. `schema_version_migration_error`
- Failures during individual schema version migrations (v14→v15, v15→v16, etc.)
- Schema-specific transformation errors
- Data format incompatibilities

### 3. `schema_minimum_version_error`
- Dashboards with schema versions below the minimum supported version (< v13)
- These are logged as warnings rather than errors
- Indicates dashboards that cannot be migrated automatically

## Logging

### Log structure

All migration logs use structured logging with consistent field names:

**Base Fields (always present):**
- `sourceVersionAPI` - Source API version
- `targetVersionAPI` - Target API version
- `dashboardUID` - Unique identifier of the dashboard being converted

**Schema Version Fields (v0/v1 dashboards only):**
- `sourceSchemaVersion` - Source schema version number
- `targetSchemaVersion` - Target schema version number
- `erroredSchemaVersionFunc` - Name of the schema migration function that failed (on error)

**Error Fields (failures only):**
- `errorType` - Same classification as metrics error_type label
- `erroredConversionFunc` - Name of the conversion function that failed
- `error` - The actual error message

### Log levels

#### Success (DEBUG level)
```json
{
  "level": "debug",
  "msg": "Dashboard conversion succeeded",
  "sourceVersionAPI": "dashboard.grafana.app/v0alpha1",
  "targetVersionAPI": "dashboard.grafana.app/v1beta1",
  "dashboardUID": "abc123",
  "sourceSchemaVersion": 16,
  "targetSchemaVersion": 41
}
```

#### Conversion/Migration Error (ERROR level)
```json
{
  "level": "error", 
  "msg": "Dashboard conversion failed",
  "sourceVersionAPI": "dashboard.grafana.app/v0alpha1",
  "targetVersionAPI": "dashboard.grafana.app/v1beta1",
  "erroredConversionFunc": "Convert_V0_to_V1",
  "dashboardUID": "abc123",
  "sourceSchemaVersion": 16,
  "targetSchemaVersion": 41,
  "erroredSchemaVersionFunc": "V24",
  "errorType": "schema_version_migration_error",
  "error": "migration failed: table panel plugin not found"
}
```

#### Minimum Version Error (WARN level)
```json
{
  "level": "warn",
  "msg": "Dashboard conversion failed", 
  "sourceVersionAPI": "dashboard.grafana.app/v0alpha1",
  "targetVersionAPI": "dashboard.grafana.app/v1beta1",
  "erroredConversionFunc": "Convert_V0_to_V1",
  "dashboardUID": "def456",
  "sourceSchemaVersion": 10,
  "targetSchemaVersion": 41,
  "erroredSchemaVersionFunc": "",
  "errorType": "schema_minimum_version_error",
  "error": "dashboard schema version 10 cannot be migrated"
}
```

## Implementation details

### Automatic instrumentation

All dashboard conversions are automatically instrumented via the `withConversionMetrics` wrapper function:

```go
// All conversion functions are wrapped automatically
s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil),
    withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
        return Convert_V0_to_V1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
    }))
```

### Error handling

Custom error types provide structured error information:

```go
// Schema migration errors
type MigrationError struct {
    msg            string
    targetVersion  int
    currentVersion int
    functionName   string
}

// API conversion errors  
type ConversionError struct {
    msg               string
    functionName      string
    currentAPIVersion string
    targetAPIVersion  string
}
```

## Registration

### Metrics registration

Metrics must be registered with Prometheus during service initialization:

```go
import "github.com/grafana/grafana/apps/dashboard/pkg/migration"

// Register metrics with Prometheus
migration.RegisterMetrics(prometheusRegistry)
```

### Available metrics

The following metrics are available after registration:

```go
// Success counter
migration.MDashboardConversionSuccessTotal

// Failure counter  
migration.MDashboardConversionFailureTotal
```

## Conversion matrix

The system supports conversions between all dashboard API versions:

| From ↓ / To → | v0alpha1 | v1beta1 | v2alpha1 | v2beta1 |
|---------------|----------|---------|----------|---------|
| **v0alpha1**  | ✓        | ✓       | ✓        | ✓       |
| **v1beta1**   | ✓        | ✓       | ✓        | ✓       |
| **v2alpha1**  | ✓        | ✓       | ✓        | ✓       |
| **v2beta1**   | ✓        | ✓       | ✓        | ✓       |

Each conversion path is automatically instrumented with metrics and logging.

## API versions

The supported dashboard API versions are:

- `dashboard.grafana.app/v0alpha1` - Legacy JSON dashboard format
- `dashboard.grafana.app/v1beta1` - Migrated JSON dashboard format  
- `dashboard.grafana.app/v2alpha1` - New structured dashboard format
- `dashboard.grafana.app/v2beta1` - Enhanced structured dashboard format

## Schema versions

Schema versions (v13-v41) apply only to v0alpha1 and v1beta1 dashboards:

- **Minimum supported version**: v13
- **Latest version**: v41  
- **Migration path**: Sequential (v13→v14→v15...→v41)

## Migration testing

The implementation includes comprehensive test coverage:

- **Backend tests**: Go migration tests with metrics validation
- **Frontend tests**: TypeScript conversion tests  
- **Integration tests**: End-to-end conversion validation
- **Metrics tests**: Prometheus counter validation

### Backend migration tests

The backend migration tests validate schema version migrations and API conversions:

- **Schema migration tests**: Test individual schema version upgrades (v14→v15, v15→v16, etc.)
- **Conversion tests**: Test API version conversions with automatic metrics instrumentation
- **Test data**: Uses curated test files from `testdata/input/` covering schema versions 14-41
- **Metrics validation**: Tests verify that conversion metrics are properly recorded

**Test execution:**
```bash
# All backend migration tests
go test ./apps/dashboard/pkg/migration/... -v

# Schema migration tests only
go test ./apps/dashboard/pkg/migration/ -v

# API conversion tests with metrics
go test ./apps/dashboard/pkg/migration/conversion/... -v
```

### Frontend migration comparison tests

The frontend migration comparison tests validate that backend and frontend migration logic produce consistent results:

- **Test methodology**: Compares backend vs frontend migration outputs through DashboardModel integration
- **Dataset coverage**: Tests run against 42 curated test files spanning schema versions 14-41
- **Test location**: `public/app/features/dashboard/state/DashboardMigratorToBackend.test.ts`
- **Test data**: Located in `apps/dashboard/pkg/migration/testdata/input/` and `testdata/output/`

**Test execution:**
```bash
# Frontend migration comparison tests
yarn test DashboardMigratorToBackend.test.ts
```

**Test approach:**
- **Frontend path**: `jsonInput → DashboardModel → DashboardMigrator → getSaveModelClone()`
- **Backend path**: `jsonInput → Backend Migration → backendOutput → DashboardModel → getSaveModelClone()`
- **Comparison**: Direct comparison of final migrated states from both paths

## Related documentation

- [PR #110178 - Dashboard migration: Add missing metrics registration](https://github.com/grafana/grafana/pull/110178)
