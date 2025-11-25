# Dashboard Conversion Session Context

## Overview

This session focuses on fixing inconsistencies between backend (Go) and frontend (TypeScript) dashboard conversions from v2beta1 to v1beta1 format. The goal is to ensure both paths produce identical output when converting the same v2beta1 input.

## Core Principle

**General Rule for Attribute Handling:**

- If an attribute is **optional** and not provided in the input, **don't add it**
- If an attribute is **mandatory** and not defined, use the **schema default value**
- If a value is **provided in the input, preserve it if the frontend does it**

## Test Files

### Backend Tests

- Location: `apps/dashboard/pkg/migration/conversion/`
- Main test file: `v2alpha1_to_v1beta1_test.go`
- Test data input: `apps/dashboard/pkg/migration/conversion/testdata/input/`
- Test data output: `apps/dashboard/pkg/migration/conversion/testdata/output/`
- Environment variable: `OUTPUT_OVERRIDE=true` - when set, tests overwrite output files instead of comparing

### Frontend Tests

- Location: `public/app/features/dashboard-scene/serialization/`
- Main test file: `transformSaveModelV2ToV1.test.ts`
- Compares backend output (v2beta1 → v1beta1 via Go) with frontend output (v2beta1 → v1beta1 via TypeScript)

## Key Conversion Files

### Backend (Go)

1. **`apps/dashboard/pkg/migration/conversion/v2alpha1_to_v1beta1.go`**
   - Main conversion logic from v2alpha1/v2beta1 to v1beta1
   - Key functions:
     - `ConvertDashboard_V2alpha1_to_V1beta1` - main conversion entry point
     - `convertPanelsFromElementsAndLayout` - converts panels from v2 elements/layout
     - `convertAnnotationsToV1` - converts annotations
     - `convertVariablesToV1` - converts variables
     - `convertPanelKindToV1` - converts panel type (uses `VizConfig.Kind` as plugin ID)

2. **`apps/dashboard/pkg/migration/conversion/conversion.go`**
   - Registers conversion functions
   - `RegisterConversions(scheme, dsIndexProvider, leIndexProvider)`

3. **`apps/dashboard/pkg/migration/conversion/migrate.go`**
   - `Initialize(dsIndexProvider, leIndexProvider)` - initializes migration system

### Frontend (TypeScript)

1. **`public/app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene.ts`**
   - Converts v2beta1 dashboard schema to Scene Graph
   - Key functions:
     - `transformSaveModelSchemaV2ToScene` - main entry point
     - Creates Scene variables from v2beta1 variables
     - Creates Scene panels from v2beta1 elements/layout

2. **`public/app/features/dashboard-scene/serialization/transformSceneToSaveModel.ts`**
   - Converts Scene Graph back to v1beta1 save model
   - Key functions:
     - `transformSceneToSaveModel` - main entry point
     - `dataLayersToAnnotations` - converts Scene data layers to v1 annotations
     - `sceneVariablesSetToVariables` - converts Scene variables to v1 variables

3. **`public/app/features/dashboard-scene/serialization/transformSaveModelToScene.ts`**
   - Converts v1beta1 DashboardModel to Scene Graph
   - Used when loading backend output into Scene

4. **`public/app/features/dashboard-scene/serialization/sceneVariablesSetToVariables.ts`**
   - Converts Scene variables to v1 VariableModel objects
   - Handles all variable types: query, constant, interval, textbox, adhoc, etc.

5. **`public/app/features/dashboard-scene/serialization/annotations.ts`**
   - Converts annotations between v1 and v2 formats
   - `transformV1ToV2AnnotationQuery` - v1 → v2
   - `transformV2ToV1AnnotationQuery` - v2 → v1

6. **`public/app/features/dashboard-scene/serialization/dataLayersToAnnotations.ts`**
   - Converts Scene data layers to v1 annotations
   - Handles empty datasource objects

7. **`public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts`**
   - `getRuntimeVariableDataSource` - gets datasource for variables from v2beta1
   - `getDataSourceForQuery` - resolves datasource with defaults

8. **`public/app/features/dashboard/state/DashboardModel.ts`**
   - Frontend dashboard model
   - Constructor handles initialization from v1beta1 data
   - `addBuiltInAnnotationQuery()` - adds built-in annotation if missing

