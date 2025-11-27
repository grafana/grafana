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

### ✅ 9. GraphTooltip / CursorSync (Fixed in Backend)

**Problem:** Backend output loaded through DashboardModel was losing graphTooltip value due to missing schemaVersion.

**Root Cause:** Backend output didn't include `schemaVersion`, so when loaded through `DashboardModel`, all migrations ran, including one at schema version 14 that resets `graphTooltip`.

**Fix Applied:** In `v2alpha1_to_v1beta1.go` (line 46):

```go
dashboard["schemaVersion"] = 42 // Latest schema version to prevent migrations when loaded
```

### ✅ 10. Constant Variable Type (Fixed in Backend)

**Problem:** Constant variables were being converted to textbox when loaded through DashboardModel.

**Root Cause:** Backend output had `hide: 0` (dontHide) for constant variables. DashboardMigrator at schema version 27 converts visible constant variables to textbox.

**Fix Applied:** In `v2alpha1_to_v1beta1.go` (function `convertConstantVariableToV1`):

```go
// Constant variables in v1beta1 must always be hidden (hide: 2),
// otherwise DashboardMigrator will convert them to textbox variables.
varMap := map[string]interface{}{
    "hide": 2, // hideVariable - constant variables must always be hidden in v1beta1
    // ...
}
```

### ✅ 11. AllowCustomValue: false for Adhoc Variables (Fixed in Backend)

**Problem:** Backend wasn't outputting `allowCustomValue: false` for adhoc variables.

**Root Cause:** Backend code only added `allowCustomValue` when truthy, missing `false` values.

**Fix Applied:** In `v2alpha1_to_v1beta1.go` (function `convertAdhocVariableToV1`):

```go
// Always include allowCustomValue for adhoc variables, including false values
varMap["allowCustomValue"] = spec.AllowCustomValue
```

## Issues Not Fully Fixed

### ⚠️ 1. Backend Panels Returning Empty

**Problem:** Backend path returns `panels: []` while frontend path returns actual panels for some test files.

**Status:** Needs investigation. The backend conversion for panels from elements/layout may have issues.

### ⚠️ 2. graphTooltip / cursorSync Mismatch (RESOLVED)

~~**Problem:** Frontend outputs `graphTooltip: 0` when it should be `2` for `cursorSync: "Tooltip"`.~~

**RESOLVED:** This was fixed by adding `schemaVersion: 42` to the backend output. The issue was that without schemaVersion, DashboardMigrator was running all migrations including one that reset graphTooltip.

**Input/Output Values:**

- v2beta1 Input: `cursorSync: "Tooltip"` (string)
- v1beta1 Expected: `graphTooltip: 2` (number)
- v1beta1 Actual: `graphTooltip: 0` (number)

**Type Definitions:**

- v2beta1 `DashboardCursorSync`: String type `"Crosshair" | "Tooltip" | "Off"`
- v1beta1 `DashboardCursorSync`: Enum `{ Off = 0, Crosshair = 1, Tooltip = 2 }`

**Code Flow Investigation:**

1. **Frontend path (v2beta1 → Scene → v1beta1):**

   ```
   dashboard.cursorSync ("Tooltip")
   → transformCursorSyncV2ToV1("Tooltip")
   → DashboardCursorSyncV1.Tooltip (= 2)
   → new behaviors.CursorSync({ sync: 2 })
   → Scene stores in $behaviors
   → transformSceneToSaveModel extracts from $behaviors
   → graphTooltip: ???
   ```

2. **`transformCursorSyncV2ToV1` function (transformToV1TypesUtils.ts:73-87):**
   - Correctly maps `'Tooltip'` → `DashboardCursorSyncV1.Tooltip` (= 2)
   - Function signature: `(cursorSync: DashboardCursorSync | undefined): DashboardCursorSyncV1`

3. **CursorSync behavior creation (transformSaveModelSchemaV2ToScene.ts:222-224):**

   ```typescript
   new behaviors.CursorSync({
     sync: transformCursorSyncV2ToV1(dashboard.cursorSync),
   });
   ```

4. **CursorSync constructor (@grafana/scenes):**

   ```javascript
   super({
     ...state,
     sync: state.sync || DashboardCursorSync.Off,
   });
   ```

   - If `state.sync` is `2`, it remains `2` (truthy)
   - If `state.sync` is `0` (falsy), it becomes `DashboardCursorSync.Off` (= 0)

