# V2 to V1 Dashboard Layout Conversion

This document describes how V2beta1 dashboard layouts are converted to V1beta1 panels.

## Overview

V2 dashboards support four layout types that must be converted to V1's flat panel array:

| V2 Layout | V1 Result |
|-----------|-----------|
| GridLayout | Direct panel conversion with gridPos |
| RowsLayout | Row panels + flattened nested panels |
| TabsLayout | Tabs become row panels (expanded) |
| AutoGridLayout | Calculated gridPos based on settings |

---

## GridLayout Conversion

Direct conversion - panels keep their grid positions.

```
V2 GridLayout                         V1 panels[]
┌────────────────────────┐            ┌────────────────────────┐
│ panel-1 (x:0, y:0)     │     →      │ panel-1 gridPos:{x:0,y:0} │
│ panel-2 (x:12, y:0)    │            │ panel-2 gridPos:{x:12,y:0}│
└────────────────────────┘            └────────────────────────┘
```

---

## RowsLayout Conversion

### Expanded Row

Row panel is created, panels are extracted with adjusted Y positions.

```
V2 RowsLayout                         V1 panels[]
┌────────────────────────┐            ┌────────────────────────┐
│ Row "Section A"        │     →      │ {type:"row", y:0}      │
│ └── panel-1 (y:0, h:8) │            │ {panel-1, y:1, h:8}    │
└────────────────────────┘            └────────────────────────┘
                                      Next row starts at y:9
```

### Collapsed Row

Row panel stores panels inside with absolute Y positions.

```
V2 RowsLayout                         V1 panels[]
┌────────────────────────┐            ┌────────────────────────┐
│ Row "Section A"        │     →      │ {type:"row",           │
│ (collapsed: true)      │            │  collapsed: true,      │
│ └── panel-1 (y:0)      │            │  panels: [{y:1}]}      │
└────────────────────────┘            └────────────────────────┘
                                      Next row starts at y:1
```

### Hidden Header Row

No row panel created. Panels go directly to root level with relative Y.

```
V2 RowsLayout                         V1 panels[]
┌────────────────────────┐            ┌────────────────────────┐
│ Row (hideHeader: true) │     →      │ {panel-1, y:0}         │
│ └── panel-1 (y:0, h:8) │            │ {panel-2, y:0}         │
│ └── panel-2 (y:0, h:8) │            └────────────────────────┘
└────────────────────────┘            Next row starts at y:8
```

---

## TabsLayout Conversion