## Issues Fixed

### ✅ 1. Built-in Annotation Being Added

**Problem:** Frontend was adding built-in annotation even when backend output didn't have one.

**Root Cause:** `DashboardModel` constructor always called `addBuiltInAnnotationQuery()`.

**Fix Applied:** In `DashboardModel.ts` (lines 186-191):

```typescript
const hasBuiltInInInput = data.annotations?.list?.some((item) => Boolean(item.builtIn));
if (!hasBuiltInInInput) {
  this.addBuiltInAnnotationQuery();
}
```

### ✅ 2. editable Being Added

**Problem:** Frontend was adding `editable: true` when backend output didn't have it.

**Root Cause:** `DashboardModel` constructor defaulted `editable` to `true` when undefined.

**Fix Applied:** In `DashboardModel.ts` (line 157):

```typescript
this.editable = data.editable ?? undefined;
```

### ✅ 3. Empty Datasource Objects in Annotations

**Problem:** Frontend was including `datasource: {}` when backend output had no datasource.

**Root Cause:** `dataLayersToAnnotations` didn't check for empty datasource objects.

**Fix Applied:** In `dataLayersToAnnotations.ts` (lines 20-26):

```typescript
if (datasource && Object.keys(datasource).length > 0 && (datasource.uid || datasource.type)) {
  result.datasource = datasource;
}
```

### ✅ 4. builtIn: false Being Added

**Problem:** Frontend was adding `builtIn: false` to annotations when backend didn't have it.

**Root Cause:** `transformV1ToV2AnnotationQuery` was converting `undefined` to `false`.

**Fix Applied:** In `annotations.ts` (line 42):

```typescript
...(annotation.builtIn === 1 || (annotation.builtIn !== undefined && Boolean(annotation.builtIn)) ? { builtIn: true } : {})
```

### ✅ 5. allowCustomValue for Adhoc Variables

**Problem:** Frontend was adding `allowCustomValue: true` when backend didn't have it.

**Root Cause:** `AdHocFiltersVariable` defaults `allowCustomValue` to `true`, and it was being serialized.

**Fix Applied:** In `sceneVariablesSetToVariables.ts` (lines 225-228):

```typescript
if (variable.state.allowCustomValue === false) {
  adhocVariable.allowCustomValue = false;
}
```

### ✅ 6. Constant Variable Type

**Problem:** Constant variables were being incorrectly serialized.

**Fix Applied:** In `sceneVariablesSetToVariables.ts` (line 147):

```typescript
type: 'constant', // Explicitly set type
hide: OldVariableHide.hideVariable,
```

### ✅ 7. Interval Variable Refresh

**Problem:** Interval variables weren't using proper refresh conversion.

**Fix Applied:** In `sceneVariablesSetToVariables.ts` (line 167):

```typescript
refresh: transformVariableRefreshToEnumV1(variable.state.refresh),
```

### ✅ 8. Variable Refresh Values

**Problem:** Variables without refresh were defaulting to `onDashboardLoad` (1) instead of `never` (0).

**Fix Applied:** In `transformSaveModelSchemaV2ToScene.ts` (line 349):

```typescript
refresh: transformVariableRefreshToEnumV1(variable.spec.refresh),
```

The `transformVariableRefreshToEnumV1` function defaults to `never` (0) for undefined values.

## Issues Not Fully Fixed

### ⚠️ 1. Time Defaults Being Added

**Problem:** Empty time strings (`from: ""`, `to: ""`) are being converted to defaults (`"now-6h"`, `"now"`) by `SceneTimeRange`.

**Root Cause:** `SceneTimeRange` constructor always converts empty strings to defaults. When loading v1beta1 with empty time strings into Scene, they become defaults, and when saving back, we get defaults instead of empty strings.

**Attempted Fix:** Tried to preserve empty strings by checking `initialSaveModel` in `transformSceneToSaveModel.ts`, but this was reverted.

**Status:** Not fully fixed. Need to find a way to preserve empty time strings through Scene, or handle them differently.

**Location:**