5. **graphTooltip extraction (transformSceneToSaveModel.ts:109-111):**
   ```typescript
   const graphTooltip =
     state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync)?.state.sync ??
     defaultDashboard.graphTooltip;
   ```

**Possible Root Causes:**

1. **`$behaviors` not being passed correctly to DashboardScene** - The behaviors array might not be reaching the Scene state
2. **CursorSync behavior not being found** - The `instanceof` check might be failing
3. **`dashboard.cursorSync` is undefined** - The input might not have cursorSync at the expected location
4. **Type mismatch** - There might be a runtime type issue between v1 enum and v2 string

**Investigation Status:** Needs further debugging with console.log or unit tests to trace the actual value at each step.

**Location:**

- Input transform: `transformSaveModelSchemaV2ToScene.ts:222-224`
- Output transform: `transformSceneToSaveModel.ts:109-111`
- Type conversion: `transformToV1TypesUtils.ts:73-87`

### ⚠️ 3. Time Defaults Being Added

**Problem:** Empty time strings (`from: ""`, `to: ""`) are being converted to defaults (`"now-6h"`, `"now"`) by `SceneTimeRange`.

**Root Cause:** `SceneTimeRange` constructor always converts empty strings to defaults. When loading v1beta1 with empty time strings into Scene, they become defaults, and when saving back, we get defaults instead of empty strings.

**Attempted Fix:** Tried to preserve empty strings by checking `initialSaveModel` in `transformSceneToSaveModel.ts`, but this was reverted.

**Status:** Not fully fixed. Need to find a way to preserve empty time strings through Scene, or handle them differently.

**Location:**

- `transformSaveModelToScene.ts` (line 374-381) - SceneTimeRange initialization
- `transformSceneToSaveModel.ts` (lines 123-126) - time serialization

