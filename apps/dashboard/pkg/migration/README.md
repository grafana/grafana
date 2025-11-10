# Dashboard migrations

This document describes the Grafana dashboard migration system, focusing on conversion-level practices including metrics, logging, and testing infrastructure for API version conversions. For schema version migration implementation details, see the [SchemaVersion Migration Guide](./schemaversion/README.md).

## Table of Contents

- [Overview](#overview)
  - [Conversion Flow](#conversion-flow-v0--v1--v2)
  - [v0 to v1 Conversion](#v0-to-v1-conversion)
  - [v1 to v2 Conversion](#v1-to-v2-conversion)
- [Conversion Matrix](#conversion-matrix)
- [API Versions](#api-versions)
- [Schema Versions](#schema-versions)
- [Testing](#testing)
  - [Backend conversion tests](#backend-conversion-tests)
  - [Frontend migration comparison tests](#frontend-migration-comparison-tests)
- [Monitoring Migrations](#monitoring-migrations)
  - [Metrics](#metrics)
    - [Dashboard conversion success metric](#1-dashboard-conversion-success-metric)
    - [Dashboard conversion failure metric](#2-dashboard-conversion-failure-metric)
  - [Error Types](#error-types)
  - [Logging](#logging)
    - [Log structure](#log-structure)
    - [Log levels](#log-levels)
  - [Implementation Details](#implementation-details)
    - [Automatic instrumentation](#automatic-instrumentation)
    - [Error handling](#error-handling)
  - [Registration](#registration)
    - [Metrics registration](#metrics-registration)
    - [Available metrics](#available-metrics)
- [Related Documentation](#related-documentation)

## Overview

The Grafana dashboard migration system operates across three main conversion layers:

### Conversion Flow: v0 → v1 → v2

```
v0alpha1 (Legacy JSON) → v1beta1 (Migrated JSON) → v2alpha1/v2beta1 (Structured)
```

#### v0 to v1 Conversion:
- All schema migrations (v0-v42) are executed in the backend
- Ports the logic from DashboardMigrator and implements built-in plugin migrations for panel plugins since backend cannot load plugins
- Transforms legacy JSON dashboards to migrated JSON format
- Handles backward compatibility for older dashboard formats
- See [SchemaVersion Migration Guide](./schemaversion/README.md) for detailed instructions on creating new schema migrations

#### v1 to v2 Conversion:
- API version conversions between different Kubernetes API versions
- Transforms JSON dashboards to structured dashboard format
- v2 schema is the stable, typed schema with proper type definitions
- Handles modern dashboard features and Kubernetes-native storage

## Conversion Matrix

The system supports conversions between all dashboard API versions:

| From ↓ / To → | v0alpha1 | v1beta1 | v2alpha1 | v2beta1 |
|---------------|----------|---------|----------|---------|
| **v0alpha1**  | ✓        | ✓       | ✓        | ✓       |
| **v1beta1**   | ✓        | ✓       | ✓        | ✓       |
| **v2alpha1**  | ✓        | ✓       | ✓        | ✓       |
| **v2beta1**   | ✓        | ✓       | ✓        | ✓       |

Each conversion path is automatically instrumented with metrics and logging.

## API Versions

The supported dashboard API versions are:

- `dashboard.grafana.app/v0alpha1` - Legacy JSON dashboard format
- `dashboard.grafana.app/v1beta1` - Migrated JSON dashboard format  
- `dashboard.grafana.app/v2alpha1` - New structured dashboard format
- `dashboard.grafana.app/v2beta1` - Enhanced structured dashboard format

## Schema Versions

Schema versions (v13-v42) apply only to v0alpha1 and v1beta1 dashboards:

- **Minimum supported version**: v13
- **Latest version**: v42  
- **Migration path**: Sequential (v13→v14→v15...→v42)

For detailed information about creating schema version migrations, see the [SchemaVersion Migration Guide](./schemaversion/README.md).

## Testing

The implementation includes comprehensive test coverage for conversion-level operations:

- **Backend conversion tests**: API version conversions with metrics validation
- **Frontend tests**: TypeScript conversion tests  
- **Integration tests**: End-to-end conversion validation
- **Metrics tests**: Prometheus counter validation

### Backend conversion tests

The backend conversion tests validate API version conversions and metrics instrumentation:

- **API conversion tests**: Test conversions between v0alpha1, v1beta1, v2alpha1, v2beta1
- **Metrics validation**: Tests verify that conversion metrics are properly recorded
- **Error handling**: Tests validate error classification and logging
- **Performance**: Tests ensure conversion operations are efficient

**Test execution:**
```bash
# All backend conversion tests
go test ./apps/dashboard/pkg/migration/conversion/... -v

# Metrics validation tests
go test ./apps/dashboard/pkg/migration/... -run TestSchemaMigrationMetrics
```

### Frontend migration comparison tests

The frontend migration comparison tests validate that backend and frontend conversion logic produce consistent results:

- **Test methodology**: Compares backend vs frontend conversion outputs through DashboardModel integration
- **Dataset coverage**: Tests run against curated test files covering various conversion scenarios
- **Test location**: `public/app/features/dashboard/state/DashboardMigratorToBackend.test.ts`
- **Test data**: Located in `apps/dashboard/pkg/migration/testdata/input/` and `testdata/output/`

**Test execution:**
```bash
# Frontend migration comparison tests
yarn test DashboardMigratorToBackend.test.ts
```

**Test approach:**
- **Frontend path**: `jsonInput → DashboardModel → DashboardMigrator → getSaveModelClone()`
- **Backend path**: `jsonInput → Backend Conversion → backendOutput → DashboardModel → getSaveModelClone()`
- **Comparison**: Direct comparison of final converted states from both paths

For schema version migration testing details, see the [SchemaVersion Migration Guide](./schemaversion/README.md).

## Monitoring Migrations

The dashboard migration system provides comprehensive observability through metrics, logging, and error classification to monitor conversion operations.

### Metrics

The dashboard migration system now provides comprehensive observability through:
- **Prometheus metrics** for tracking conversion success/failure rates and performance
- **Structured logging** for debugging and monitoring conversion operations
- **Automatic instrumentation** via wrapper functions that eliminate code duplication
- **Error classification** to distinguish between different types of migration failures

#### 1. Dashboard conversion success metric

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

#### 2. Dashboard conversion failure metric

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

### Error Types

The `error_type` label classifies failures into four categories:

#### 1. `conversion_error`
- General conversion failures not related to schema migration
- API-level conversion issues
- Programming errors in conversion functions

#### 2. `schema_version_migration_error`
- Failures during individual schema version migrations (v14→v15, v15→v16, etc.)
- Schema-specific transformation errors
- Data format incompatibilities

#### 3. `schema_minimum_version_error`
- Dashboards with schema versions below the minimum supported version (< v13)
- These are logged as warnings rather than errors
- Indicates dashboards that cannot be migrated automatically

#### 4. `conversion_data_loss_error`
- Data loss detected during conversion
- Automatically checks that panels, queries, annotations, and links are preserved
- Triggered when target has fewer items than source
- Includes detailed loss metrics in logs (see [Data Loss Detection](#data-loss-detection))

### Logging

#### Log structure

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

**Data Loss Fields (conversion_data_loss_error only):**
- `panelsLost` - Number of panels lost
- `queriesLost` - Number of queries lost
- `annotationsLost` - Number of annotations lost
- `linksLost` - Number of links lost
- `variablesLost` - Number of template variables lost

#### Log levels

##### Success (DEBUG level)
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

##### Conversion/Migration Error (ERROR level)
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

##### Minimum Version Error (WARN level)
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

##### Data Loss Error (ERROR level)
```json
{
  "level": "error",
  "msg": "Dashboard conversion failed",
  "sourceVersionAPI": "dashboard.grafana.app/v1beta1",
  "targetVersionAPI": "dashboard.grafana.app/v2alpha1",
  "erroredConversionFunc": "V1beta1_to_V2alpha1",
  "dashboardUID": "abc123",
  "sourceSchemaVersion": 42,
  "targetSchemaVersion": 42,
  "panelsLost": 0,
  "queriesLost": 2,
  "annotationsLost": 0,
  "linksLost": 0,
  "variablesLost": 0,
  "errorType": "conversion_data_loss_error",
  "error": "data loss detected: query count decreased from 7 to 5"
}
```

### Data Loss Detection

**Automatic Runtime Checks:**

Every conversion automatically detects data loss by comparing:
- **Panel count** - Visualization panels (regular + library panels)
- **Query count** - Data source queries (excludes invalid row panel queries)
- **Annotation count** - Dashboard-level annotations
- **Link count** - Navigation links
- **Variable count** - Template variables (from `templating.list` in v0/v1, `variables` in v2)

**Detection Logic:**
- ✅ **Allows additions**: Default annotations, enriched data
- ❌ **Detects losses**: Any decrease in counts triggers `conversion_data_loss_error`

**Testing:**

Run comprehensive data loss tests on all conversion test files:

```bash
# Test all conversions for data loss
go test ./apps/dashboard/pkg/migration/conversion/... -run TestDataLossDetectionOnAllInputFiles -v

# Test shows detailed panel/query analysis when loss is detected
```

**Implementation:** See `conversion/conversion_data_loss_detection.go` and `conversion/README.md` for details.

### Implementation Details

#### Automatic instrumentation

All dashboard conversions are automatically instrumented via the `withConversionMetrics` wrapper function:

```go
// All conversion functions are wrapped automatically
// Includes metrics, logging, and data loss detection
s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil),
    withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
        return Convert_V0_to_V1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
    }))
```

#### Error handling

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

// Data loss errors (NEW)
// Detected when dashboard components (panels, queries, annotations, links, variables) 
// are lost during conversion
type ConversionDataLossError struct {
    functionName     string  // Function where data loss was detected (e.g., "V1_to_V2alpha1")
    message          string  // Detailed error message with loss statistics
    sourceAPIVersion string  // Source API version (e.g., "dashboard.grafana.app/v1beta1")
    targetAPIVersion string  // Target API version (e.g., "dashboard.grafana.app/v2alpha1")
}
```

### Registration

#### Metrics registration

Metrics must be registered with Prometheus during service initialization:

```go
import "github.com/grafana/grafana/apps/dashboard/pkg/migration"

// Register metrics with Prometheus
migration.RegisterMetrics(prometheusRegistry)
```

#### Available metrics

The following metrics are available after registration:

```go
// Success counter
migration.MDashboardConversionSuccessTotal

// Failure counter  
migration.MDashboardConversionFailureTotal
```

## Related Documentation

- [Schema Migration Guide](./schemaversion/README.md) - Complete guide for creating new dashboard schema migrations
- [PR #110178 - Dashboard migration: Add missing metrics registration](https://github.com/grafana/grafana/pull/110178)
