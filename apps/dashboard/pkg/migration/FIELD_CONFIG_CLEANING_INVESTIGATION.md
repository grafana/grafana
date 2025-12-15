# Field Config Cleaning Investigation

## Summary

This document summarizes the investigation into why frontend parity tests fail when comparing Go backend and TypeScript frontend dashboard conversions from v1 to v2 format.

## Problem Statement

When running parity tests that compare backend (Go) and frontend (TypeScript) dashboard conversions, 26 tests fail due to discrepancies in `fieldConfig.defaults` properties like:

- `fieldMinMax`
- `nullValueMode`
- `unitScale`
- `actions`
- `description: ""`
- `filter` (in transforms)

The backend output does NOT include these properties, while the frontend output DOES include them.

## Root Cause

The discrepancy occurs because **properties are cleaned at different stages** in each path, and **tests don't trigger the frontend cleaning step**.

---

## Detailed Analysis

### Go Backend Path (v1 → v2)

**Location:** `apps/dashboard/pkg/migration/conversion/v1beta1_to_v2alpha1.go`

**Function:** `extractFieldConfigDefaults()` (lines 2312-2404)

The Go code **explicitly extracts only known properties** into the v2 schema:

```go
// Extracted fields:
- color
- custom
- decimals, max, min
- description, displayName, displayNameFromDS, noValue, path, unit
- filterable, writeable
- links
- mappings
- thresholds
```

**Properties NOT in this list are dropped.** This includes `fieldMinMax`, `nullValueMode`, `unitScale`, etc.

**Result:** v2 output from Go does NOT contain unregistered properties.

---

### Frontend Path (v1 → Scene → v2)

**Flow in Production:**

1. **v1 input** → `PanelModel.restoreModel()` → copies ALL properties (including `fieldMinMax`)
2. **VizPanel created** → receives ALL fieldConfig properties unchanged
3. **VizPanel activated** → `_onActivate()` → `_loadPlugin()` → `getPanelOptionsWithDefaults()`
4. **`cleanProperties()` runs** → removes properties not in plugin's `fieldConfigRegistry`
5. **Scene to v2** → `handleFieldConfigDefaultsConversion()` → outputs cleaned data

**Flow in Tests:**

1. **v1 input** → `PanelModel.restoreModel()` → copies ALL properties
2. **VizPanel created** → receives ALL fieldConfig properties
3. **VizPanel is NEVER activated** → plugin never loads → `cleanProperties()` never runs
4. **Scene to v2** → outputs data WITH uncleaned properties

---

## Key Code Locations

### Go Cleaning (Explicit Extraction)

```
apps/dashboard/pkg/migration/conversion/v1beta1_to_v2alpha1.go
├── extractFieldConfigDefaults() - lines 2312-2404
│   └── Only extracts specific known fields
└── extractFieldConfigSource() - lines 2248-2264
```

### Frontend Cleaning (Registry-Based)

```
packages/grafana-data/src/panel/getPanelOptionsWithDefaults.ts
├── getPanelOptionsWithDefaults() - lines 34-51
│   └── Calls applyFieldConfigDefaults()
├── applyFieldConfigDefaults() - lines 53-92
│   └── Calls cleanProperties() at line 71
└── cleanProperties() - lines 112-139
    └── Removes properties not in fieldConfigRegistry
```

### VizPanel Plugin Loading

```
packages/scenes/src/components/VizPanel/VizPanel.tsx (in scenes repo)
├── _onActivate() - line 143-147
│   └── Calls _loadPlugin()
├── _loadPlugin() - lines 154-285
│   └── Calls getPanelOptionsWithDefaults() at line 270
└── Result: fieldConfig is cleaned when plugin loads
```

### Test File (No Activation)

```
public/app/features/dashboard-scene/serialization/transformSaveModelV1ToV2.test.ts
├── Creates scene via transformSaveModelToScene()
├── Converts scene via transformSceneToSaveModelSchemaV2()
└── VizPanel is NEVER activated → cleaning doesn't run
```