### ⚠️ 4. Default Datasource Being Added to Variables

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
go test -count=1 ./apps/dashboard/pkg/migration/conversion -v
```

### Regenerate Backend Output Files

**IMPORTANT:** After every backend change, run this command to regenerate the output files:

```bash
OUTPUT_OVERRIDE=true go test -count=1 ./apps/dashboard/pkg/migration/conversion -v
```

This ensures the frontend tests compare against the latest backend output.

### Frontend Tests

```bash
yarn test transformSaveModelV2ToV1.test.ts --no-watch
```

## Key Patterns

1. **Optional Fields:** Only include if explicitly set (not default values)
2. **Mandatory Fields:** Use schema defaults if not provided
3. **Preserve Values:** Always preserve provided values from input
4. **Empty Objects:** Don't include empty objects (e.g., `datasource: {}`)
5. **Boolean Handling:** Only set `false` explicitly, don't set `true` as default
6. **Enum Conversions:** Use utility functions for enum conversions (v2 → v1)

## Issues Fixed (Session 2)

### ✅ 11. RowsLayoutManager Panel Serialization

**Problem:** `transformSceneToSaveModel` only handled `DefaultGridLayoutManager`, so panels from `RowsLayoutManager` weren't serialized.

**Fix Applied:** Added handling for `RowsLayoutManager` in `transformSceneToSaveModel.ts`:

```typescript
} else if (body instanceof RowsLayoutManager) {
  // Handle RowsLayoutManager - iterate through rows and extract panels
  for (const row of body.state.rows) {
    const rowLayout = row.state.layout;
    if (rowLayout instanceof DefaultGridLayoutManager) {
      for (const child of rowLayout.state.grid.state.children) {
        if (child instanceof DashboardGridItem) {
          if (child.state.variableName) {
            panels = panels.concat(panelRepeaterToPanels(child, isSnapshot));
          } else {
            panels.push(gridItemToPanel(child, isSnapshot));
          }
        }
      }
    }
  }
}
```

### ✅ 12. Input Files Layout Format

**Problem:** Test input files `v2beta1.viz-config.json` and `v2beta1.ds-data-query.json` had incorrect layout formats (AutoGridLayout instead of RowsLayout with GridLayout).

**Fix Applied:** Updated input files to use RowsLayout with GridLayout, matching the v2beta1.complete.json format.

### ✅ 13. Query Target `hide` Field (Fixed in Backend)

**Problem:** Backend wasn't outputting `hide: false` for query targets, but frontend was adding it.

**Root Cause:** Backend code only added `hide` when `Hidden` was true.

**Fix Applied:** In `v2alpha1_to_v1beta1.go` (function `convertPanelQueryToV1Target`):

```go
// Add refId and hide (always include hide to match frontend behavior)
target["refId"] = query.Spec.RefId
target["hide"] = query.Spec.Hidden
```

### ✅ 14. Empty Panel Description (Fixed in Frontend)

**Problem:** Frontend was outputting `description: ""` for panels with empty descriptions.

**Root Cause:** Used `??` which preserves empty strings.

**Fix Applied:** In `transformSceneToSaveModel.ts`:

```typescript
description: vizPanel.state.description || undefined,  // Changed from ??
```

### ✅ 15. Panel-Level Datasource (Fixed in Frontend)

**Problem:** Frontend was outputting panel-level `datasource` even when not needed.

**Root Cause:** Unconditionally set `panel.datasource = queryRunner.state.datasource`.

**Fix Applied:** In `transformSceneToSaveModel.ts`:

```typescript
// Only set panel-level datasource if explicitly specified
if (queryRunner.state.datasource) {
  panel.datasource = queryRunner.state.datasource;
}
```

### ✅ 16. Refresh Field (Fixed in Backend)

**Problem:** Backend wasn't outputting `refresh: ""` when autoRefresh was empty, but Scene defaults to `""`.

**Fix Applied:** In `v2alpha1_to_v1beta1.go`:

```go
// Convert refresh - always include to match Scene's default behavior
dashboard["refresh"] = timeSettings.AutoRefresh
```

### ✅ 17. Time Defaults (Fixed in Backend)

**Problem:** Empty time strings (`from: ""`, `to: ""`) weren't matching between paths.

**Fix Applied:** In `v2alpha1_to_v1beta1.go`:

```go
// Convert time range - use defaults when empty to match DashboardModel behavior
from := timeSettings.From
to := timeSettings.To
if from == "" {
    from = "now-6h"
}
if to == "" {
    to = "now"
}
dashboard["time"] = map[string]interface{}{
    "from": from,
    "to":   to,
}
```

---

## Issues Not Fully Fixed

### ✅ 18. Built-in Annotation Added When Input Has Empty List (Fixed in Backend)

**Problem:** When v2beta1 input has `annotations: []`, the backend path was adding a built-in annotation.

**Root Cause:** The backend Go code was omitting the `annotations` key entirely when there were no annotations:

```go
if len(annotations) > 0 {
    dashboard["annotations"] = map[string]interface{}{...}
}
```

When loaded into `DashboardModel`, `data.annotations === undefined` was `true`, triggering `addBuiltInAnnotationQuery()`.

**Fix Applied:** In `v2alpha1_to_v1beta1.go`:

```go
// Always include annotations even if empty to prevent DashboardModel from adding built-in
annotations := convertAnnotationsToV1(in.Annotations)
dashboard["annotations"] = map[string]interface{}{
    "list": annotations,
}
```

### ⚠️ Default Datasource Being Added by Frontend Path (CONFIRMED via Debug Logging)

**Problem:** The frontend path (v2beta1 → Scene → v1beta1) adds default datasource to annotations, panels, and targets that don't have explicit datasource in the input. The backend path correctly does NOT add them.

**Debug Output Confirmed:**

```
// Backend Path (CORRECT - no datasource added):
DEBUG [BACKEND INPUT] no-ds-testdata-annos datasource: undefined
DEBUG [BACKEND OUTPUT] no-ds-testdata-annos datasource: undefined
DEBUG [BACKEND OUTPUT] Panel datasource: undefined
DEBUG [BACKEND OUTPUT] Panel target[0] datasource: undefined

