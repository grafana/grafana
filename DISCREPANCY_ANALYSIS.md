# Dashboard Conversion Discrepancy Analysis (Updated)

## Test Results Summary

**Test Date:** November 25, 2025  
**Failed Tests:** 4 out of 4  
**Test File:** `public/app/features/dashboard-scene/serialization/transformSaveModelV2ToV1.test.ts`

The test compares:

- **Backend path (Expected):** v2beta1 → Go conversion → v1beta1 → Scene → v1beta1
- **Frontend path (Received):** v2beta1 → Scene → v1beta1

---

## PR Changes Analysis and Challenges

### Change 1: `DashboardModel.ts` - Built-in Annotation Logic

**File:** `public/app/features/dashboard/state/DashboardModel.ts`

**Change Made:**

```typescript
// Only add built-in annotation if the original input didn't have one
const hasBuiltInInInput = data.annotations?.list?.some((item) => Boolean(item.builtIn));
if (!hasBuiltInInInput) {
  this.addBuiltInAnnotationQuery();
}
```

**CHALLENGE: This logic is INVERTED!**

The comment says "Only add built-in annotation if the original input didn't have one" but the code does the OPPOSITE:

- `hasBuiltInInInput = false` when input has NO built-in annotation
- `!hasBuiltInInInput = true` → adds built-in annotation
- **Result:** It ADDS built-in annotation when input doesn't have one

**Evidence from test:**

- `v2beta1.groupby-adhoc-vars.json` has `"annotations": []` (empty)
- Backend output: `annotations.list: []` (empty - correct)
- Frontend output: Adds built-in annotation (wrong!)

**Correct Fix Should Be:**

```typescript
// DON'T add built-in annotation if the input explicitly defined annotations (even if empty)
// Only add if annotations was completely undefined (legacy behavior)
if (data.annotations === undefined) {
  this.addBuiltInAnnotationQuery();
}
```

Or simply remove the automatic addition entirely to preserve input fidelity.

---

### Change 2: `dataLayersToAnnotations.ts` - Datasource Filtering

**File:** `public/app/features/dashboard-scene/serialization/dataLayersToAnnotations.ts`

**Change Made:**

```typescript
const { datasource, ...query } = layer.state.query || {};
// Only include datasource if it is present and non-empty
if (datasource && Object.keys(datasource).length > 0 && (datasource.uid || datasource.type)) {
  result.datasource = datasource;
}
```

**CHALLENGE: Incomplete fix - doesn't address `builtIn: false`**

The test still shows `builtIn: false` being added to non-built-in annotations:

- Backend output: No `builtIn` field for non-built-in annotations
- Frontend output: `builtIn: false` added

The change only filters datasource but doesn't filter `builtIn: false`.

**Missing Fix:**

```typescript
const { datasource, builtIn, ...query } = layer.state.query || {};

const result: AnnotationQuery = {
  ...query,
  enable: Boolean(layer.state.isEnabled),
  hide: Boolean(layer.state.isHidden),
  placement: layer.state.placement,
};

// Only include builtIn if it's truthy (1 or true)
if (builtIn) {
  result.builtIn = builtIn;
}

// Only include datasource if it is present and non-empty
if (datasource && Object.keys(datasource).length > 0 && (datasource.uid || datasource.type)) {
  result.datasource = datasource;
}
```

---

### Change 3: `annotations.ts` - v1→v2 builtIn Conversion

**File:** `public/app/features/dashboard-scene/serialization/annotations.ts`

**Change Made:**

```typescript
// Old: builtIn: Boolean(annotation.builtIn),
// New: ...(annotation.builtIn === 1 || (annotation.builtIn !== undefined && Boolean(annotation.builtIn)) ? { builtIn: true } : {})
```

**CHALLENGE: Fixing wrong direction**

This change affects `transformV1ToV2AnnotationQuery` (v1 → v2), but the test issue is in v2 → v1 conversion where `builtIn: false` is being added to the output.

**Status:** May be correct for v1→v2 direction, but doesn't address the test failures.