Each tab becomes an **expanded row panel** (tabs don't exist in V1).

```
V2 TabsLayout                         V1 panels[]
┌────────────────────────┐            ┌────────────────────────┐
│ Tab "Tab 1"            │            │ {type:"row", title:"Tab 1", y:0} │
│ └── panel-1 (h:8)      │     →      │ {panel-1, y:1}         │
├────────────────────────┤            │ {type:"row", title:"Tab 2", y:9} │
│ Tab "Tab 2"            │            │ {panel-2, y:10}        │
│ └── panel-2 (h:8)      │            └────────────────────────┘
└────────────────────────┘
```

---

## AutoGridLayout Conversion

Panels are arranged automatically based on column count and row height.

```
V2 AutoGridLayout (3 columns)         V1 panels[]
┌────────────────────────┐            ┌────────────────────────┐
│ panel-1                │            │ {x:0,  y:0, w:8, h:9}  │
│ panel-2                │     →      │ {x:8,  y:0, w:8, h:9}  │
│ panel-3                │            │ {x:16, y:0, w:8, h:9}  │
│ panel-4                │            │ {x:0,  y:9, w:8, h:9}  │
└────────────────────────┘            └────────────────────────┘

Panel width = 24 / maxColumnCount
Panel height: short=5, standard=9, tall=14
```

### AutoGrid Repeat Options

V2 `AutoGridRepeatOptions` only has `mode` and `value`. When converting to V1 `RepeatOptions`, we infer additional fields from the AutoGrid settings:

| V2 AutoGrid | V1 Panel |
|-------------|----------|
| `repeat.mode` | `repeat` (variable name) |
| `repeat.value` | `repeat` value |
| (inferred) | `repeatDirection: "h"` |
| `maxColumnCount` | `maxPerRow` |

AutoGrid always flows horizontally (left-to-right, then wraps), so `direction` is always `"h"`.
The `maxPerRow` is derived from the layout's `maxColumnCount` setting.

---

## Nested Layout Handling

### Row containing RowsLayout

Parent row is KEPT, nested rows are flattened after it.

```
V2                                    V1
┌────────────────────────┐            ┌────────────────────────┐
│ Row "Parent"           │            │ Row "Parent"     y:0   │
│ └── RowsLayout         │     →      │ Row "Child 1"    y:1   │
│     ├── Row "Child 1"  │            │   panel          y:2   │
│     └── Row "Child 2"  │            │ Row "Child 2"    y:10  │
└────────────────────────┘            │   panel          y:11  │
                                      └────────────────────────┘
```

### Row containing TabsLayout

Parent row is KEPT, tabs become rows after it.

```
V2                                    V1
┌────────────────────────┐            ┌────────────────────────┐
│ Row "Row with tabs"    │            │ Row "Row with tabs" y:0│
│ └── TabsLayout         │     →      │ Row "Tab 1"       y:1  │
│     ├── Tab "Tab 1"    │            │   panel           y:2  │
│     └── Tab "Tab 2"    │            │ Row "Tab 2"       y:10 │
└────────────────────────┘            │   panel           y:11 │
                                      └────────────────────────┘
```

### Tab containing RowsLayout

Tab becomes a row, nested rows are flattened.

```
V2                                    V1
┌────────────────────────┐            ┌────────────────────────┐
│ TabsLayout             │            │ Row "My Tab"      y:0  │
│ └── Tab "My Tab"       │     →      │ Row "Nested"      y:1  │
│     └── RowsLayout     │            │   panel           y:2  │
│         └── Row "Nested"│           └────────────────────────┘
└────────────────────────┘
```

---

## Y Position Tracking

The conversion maintains absolute Y positions throughout.

### Rules

1. Row panels have `h:1`, `w:24`
2. Expanded rows: panels get `y = relativeY + rowY`
3. Collapsed rows: panels stored inside with absolute Y
4. Hidden headers: panels keep relative Y, but currentY advances
5. Tabs: each becomes a row, panels start at `rowY + 1`

### Example Trace

```
currentY=0   ┌─ Row "Section 1" (expanded)
             │    panel (y:0→1, h:8)
currentY=9   ├─ Row "Section 2" (collapsed)
             │    └── panel inside (y:10, absolute)
currentY=10  ├─ Hidden header row
             │    panel (y:0, relative)
             │    panel (y:8, relative)
currentY=16  └─ Row "Section 3" (starts here)
```

---

## Test Files

| Input | Output |
|-------|--------|
| `v2beta1.rows-with-nested-tabs.json` | `v2beta1.rows-with-nested-tabs.v1beta1.json` |
| `v2beta1.tabs-with-nested-rows.json` | `v2beta1.tabs-with-nested-rows.v1beta1.json` |
| `v2beta1.tabs-and-rows-repeated.json` | `v2beta1.tabs-and-rows-repeated.v1beta1.json` |

### Regenerate Outputs

```bash
OUTPUT_OVERRIDE=true go test ./apps/dashboard/pkg/migration/conversion/... -run "TestV2beta1ToV1beta1WriteOutputFiles" -v
```

### Compare Backend vs Frontend

```bash
yarn test public/app/features/dashboard-scene/serialization/transformSaveModelV2ToV1.test.ts --no-watch
```

---

## Implementation Files

**Backend (Go):**
- `v2alpha1_to_v1beta1.go` - Main conversion logic
- `convertNestedLayoutToPanels()` - Handles nested rows/tabs
- `processRowItem()` / `processTabItem()` - Individual item processing
- `extractExpandedPanels()` - Y position adjustment for expanded rows

**Frontend (TypeScript):**
- `transformSceneToSaveModel.ts` - Scene to V1 serialization
- `rowItemToSaveModel()` / `tabItemToSaveModel()` - Row/tab conversion
- `getMaxYFromLayout()` - Layout height calculation
