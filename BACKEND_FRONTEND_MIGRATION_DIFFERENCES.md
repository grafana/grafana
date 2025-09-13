# Backend vs Frontend Migration Differences Analysis

## Overview

This document analyzes the current differences between backend and frontend migration outputs, specifically focusing on the v28 migration test failures. The analysis is based on the test failures observed in `DashboardMigratorSingleVersion.test.ts` and `DashboardMigratorToBackend.test.ts`.

## Current Test Status

**Test Results**: 2 out of 160 tests failing (98.75% pass rate)

- **DashboardMigratorSingleVersion.test.ts**: 1 failure
- **DashboardMigratorToBackend.test.ts**: 1 failure
- **DashboardMigrator.test.ts**: All passing

## Progress Update

### ✅ **COMPLETED SOLUTIONS**:

1. **Solution 1: Variable Adapter Logic** - Fixed `useTags` property handling
   - Backend now conditionally removes `useTags` only if truthy, matching frontend behavior
   - Fixed in `removeDeprecatedVariableProperties()` function

2. **Solution 2: Value Mapping Color Inheritance** - Fixed color inheritance logic
   - Backend now uses `old.text` instead of `old.value` for numeric parsing
   - Matches frontend's `upgradeValueMappings` behavior exactly

3. **Solution 3: Panel Field Config Defaults** - Removed extra properties
   - Backend no longer adds `color`, `nullValueMode`, `unit` to `fieldConfig.defaults`
   - Matches frontend's `statPanelChangedHandler` behavior

4. **Solution 4: Panel Options Differences** - Fixed panel options
   - Backend now sets correct `orientation`, `calcs`, `percentChangeColorMode` values
   - Matches frontend's `migrateFromAngularSinglestat` behavior

5. **Solution 5: Panel Structure Differences** - Fixed `maxDataPoints` preservation
   - Backend now preserves `maxDataPoints` and `interval` properties
   - Added to `mustKeepProps` list in `cleanupAngularProperties`

6. **Solution 6: Panel Options Exact Match** - Updated backend to match frontend exactly
   - Backend now uses exact same default options as frontend
   - Matches `getDefaultStatOptions`, `migratetSinglestat`, `migrateGrafanaSinglestatPanel`

7. **Solution 7: Panel Ordering** - Fixed panel ordering to match frontend
   - Backend now sorts panels by `gridPos` like frontend's `sortPanelsByGridPos`
   - Handles missing `gridPos` with default values (x: 0, y: 0)

### ❌ **REMAINING ISSUE**:

**Solution 8: Datasource Property Differences** - Backend adds extra datasource properties

- Backend adds `"apiVersion": "v1"` and `"uid": "default-ds-uid"` to some datasources
- Frontend doesn't have these properties
- This is the only remaining difference affecting 2 tests

## Current Test Failures

### v28.singlestat_migration.json (Only Remaining Failure)

**Issue**: Backend adds extra datasource properties that frontend doesn't have

**Backend Output**:

```json
{
  "datasource": {
    "apiVersion": "v1", // ← Backend adds this
    "type": "prometheus",
    "uid": "default-ds-uid" // ← Backend adds this
  }
}
```

**Frontend Output**:

```json
{
  "datasource": {
    "type": "prometheus"
    // ← Frontend doesn't have apiVersion or uid
  }
}
```

**Affected Panels**:

- Panel 5 (grafana-singlestat-panel)
- Panel 6 (stat panel)
- Panel 7 (text panel)
- Panel 8 (timeseries panel)

**Root Cause**: Backend is adding default datasource properties during migration that the frontend doesn't add.

## Root Cause Analysis

### Datasource Property Differences Issue

**Problem**: Backend adds `"apiVersion": "v1"` and `"uid": "default-ds-uid"` to datasources while frontend doesn't.

**Root Cause**: The backend's migration process is adding default datasource properties that the frontend doesn't add during its migration process.

**Frontend Behavior**:

- Preserves original datasource structure
- Only keeps properties that were originally present
- Doesn't add default `apiVersion` or `uid` properties

**Backend Behavior**:

- Adds default datasource properties during migration
- Includes `apiVersion: "v1"` and `uid: "default-ds-uid"`
- This creates additional properties not present in frontend output

**Investigation Needed**:

- Check where backend adds these datasource properties
- Compare with frontend's datasource handling during migration
- Determine if backend should skip adding these properties