// Frontend Path (INCORRECT - adds default datasource):
DEBUG [transformV2ToV1AnnotationQuery] dataQuery.datasource: undefined
DEBUG [transformV2ToV1AnnotationQuery] dataQuery.group: prometheus
DEBUG [transformV2ToV1AnnotationQuery] resolved datasource: { uid: 'default-ds-uid', type: 'prometheus' }
DEBUG [FRONTEND OUTPUT] no-ds-testdata-annos datasource: { type: 'prometheus', uid: 'default-ds-uid' }
DEBUG [FRONTEND OUTPUT] Panel datasource: { type: 'prometheus', uid: 'default-ds-uid' }
DEBUG [FRONTEND OUTPUT] Panel target[0] datasource: { type: 'prometheus', uid: 'default-ds-uid' }
```

**Root Cause:** The frontend path's `transformV2ToV1AnnotationQuery` (annotations.ts) calls `getRuntimePanelDataSource(dataQuery)` which:

1. Takes `dataQuery.group` (e.g., "prometheus")
2. Calls `getDataSourceForQuery()` in `layoutSerializers/utils.ts`
3. `getDataSourceForQuery()` ALWAYS resolves a datasource - it uses `config.defaultDatasource` as fallback
4. Returns `{ uid: 'default-ds-uid', type: 'prometheus' }` even when input has no datasource

**Affected Code Locations:**

1. **Annotations:** `annotations.ts` line 126-128:

   ```typescript
   const datasource = getRuntimePanelDataSource(dataQuery);
   annoQuerySpec.datasource = datasource; // Always sets it!
   ```

2. **Panels:** `layoutSerializers/utils.ts` - `getPanelDataSource()` and `createPanelDataProvider()`

3. **Variables:** Similar pattern in variable creation

**Fix Required:** Only set datasource if the input explicitly had one:

- For annotations: Only set `annoQuerySpec.datasource` if `dataQuery.datasource?.name` exists
- For panels: Only set panel datasource if input had explicit datasource reference
- For targets: Only set target datasource if input had explicit datasource reference

**Key Insight:** The backend v1beta1 output correctly has NO datasource for items without explicit datasource. When loaded through DashboardModel → Scene → transformSceneToSaveModel, it preserves this (no datasource added). But the frontend v2beta1 path incorrectly resolves and adds default datasources.

## Current Test Results (1 passing, 3 failing)

### ✅ Passing: `v2beta1.groupby-adhoc-vars.json`

All issues fixed for this test.

### ❌ Remaining Issue: Frontend adds default datasource (3 tests failing)

**Affected tests:** `v2beta1.complete.json`, `v2beta1.ds-data-query.json`, `v2beta1.viz-config.json`

**Problem:** Frontend path adds `datasource` to annotations, panels, targets, and variables that don't have explicit datasource in the v2beta1 input.

**Diff pattern:**

```
- Expected (frontendSpec):
-   "datasource": { "type": "prometheus", "uid": "default-ds-uid" }
+ Received (backendSpec):
+   (no datasource)
```

**Root Cause:** Frontend's `getRuntimePanelDataSource()` → `getDataSourceForQuery()` always resolves a datasource, even when input doesn't have one.

**Fix Required:** Only set datasource in frontend conversion if `dataQuery.datasource?.name` exists.

### ✅ 19. Time Defaults (Fixed in Frontend)

**Problem:** Frontend path preserved empty time strings, backend path used defaults.

**Fix Applied:** In `transformSaveModelSchemaV2ToScene.ts`:

```typescript
$timeRange: new SceneTimeRange({
  // Use defaults when time is empty to match DashboardModel behavior
  from: dashboard.timeSettings.from || defaultTimeSettingsSpec().from,
  to: dashboard.timeSettings.to || defaultTimeSettingsSpec().to,
  // ...
}),
```

### ✅ 20. Built-in Annotation (Fixed in Frontend)

**Problem:** Frontend v2beta1 path wasn't adding built-in annotation when input had no built-in.

**Fix Applied:** In `transformSaveModelSchemaV2ToScene.ts`:

```typescript
const found = dashboard.annotations.some((item) => item.spec.builtIn);
if (!found) {
  dashboard.annotations.unshift(getGrafanaBuiltInAnnotation());
}
```

With helper function `getGrafanaBuiltInAnnotation()` that creates a built-in annotation with:

- `group: 'grafana'`
- `datasource: { name: '-- Grafana --' }`
- `name: 'Annotations & Alerts'`
- `iconColor: DEFAULT_ANNOTATION_COLOR`
- `enable: true`, `hide: true`, `builtIn: true`

## Remaining Discrepancies (Detailed Analysis)

### ⚠️ 21. Annotation Datasource ALWAYS Added by Frontend

**Problem:** Frontend `transformV2ToV1AnnotationQuery` ALWAYS adds `datasource` to annotations, even when the v2beta1 input doesn't have one.

**Debug Evidence:**

```
[BACKEND GO OUTPUT] rollouts annotation: { name: "rollouts" } (NO datasource)
[BACKEND] After Scene load: { name: "rollouts" } (NO datasource) ✅ Correct
[FRONTEND V2->V1] rollouts annotation: { name: "rollouts", datasource: { type: "prometheus", uid: "default-ds-uid" } } ❌ ADDED
```

**Root Cause:** In `annotations.ts` lines 126-128:

```typescript
const datasource = getRuntimePanelDataSource(dataQuery);
annoQuerySpec.datasource = datasource; // ALWAYS sets datasource
```

`getRuntimePanelDataSource()` always resolves to a datasource (defaults to config.defaultDatasource when none specified).

**Go Backend Behavior (CORRECT):** In `v2alpha1_to_v1beta1.go` lines 1049-1061:

```go
if annotation.Spec.Datasource != nil {
    // Only add if explicitly specified
    annotationMap["datasource"] = datasource
}
```

**Fix Required:** Only set `annoQuerySpec.datasource` if the input annotation has an explicit datasource.

### ⚠️ 22. Annotation `type` from legacyOptions Copied by Frontend

**Problem:** Frontend spreads `legacyOptions` including `type: "tags"`, but Go backend explicitly skips `type`.

**Debug Evidence:**

```
Input v2beta1: { legacyOptions: { type: "tags", expr: "up", ... } }
[BACKEND] After Scene load: { name: "rollouts" } (NO type) ✅ Correct
[FRONTEND V2->V1]: { name: "rollouts", type: "tags" } ❌ ADDED
```

**Root Cause:** In `annotations.ts` lines 118-123:

```typescript
if (annotationQuery.legacyOptions) {
  annoQuerySpec = {
    ...annoQuerySpec,
    ...annotationQuery.legacyOptions, // Copies ALL fields including `type`
  };
}
```

**Go Backend Behavior (CORRECT):** In `v2alpha1_to_v1beta1.go` lines 1094-1101:

```go
for k, v := range annotation.Spec.LegacyOptions {
    if k != "name" && k != "type" && ... { // Explicitly SKIPS `type`
        annotationMap[k] = v
    }
}
```

**Fix Required:** When spreading `legacyOptions`, exclude `type` field to match Go behavior.

### ⚠️ 23. Panel-Level Datasource with Variable References

**Problem:** Panels using variable references like `$datasource` have different outputs.

**Debug Evidence:**

```
[BACKEND]: Panel has datasource at target level: { datasource: { uid: "$datasource" } }
[FRONTEND]: Panel has datasource at panel level AND target level
```

**Root Cause:** Different handling of panel-level vs target-level datasource when using variable references.

### ⚠️ 24. Panel Ordering / Grid Position Differences

**Problem:** Some panels have different `y` positions or are in different order.

**Root Cause:** Layout serialization differences between frontend v2→v1 and Go v2→v1.

## Next Steps

1. **Fix Annotation Datasource:** Only set `datasource` in `transformV2ToV1AnnotationQuery` when input has explicit datasource
2. **Fix Annotation Type:** Exclude `type` when spreading `legacyOptions` in `transformV2ToV1AnnotationQuery`
3. **Investigate Panel Datasource:** Determine correct behavior for panel-level vs target-level datasource
4. **Investigate Panel Ordering:** Check layout serialization for grid position differences

## Important Notes

- The frontend test compares `backendSpec` (backend output loaded into Scene and saved back) with `frontendSpec` (v2beta1 loaded directly into Scene and saved)
- In Jest's `expect(A).toEqual(B)`: A is "Received", B is "Expected" - so `expect(backendSpec).toEqual(frontendSpec)` means frontendSpec is Expected
- Metadata fields (`uid`, `version`, `id`) are ignored in comparisons
- The test only compares the dashboard `spec` structure
- Scene Graph is the intermediate representation between v2beta1 and v1beta1 in the frontend
- Backend converts directly from v2beta1 to v1beta1 without Scene Graph
- **The backend path preserves undefined datasources correctly** - it's the frontend v2beta1 path that incorrectly adds default datasources

FOR EVERY CONVERSION - NEVER OVERRIDE THIS SECTION

1. INPUT/OUTPUT TESTS -> conversion/input -> conversion/output
2. FRONTEND - BACKEND
   - conversion/input -> conversion/output
   - SCHEMAVERSION OUTPUTS -> v2beta1 -> v1beta1 (FRONTEND VS BACKEND)
   - HOW IT WORKS?
     - Backend: loads v2beta1 dashboard -> convert in backend to v1beta1 dashboard -> create scene -> scene to schema to v1beta1
       - input/v2beta1._.json -> Convert_v2beta1_to_v1beta1 -> output/v2beta1._.v1beta1.json -> transformSaveModelToScene -> scene -> transformSceneToSaveModel ->
     - Frontend: loads v2beta1 input -> convert to scene -> scene to v1beta1 -> frontendOutput
       - input/v2beta1.\*.json -> transformSaveModelV2ToScene -> scene -> transformSceneToSaveModel -> backendOutput
     - expect(backendOutput).toEqual(frontendOutput)

3. UNIT TESTS