---

## Visual Flow Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                    GO BACKEND PATH                               │
├─────────────────────────────────────────────────────────────────┤
│  v1 input (fieldMinMax: true)                                   │
│       ↓                                                          │
│  extractFieldConfigDefaults() - ONLY extracts known fields      │
│       ↓                                                          │
│  v2 output (NO fieldMinMax) ✓ CLEANED                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND PATH (PRODUCTION)                      │
├─────────────────────────────────────────────────────────────────┤
│  v1 input (fieldMinMax: true)                                   │
│       ↓                                                          │
│  PanelModel.restoreModel() - copies ALL properties              │
│       ↓                                                          │
│  VizPanel created (fieldMinMax: true)                           │
│       ↓                                                          │
│  VizPanel ACTIVATED → _loadPlugin() → getPanelOptionsWithDefaults│
│       ↓                                                          │
│  cleanProperties() - removes unregistered properties            │
│       ↓                                                          │
│  VizPanel state (NO fieldMinMax) ✓ CLEANED                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND PATH (TESTS)                         │
├─────────────────────────────────────────────────────────────────┤
│  v1 input (fieldMinMax: true)                                   │
│       ↓                                                          │
│  PanelModel.restoreModel() - copies ALL properties              │
│       ↓                                                          │
│  VizPanel created (fieldMinMax: true)                           │
│       ↓                                                          │
│  VizPanel NEVER ACTIVATED ❌ No plugin load, no cleaning        │
│       ↓                                                          │
│  Scene to v2 (fieldMinMax: true) ✗ NOT CLEANED                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary Table

| Path | Properties Cleaned | When | How |
|------|-------------------|------|-----|
| **Go backend** | YES | During v1→v2 conversion | Explicit field extraction |
| **Frontend (production)** | YES | When plugin loads (on activation) | `cleanProperties()` with registry |
| **Frontend (tests)** | **NO** | Never | Plugin never loads |

---

## Potential Solutions

### Option 1: Activate VizPanels in Tests

Call `VizPanel.activate()` in tests to trigger plugin loading and `cleanProperties()`.

**Pros:** Most accurate simulation of production behavior
**Cons:** Requires loading real plugins in tests, may be slow or complex

### Option 2: Call `getPanelOptionsWithDefaults` Manually in Tests

After creating the scene, manually call `getPanelOptionsWithDefaults` for each panel.

**Pros:** Simulates cleaning without full activation
**Cons:** Requires access to plugin registries in test environment

### Option 3: Normalize Frontend Output in Tests

Before comparison, strip unregistered properties from the frontend output.

**Pros:** Quick to implement, no plugin loading required
**Cons:** May mask actual bugs if the list of stripped properties is wrong

### Option 4: Document as Known Difference

Accept that tests don't fully simulate production and document the expected differences.

**Pros:** No code changes required
**Cons:** Reduces test accuracy

---

## Recommendation

**Option 3 (Normalize Frontend Output)** is recommended as the pragmatic solution:

1. Create a function that strips known unregistered properties from frontend output
2. Document which properties are handled by plugin migrations (not backend conversion)
3. Apply normalization before comparison in tests

This acknowledges that:
- Go backend does explicit extraction (by design)
- Frontend cleaning happens at runtime (by design)
- Tests can't fully simulate runtime behavior without significant complexity

---

## Related Files

- `apps/dashboard/pkg/migration/conversion/v1beta1_to_v2alpha1.go` - Go v1→v2 conversion
- `packages/grafana-data/src/panel/getPanelOptionsWithDefaults.ts` - Frontend cleaning logic
- `public/app/features/dashboard-scene/serialization/transformSaveModelV1ToV2.test.ts` - Parity tests
- `packages/scenes/src/components/VizPanel/VizPanel.tsx` - VizPanel plugin loading

---

## Date

Investigation completed: December 2024