## Missing Backend Functionality

### Datasource Property Handling

**Missing**: Proper datasource property handling during migration

**Required Implementation**:

- Don't add default `apiVersion` and `uid` properties to datasources
- Preserve original datasource structure like frontend does
- Only keep properties that were originally present

**Investigation Areas**:

1. **Backend Migration Process**: Check where datasource properties are added
2. **Frontend Comparison**: Compare with frontend's datasource handling
3. **Default Values**: Determine if backend should skip adding these defaults

## Implementation Plan

### Phase 1: Datasource Property Handling (High Priority)

1. **Investigate Backend Migration**:
   - Find where `apiVersion` and `uid` are added to datasources
   - Check if this happens during panel migration or cleanup

2. **Compare with Frontend**:
   - Analyze frontend's datasource handling during migration
   - Determine why frontend doesn't add these properties

3. **Fix Backend**:
   - Remove or conditionally add datasource properties
   - Match frontend's datasource structure exactly

4. **Test**: Run v28.singlestat_migration.json test

## Testing Process

### How to Test Changes

1. **Clear Output Files**:

   ```bash
   find ./apps/dashboard/pkg/migration/testdata/output -name "*.json" -delete
   ```

2. **Run Backend Tests**:

   ```bash
   go test ./apps/dashboard/pkg/migration/
   ```

   - This generates new output files
   - Green means output matches previous snapshot
   - Must run this before frontend tests

3. **Run Frontend Tests**:

   ```bash
   yarn test DashboardMigrator --no-watch
   ```

   - This compares backend output with frontend output
   - Will fail if outputs don't match exactly

### Complete Test Command

```bash
cd /Users/ivanortegaalba/repos/grafana && \
find ./apps/dashboard/pkg/migration/testdata/output -name "*.json" -delete && \
go test ./apps/dashboard/pkg/migration/ && \
yarn test DashboardMigrator --no-watch
```

### Test File Structure

- **Input Files**: `./apps/dashboard/pkg/migration/testdata/input/v*.json`
- **Backend Output**: `./apps/dashboard/pkg/migration/testdata/output/single_version/v*.v*.json`
- **Latest Output**: `./apps/dashboard/pkg/migration/testdata/output/latest_version/v*.v41.json`

## Expected Outcomes

After implementing the final fix:

1. **v28.singlestat_migration.json**: Should pass (datasource property handling)

**Target**: 100% test pass rate (160/160 tests passing)

## Summary of Achievements

We have successfully resolved **7 out of 8** major migration differences:

✅ **Variable adapter logic** - Fixed `useTags` property handling  
✅ **Value mapping color inheritance** - Fixed to use `old.text` instead of `old.value`  
✅ **Panel field config defaults** - Removed extra properties from `fieldConfig.defaults`  
✅ **Panel options differences** - Fixed `orientation`, `calcs`, `percentChangeColorMode`  
✅ **Panel structure differences** - Fixed `maxDataPoints` preservation  
✅ **Panel options exact match** - Updated backend to match frontend exactly  
✅ **Panel ordering** - Fixed backend to sort panels by grid position like frontend

❌ **Remaining**: Datasource property differences (only 1 issue left)

## Files to Modify

1. **`/Users/ivanortegaalba/repos/grafana/apps/dashboard/pkg/migration/frontend_defaults.go`**:
   - ✅ Enhanced `cleanupDashboardForSave()` with complete variable adapter logic
   - ✅ Fixed variable type-specific handling
   - ✅ Added panel sorting by grid position

2. **`/Users/ivanortegaalba/repos/grafana/apps/dashboard/pkg/migration/schemaversion/v28.go`**:
   - ✅ Fixed value mapping color inheritance
   - ✅ Fixed panel field config defaults
   - ✅ Fixed panel options to match frontend exactly
   - ✅ Fixed `maxDataPoints` preservation

## Next Steps

1. **Investigate**: Find where backend adds `apiVersion` and `uid` to datasources
2. **Compare**: Analyze frontend's datasource handling during migration
3. **Fix**: Remove or conditionally add datasource properties to match frontend
4. **Test**: Verify 100% test pass rate (160/160 tests passing)

This analysis shows we are **98.75% complete** with only 1 remaining issue to achieve 100% backend-frontend migration consistency.