---

### Change 4: `transformSaveModelSchemaV2ToScene.ts` - Removed Built-in Addition

**File:** `public/app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene.ts`

**Change Made:**

```typescript
// Removed:
// const grafanaBuiltAnnotation = getGrafanaBuiltInAnnotationDataLayer(dashboard);
// if (grafanaBuiltAnnotation) {
//   dashboard.annotations.unshift(grafanaBuiltAnnotation);
// }
```

**Status:** This change is CORRECT for the v2beta1 → Scene path.

**BUT:** The issue persists because of the test flow:

1. Backend v1beta1 is loaded into Scene via `transformSaveModelToScene`
2. This creates a `DashboardModel` which then adds built-in annotation (due to Change 1 bug)

---

### Change 5: `transformSceneToSaveModel.ts` - Optional Fields

**File:** `public/app/features/dashboard-scene/serialization/transformSceneToSaveModel.ts`

**Change Made:**

```typescript
// Only add optional fields if they are explicitly set (not default values)
if (state.editable !== undefined) {
  dashboard.editable = state.editable;
}
if (timeRange.timeZone !== undefined && timeRange.timeZone !== '') {
  dashboard.timezone = timeRange.timeZone;
}
```

**Status:** This change appears CORRECT - only add fields when explicitly set.

---

### Change 6: `sceneVariablesSetToVariables.ts` - Constant Variable Type

**File:** `public/app/features/dashboard-scene/serialization/sceneVariablesSetToVariables.ts`

**Change Made:**

```typescript
// Line 147
type: 'constant', // Explicitly set type to constant
```

**CHALLENGE: Not working - frontend still outputs `type: "textbox"`**

Test shows:

- Backend: `type: "constant"`, `hide: 2`
- Frontend: `type: "textbox"`, no `hide`

The issue is that `sceneUtils.isConstantVariable()` may not be correctly identifying the variable, or the variable isn't being created as a `ConstantVariable` when loading from v2beta1.

**Investigation Needed:** Check if `ConstantVariable` is being correctly instantiated in `transformSaveModelSchemaV2ToScene.ts`.

---

## Remaining Issues Not Addressed by PR

### 1. `builtIn` Type Mismatch (boolean vs integer)

**Discrepancy:**

- Backend (after Scene): `builtIn: 1` (integer)
- Frontend (direct v2beta1): `builtIn: true` (boolean)

**Root Cause:** Backend v2alpha1→v1beta1 Go conversion outputs `builtIn: true` (boolean). When loaded into Scene, it's preserved as boolean. When frontend creates from v2beta1, `transformV2ToV1AnnotationQuery` converts to integer 1.

**Fix Needed (Backend Go):** Convert to integer:

```go
if annotation.Spec.BuiltIn != nil && *annotation.Spec.BuiltIn {
    annotationMap["builtIn"] = 1  // Use integer 1 instead of boolean
}
```

---

### 2. Missing `type: "dashboard"` for Built-in Annotations

**Discrepancy:**

- Backend: No `type: "dashboard"` field
- Frontend: Has `type: "dashboard"`

**Fix Needed (Backend Go):**

```go
if annotation.Spec.BuiltIn != nil && *annotation.Spec.BuiltIn {
    annotationMap["builtIn"] = 1
    annotationMap["type"] = "dashboard"  // Add this
}
```

---

### 3. `graphTooltip` Value Mismatch

**Discrepancy:**

- Backend (after Scene): `graphTooltip: 2` (Tooltip)
- Frontend (direct v2beta1): `graphTooltip: 0` (Off)

**Root Cause:** The v2beta1 input has `cursorSync: "Tooltip"` which should map to `graphTooltip: 2`. The frontend conversion is not correctly parsing this.

**Investigation Needed:** Debug `transformCursorSyncV2ToV1` and `transformCursorSynctoEnum` functions.

---

### 4. Panels Empty in Backend but Rendered in Frontend

**Discrepancy:**

- Backend: `panels: []`
- Frontend: Full panel array

