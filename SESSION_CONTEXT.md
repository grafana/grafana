# Session Context - V2 to V1 Dashboard Conversion

## Summary

This session focused on implementing and fixing the V2beta1 to V1beta1 dashboard conversion, ensuring both backend (Go) and frontend (TypeScript) produce consistent output. The main work involved handling nested layouts (TabsLayout, RowsLayout, AutoGridLayout) and flattening them correctly to the V1 panel structure.

---

## Work Completed

### Backend (Go) - `apps/dashboard/pkg/migration/conversion/v2alpha1_to_v1beta1.go`

#### 1. Unified Layout Conversion Architecture

Created a new unified architecture to handle arbitrary nesting of layouts:

- **`convertNestedLayoutToPanels`** - Unified function that handles both RowsLayout and TabsLayout with arbitrary nesting depth

- **`processRowItem`** - Processes a single row, handling:
  - Nested RowsLayout (flattened to root)
  - Nested TabsLayout (parent row KEPT, then tabs processed)
  - Hidden header rows (no row panel created)
  - Collapsed rows (panels stored inside row panel)

- **`processTabItem`** - Processes a single tab, converting tabs to row panels

#### 2. AutoGridLayout Support

Added AutoGridLayout handling to all conversion paths

#### 3. Test Files Added

- `testdata/input/v2beta1.rows-with-nested-tabs.json`
- `testdata/input/v2beta1.tabs-with-nested-rows.json`
- Corresponding output files generated

#### 4. Documentation

- Created `v2_to_v1.md` with comprehensive layout conversion documentation

---

### Frontend (TypeScript) - `transformSceneToSaveModel.ts`

#### 1. Added TabsLayoutManager Support

- Root level: `TabsLayoutManager` → row panels
- Inside rows: `TabsLayoutManager` → parent row kept, tabs flattened
- `tabItemToSaveModel` function added

#### 2. Added AutoGridLayoutManager Support

- `autoGridLayoutToPanels` function added
- Calculates panel dimensions from AutoGrid settings
- Handles nested AutoGrid in rows and tabs

#### 3. Updated Functions

- `rowItemToSaveModel` - Now handles TabsLayoutManager and AutoGridLayoutManager
- `flattenRowItemToPanels` - Added TabsLayoutManager and AutoGridLayoutManager support
- `flattenTabItemToPanels` - Added AutoGridLayoutManager support
- `getMaxYFromLayout` - Added TabsLayoutManager and AutoGridLayoutManager support

---

## Work Pending

### Frontend Consistency Issues

The comparison tests in `transformSaveModelV2ToV1.test.ts` fail for:

- `v2beta1.rows-with-nested-tabs.json`
- `v2beta1.tabs-with-nested-rows.json`

**Root cause:** The frontend transformation path is:

1. V2beta1 → Scene (via `transformSaveModelSchemaV2ToScene`)
2. Scene → V1beta1 (via `transformSceneToSaveModel`)

The issue is that the Scene structure created from V2 may not match what the backend produces. This requires investigation into:

- `transformSaveModelSchemaV2ToScene.ts` - How V2 layouts are loaded into Scene
- Particularly how nested TabsLayout and RowsLayout are handled

### Potential Solutions

1. **Update V2→Scene transformation** to create Scene structures that match backend output
2. **Add missing layout handling** in `transformSaveModelSchemaV2ToScene.ts`

---

## Key Conversion Rules

### Row containing TabsLayout

- Parent row IS KEPT (not skipped)
- Tabs are processed after parent row
- All content flattened to root level

### Row containing RowsLayout

- Parent row IS SKIPPED
- Nested rows are flattened to root level

### Tab → Row Conversion

- Each tab becomes a row panel with:
  - `type: "row"`
  - `collapsed: false`
  - `panels: []` (empty, panels extracted to root level)
  - `title: tab.spec.title`

---

## Commands Reference

### Regenerate Backend Output Files

```bash
cd /Users/ivanortegaalba/repos/grafana
OUTPUT_OVERRIDE=true go test ./apps/dashboard/pkg/migration/conversion/... -run "TestV2beta1ToV1beta1WriteOutputFiles" -v
```

### Run Backend Tests

```bash
go test ./apps/dashboard/pkg/migration/conversion/... -v
```

### Run Frontend Tests

```bash
# Base serialization tests (passes)
yarn test public/app/features/dashboard-scene/serialization/transformSceneToSaveModel.test.ts --no-watch

# V2 to V1 comparison tests (2 failing for new files)
yarn test public/app/features/dashboard-scene/serialization/transformSaveModelV2ToV1.test.ts --no-watch
```

---

## Files Modified in This Session

### Backend

- `apps/dashboard/pkg/migration/conversion/v2alpha1_to_v1beta1.go` - Major refactor for nested layouts
- `apps/dashboard/pkg/migration/conversion/v2_to_v1.md` - Documentation created
- `testdata/input/v2beta1.rows-with-nested-tabs.json` - New test
- `testdata/input/v2beta1.tabs-with-nested-rows.json` - New test
- `testdata/output/*.v1beta1.json` - Generated outputs

### Frontend

- `public/app/features/dashboard-scene/serialization/transformSceneToSaveModel.ts` - Added TabsLayoutManager and AutoGridLayoutManager support