- `transformSaveModelToScene.ts` (line 374-381) - SceneTimeRange initialization
- `transformSceneToSaveModel.ts` (lines 123-126) - time serialization

### ⚠️ 2. Default Datasource Being Added to Variables

**Problem:** Variables without datasource are getting a default datasource added.

**Root Cause:** `getRuntimeVariableDataSource` calls `getDataSourceForQuery`, which always returns a datasource (adds default if missing).

**Attempted Fix:** Tried to return `undefined` if `variable.spec.query.datasource?.name` is missing, but this was reverted.

**Status:** Not fully fixed. The function still adds default datasource.

**Location:** `layoutSerializers/utils.ts` (lines 208-214) - `getRuntimeVariableDataSource`

## Important Utility Functions

### `transformVariableRefreshToEnumV1`

**Location:** `public/app/features/dashboard-scene/serialization/transformToV1TypesUtils.ts`
**Purpose:** Converts v2 refresh enum/string to v1 enum number

- `'never'` → `0`
- `'onDashboardLoad'` → `1`
- `'onTimeRangeChanged'` → `2`
- `undefined` or invalid → `0` (defaults to never)

### `transformVariableHideToEnumV1`

**Location:** `public/app/features/dashboard-scene/serialization/transformToV1TypesUtils.ts`
**Purpose:** Converts v2 hide enum to v1 enum number

### `getElementDatasource`

**Location:** `public/app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2.ts`
**Purpose:** Gets datasource for panels/variables/annotations from Scene, respecting auto-assigned refs

### `getRuntimeVariableDataSource`

**Location:** `public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts`
**Purpose:** Gets datasource for variables from v2beta1 input
**Issue:** Currently adds default datasource when missing

## Test Input Files

Key test input files in `apps/dashboard/pkg/migration/conversion/testdata/input/`:

- `v2beta1.complete.json` - comprehensive test case
- `v2beta1.ds-data-query.json` - datasource and data query tests
- `v2beta1.groupby-adhoc-vars.json` - groupby and adhoc variable tests
- `v2beta1.viz-config.json` - visualization config tests
- `v2alpha1.viz-config.json` - v2alpha1 visualization config tests

## Test Output Files

Output files in `apps/dashboard/pkg/migration/conversion/testdata/output/`:

- `v2beta1.*.v1beta1.json` - v2beta1 to v1beta1 conversions
- `v2alpha1.*.v1beta1.json` - v2alpha1 to v1beta1 conversions
- `v2alpha1.*.v2beta1.json` - v2alpha1 to v2beta1 conversions

## Running Tests

### Backend Tests

```bash
cd apps/dashboard/pkg/migration/conversion
go test ./... -v
```

### Override Output Files

```bash
OUTPUT_OVERRIDE=true go test ./... -v
```

### Frontend Tests

```bash
cd public/app/features/dashboard-scene/serialization
yarn test transformSaveModelV2ToV1.test.ts --no-watch
```

## Key Patterns

1. **Optional Fields:** Only include if explicitly set (not default values)
2. **Mandatory Fields:** Use schema defaults if not provided
3. **Preserve Values:** Always preserve provided values from input
4. **Empty Objects:** Don't include empty objects (e.g., `datasource: {}`)
5. **Boolean Handling:** Only set `false` explicitly, don't set `true` as default
6. **Enum Conversions:** Use utility functions for enum conversions (v2 → v1)

## Next Steps

1. **Fix Time Defaults:** Find a way to preserve empty time strings through Scene
2. **Fix Default Datasource:** Prevent default datasource from being added to variables without one
3. **Run Tests:** Verify all fixes with both backend and frontend tests
4. **Regenerate Outputs:** Use `OUTPUT_OVERRIDE=true` to regenerate test output files after fixes

## Important Notes

- The frontend test compares `backendSpec` (backend output loaded into Scene and saved back) with `frontendSpec` (v2beta1 loaded directly into Scene and saved)
- Metadata fields (`uid`, `version`, `id`) are ignored in comparisons
- The test only compares the dashboard `spec` structure
- Scene Graph is the intermediate representation between v2beta1 and v1beta1 in the frontend
- Backend converts directly from v2beta1 to v1beta1 without Scene Graph