**Root Cause:** Backend v2beta1→v1beta1 conversion is not converting panels from elements/layout.

**Note:** This appears to be a backend bug where `convertPanelsFromElementsAndLayout` is returning empty array.

---

### 5. Default Datasource Added to Variables/Annotations

**Discrepancy:**

- Backend: Adds default datasource `{ type: "prometheus", uid: "default-ds-uid" }`
- Frontend: No datasource

**Fix Needed:** Backend should not add default datasource when input doesn't specify one.

---

### 6. Time Range Defaults

**Discrepancy:**

- Backend: `from: ""`, `to: ""`
- Frontend: `from: "now-6h"`, `to: "now"`

**Root Cause:** `SceneTimeRange` converts empty strings to defaults.

---

### 7. `allowCustomValue: false` Not Preserved for Adhoc Variables

**Discrepancy:**

- Backend: `allowCustomValue: false`
- Frontend: No `allowCustomValue` field

**PR Change Status:** Change was made to `transformSaveModelSchemaV2ToScene.ts` to set `allowCustomValue` when false, but it's still not appearing in output.

---

## Summary of PR Issues

| Change | File                                 | Status          | Issue                                               |
| ------ | ------------------------------------ | --------------- | --------------------------------------------------- |
| 1      | DashboardModel.ts                    | **WRONG**       | Logic is inverted - adds built-in when it shouldn't |
| 2      | dataLayersToAnnotations.ts           | **INCOMPLETE**  | Doesn't filter `builtIn: false`                     |
| 3      | annotations.ts                       | OK              | Correct for v1→v2, but doesn't fix test issues      |
| 4      | transformSaveModelSchemaV2ToScene.ts | **OK**          | Correct removal of built-in addition                |
| 5      | transformSceneToSaveModel.ts         | **OK**          | Correct optional field handling                     |
| 6      | sceneVariablesSetToVariables.ts      | **NOT WORKING** | Constant variable still outputs as textbox          |

---

## Recommended Fixes

### Priority 1: Fix Inverted Logic (DashboardModel.ts)

```typescript
// Change from:
const hasBuiltInInInput = data.annotations?.list?.some((item) => Boolean(item.builtIn));
if (!hasBuiltInInInput) {
  this.addBuiltInAnnotationQuery();
}

// To:
// Only add built-in if annotations is undefined (not when it's an empty array)
if (data.annotations === undefined) {
  this.addBuiltInAnnotationQuery();
}
```

### Priority 2: Filter `builtIn: false` (dataLayersToAnnotations.ts)

```typescript
const { datasource, builtIn, ...query } = layer.state.query || {};

const result: AnnotationQuery = {
  ...query,
  enable: Boolean(layer.state.isEnabled),
  hide: Boolean(layer.state.isHidden),
  placement: layer.state.placement,
};

// Only include builtIn if truthy
if (builtIn) {
  result.builtIn = builtIn;
}
```

### Priority 3: Fix Backend builtIn Type (v2alpha1_to_v1beta1.go)

```go
if annotation.Spec.BuiltIn != nil && *annotation.Spec.BuiltIn {
    annotationMap["builtIn"] = 1  // integer, not boolean
    annotationMap["type"] = "dashboard"
}
```

### Priority 4: Investigate Constant Variable Type Issue

Debug why `ConstantVariable` is being serialized as `textbox` despite the fix in `sceneVariablesSetToVariables.ts`.

---

## Test Flow Understanding

```
Backend Path (Expected):
  v2beta1 input
  → Go conversion (v2beta1→v1beta1)
  → v1beta1 JSON
  → transformSaveModelToScene (creates DashboardModel)
  → Scene Graph
  → transformSceneToSaveModel
  → v1beta1 output

Frontend Path (Received):
  v2beta1 input
  → transformSaveModelSchemaV2ToScene (NO DashboardModel)
  → Scene Graph
  → transformSceneToSaveModel
  → v1beta1 output
```

The key difference is that the Backend path goes through `DashboardModel` which has the inverted built-in annotation logic.
