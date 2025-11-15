# Dashboard Schema Migration Guide

This guide provides comprehensive instructions for creating new dashboard schema migrations in Grafana.

## Table of Contents

- [Overview](#overview)
- [Current Schema Versions](#current-schema-versions)
- [Creating a New Migration](#creating-a-new-migration)
  - [Step 1: Create the Migration File](#step-1-create-the-migration-file)
  - [Step 2: Register the Migration](#step-2-register-the-migration)
  - [Step 3: Create Test Data](#step-3-create-test-data)
  - [Step 4: Run Tests](#step-4-run-tests)
  - [Step 5: Frontend-Backend Consistency Validation](#step-5-frontend-backend-consistency-validation)
  - [Step 6: Unit Testing](#step-6-unit-testing)
- [Utility Functions](#utility-functions)
  - [Type Conversion](#type-conversion)
  - [Data Access](#data-access)
- [Common Pitfalls](#common-pitfalls)
  - [Type Assertions](#1-type-assertions)
  - [Null Handling](#2-null-handling)
  - [Nested Panel Processing](#3-nested-panel-processing)
- [Migration Beyond v42](#migration-beyond-v42)
  - [When to Add Schema Migrations vs Panel Migrations](#when-to-add-schema-migrations-vs-panel-migrations)
- [Testing Guidelines](#testing-guidelines)
  - [Test File Naming](#test-file-naming)
  - [Test Data Requirements](#test-data-requirements)
  - [Running Tests](#running-tests)
- [Comprehensive Testing Strategy](#comprehensive-testing-strategy)
  - [Backend Migration Tests](#backend-migration-tests)
  - [Frontend Migration Comparison Tests](#frontend-migration-comparison-tests)
  - [Single Version Migration Testing](#single-version-migration-testing)
- [Resources](#resources)
- [Getting Help](#getting-help)

## Overview

Dashboard schema migrations ensure backward compatibility as the dashboard data model evolves. Each migration transforms dashboards from one schema version to the next, allowing older dashboards to work with newer Grafana versions.

## Current Schema Versions

- **Minimum Version**: 13
- **Latest Version**: 42
- **Backend Location**: `apps/dashboard/pkg/migration/schemaversion/`
- **Frontend Location**: `public/app/features/dashboard/state/DashboardMigrator.ts`

## Creating a New Migration

### Step 1: Create the Migration File

Create a new file: `v{N}.go` where `{N}` is the target schema version.

```go
package schemaversion

import "context"

// V{N} migrates [describe what this migration does].
//
// [Detailed description of the migration including:]
// - What properties are being changed
// - Why the migration is necessary
// - Any special handling or edge cases
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "graph",
//	    "oldProperty": "value"
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "graph",
//	    "newProperty": "value"
//	  }
//	]
func V{N}(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = {N}

	// Your migration logic here
	// Transform dashboard properties as needed

	return nil
}
```

### Step 2: Register the Migration

Add your migration to `migrations.go`:

```go
func GetMigrations(dsInfoProvider DataSourceInfoProvider) map[int]SchemaVersionMigrationFunc {
	return map[int]SchemaVersionMigrationFunc{
		// ... existing migrations
		{N}: V{N},  // Add your migration here
		// ... rest of migrations
	}
}
```

### Step 3: Create Test Data

#### Input Test File
Create `testdata/input/v{N}.{name}.json` with schema version `{N-1}` with scenarios to cover the specific migration:

```json
{
  "title": "V{N} Migration Test Dashboard",
  "schemaVersion": {N-1},
  "panels": [
    {
      "id": 1,
      "type": "graph",
      "title": "Test Panel",
      "oldProperty": "value"
    }
  ]
}
```

#### Expected Output
The test system will generate `testdata/output/latest_version/v{N}.{name}.v42.json` automatically.

### Step 4: Run Tests

```bash
# Run migration tests
go test ./apps/dashboard/pkg/migration/...

# Run specific migration test
go test ./apps/dashboard/pkg/migration/... -run TestMigrate
```

For comprehensive testing strategies including single version tests, frontend comparison tests, and full pipeline testing, see the [Comprehensive Testing Strategy](#comprehensive-testing-strategy) section.

### Step 5: Frontend-Backend Consistency Validation

Implement different changes in the migration until frontend matches exactly with the backend side. Add as many scenarios as possible to ensure comprehensive coverage of all use cases.

For detailed testing strategies including single version tests, frontend comparison tests, and full pipeline testing, see the [Comprehensive Testing Strategy](#comprehensive-testing-strategy) section.

#### Test Scenarios to Cover

**Panel-Level Changes:**
- Panels with different types (graph, table, stat, etc.)
- Panels with nested panels (rows)
- Panels with various property combinations
- Panels with missing or null properties
- Panels with deprecated properties

**Dashboard-Level Changes:**
- Dashboard properties (title, tags, time, etc.)
- Templating variables (query, textbox, custom, etc.)
- Annotations and links
- Time picker settings
- Refresh settings

**Edge Cases:**
- Empty dashboards
- Dashboards with only rows
- Dashboards with mixed panel types
- Dashboards with complex nested structures
- Dashboards with invalid or malformed data

**Property Transformations:**
- Property renaming scenarios
- Property type conversions
- Property value transformations
- Property removal scenarios
- Property addition scenarios

#### Validation Process

1. **Create comprehensive test data** covering all scenarios
2. **Run backend migration** and capture output
3. **Run frontend migration** and capture output
4. **Compare outputs** using strict equality checks
5. **Iterate on migration logic** until outputs match exactly
6. **Add more test cases** for any discrepancies found

#### Test Data Requirements

Create multiple test files for each migration:
- `v{N}.basic.{name}.json` - Basic functionality
- `v{N}.edge_cases.{name}.json` - Edge cases and error conditions
- `v{N}.complex.{name}.json` - Complex dashboard structures
- `v{N}.property_changes.{name}.json` - Property transformation scenarios

### Step 6: Unit Testing

Add comprehensive unit tests for both backend and frontend migrations to ensure the correct logic is implemented.

#### Backend Unit Tests

Create unit tests in `v{N}_test.go`:

```go
package schemaversion_test

import (
	"context"
	"testing"
	"github.com/stretchr/testify/require"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV{N}(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "basic property migration",
			input: map[string]interface{}{
				"schemaVersion": {N-1},
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"type": "graph",
						"oldProperty": "value",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": {N},
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"type": "graph",
						"newProperty": "value",
					},
				},
			},
		},
		{
			name: "edge case - missing property",
			input: map[string]interface{}{
				"schemaVersion": {N-1},
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"type": "graph",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": {N},
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"type": "graph",
					},
				},
			},
		},
		// Add more test cases...
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := schemaversion.V{N}(context.Background(), tt.input)
			require.NoError(t, err)
			require.Equal(t, tt.expected, tt.input)
		})
	}
}
```

#### Frontend Unit Tests

Create unit tests in `DashboardMigrator.test.ts`:

```typescript
describe('V{N} Migration', () => {
  it('should migrate basic property changes', () => {
    const dashboard = {
      schemaVersion: {N-1},
      panels: [
        {
          id: 1,
          type: 'graph',
          oldProperty: 'value'
        }
      ]
    };

    const model = new DashboardModel(dashboard);
    expect(model.schemaVersion).toBe({N});
    expect(model.panels[0].newProperty).toBe('value');
    expect(model.panels[0].oldProperty).toBeUndefined();
  });

  it('should handle edge cases correctly', () => {
    const dashboard = {
      schemaVersion: {N-1},
      panels: []
    };

    const model = new DashboardModel(dashboard);
    expect(model.schemaVersion).toBe({N});
    expect(model.panels).toEqual([]);
  });

  // Add more test cases...
});
```


#### Running Unit Tests

```bash
# Backend unit tests
go test ./apps/dashboard/pkg/migration/schemaversion/... -run TestV{N}

# Frontend unit tests
yarn test DashboardMigrator.test.ts -t "V{N}"

# Integration tests
go test ./apps/dashboard/pkg/migration/... -run TestMigrate
yarn test DashboardMigratorToBackend.test.ts
```



## Utility Functions

### Type Conversion
```go
// Convert various types to float64
func ConvertToFloat(value interface{}) (float64, bool) {
	// Implementation in utils.go
}

// Get string value with default
func GetStringValue(data map[string]interface{}, key string, defaultValue string) string {
	// Implementation in utils.go
}

// Get boolean value with default
func GetBoolValue(data map[string]interface{}, key string) bool {
	// Implementation in utils.go
}
```

### Data Access
```go
// Safe property access
if value, ok := panel["property"].(string); ok {
	// Use value
}

// Safe array access
if panels, ok := dashboard["panels"].([]interface{}); ok {
	// Process panels
}
```

## Common Pitfalls

### 1. Type Assertions
```go
// ❌ Wrong - can panic
value := panel["property"].(string)

// ✅ Correct - safe type assertion
if value, ok := panel["property"].(string); ok {
	// Use value
}
```

### 2. Null Handling
```go
// ❌ Wrong - removes intentional nulls
if value == nil {
	delete(panel, "property")
}

// ✅ Correct - preserve intentional nulls
if value == nil && !isIntentionallyNull(panel, "property") {
	delete(panel, "property")
}
```

### 3. Nested Panel Processing
```go
// ❌ Wrong - misses nested panels
for _, panel := range panels {
	migratePanel(panel)
}

// ✅ Correct - handles nested panels
for _, panel := range panels {
	migratePanelRecursively(panel)
}
```

## Migration Beyond v42

**Important**: Schema version 42 is the final version for the v1 dashboard API. For new migrations beyond v42:

1. **Backend**: Continue adding schema versions in Go
2. **Frontend**: Use panel-specific migration handlers instead of schema versions
3. **Justification Required**: Each new migration must be properly justified
4. **v2 Transition**: Consider the impact on the transition to schema v2

### When to Add Schema Migrations vs Panel Migrations

**Add Schema Migration** when:
- Changes affect dashboard-level properties
- Cross-panel transformations are needed
- Backward compatibility requires schema version increment
- **With proper justification** about why it can't be handled as panel migration

**Use Panel-Specific Migrations** when:
- Changes are panel-type specific
- Can be handled within individual panel plugins
- Don't require dashboard-level schema changes

## Testing Guidelines

### Test File Naming
- Input: `v{N}.{descriptive_name}.json`
- Output: `v{N}.{descriptive_name}.v42.json`

### Test Data Requirements
- Input schema version should be `{N-1}`
- Include comprehensive test cases
- Test edge cases and error conditions
- Use realistic dashboard data

### Running Tests
```bash
# Run all migration tests
go test ./apps/dashboard/pkg/migration/...

# Run specific test
go test ./apps/dashboard/pkg/migration/... -run TestMigrate

# Run with verbose output
go test ./apps/dashboard/pkg/migration/... -v
```

## Comprehensive Testing Strategy

### Backend Migration Tests

The backend migration tests validate schema version migrations and API conversions:

- **Schema migration tests**: Test individual schema version upgrades (v14→v15, v15→v16, etc.)
- **Conversion tests**: Test API version conversions with automatic metrics instrumentation
- **Test data**: Uses curated test files from `testdata/input/` covering schema versions 14-42
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

### Frontend Migration Comparison Tests

The frontend migration comparison tests validate that backend and frontend migration logic produce consistent results:

- **Test methodology**: Compares backend vs frontend migration outputs through DashboardModel integration
- **Dataset coverage**: Tests run against 42+ curated test files spanning schema versions 14-42
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

### Single Version Migration Testing

The system supports both single version and full pipeline testing:

- **Single version tests**: Test individual migrations (v15 → v16)
- **Full pipeline tests**: Test complete migration (v15 → v42)
- **Test directories**: `single_version/` vs `latest_version/`
- **Coverage**: Comprehensive testing of all migration paths

**Test execution:**
```bash
# Single version migration tests
go test ./apps/dashboard/pkg/migration/... -run TestMigrateSingleVersion

# Full pipeline tests
go test ./apps/dashboard/pkg/migration/... -run TestMigrate
```

## Resources

- [Migration Architecture Documentation](../../../docs/migration-architecture.md)
- [Frontend Migration Guide](../../../../public/app/features/dashboard/state/README.md)
- [Test Data Examples](../testdata/input/)
- [Existing Migration Examples](./)

## Getting Help

- Review existing migrations for patterns
- Check test data for examples
- Consult the team for complex migrations
- Use the migration test utilities for common operations
