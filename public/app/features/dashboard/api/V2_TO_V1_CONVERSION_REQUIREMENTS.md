# V2 → V1 Dashboard Conversion Requirements

This document outlines the requirements for converting dashboard structures from Schema V2 to Schema V1 format.

## Overview

The conversion process transforms V2 dashboard layouts (which support nested structures) into a flat V1 panel array while preserving visual layout, panel properties, and structural relationships.

## Layout Type Conversions

### GridLayout

- **V2**: `GridLayout` with items containing elements
- **V1**: Direct conversion to flat panel array
- **Behavior**: Panels are added directly to the result array with their grid positions

### RowsLayout

- **V2**: `RowsLayout` with nested rows
- **V1**: Each row converts to a `RowPanel` (`type: 'row'`)
- **Behavior**:
  - Rows are flattened to the top level
  - Nested rows are extracted and added to the result array
  - Row order is preserved

### TabsLayout

- **V2**: `TabsLayout` with tabs containing layouts
- **V1**: Each tab converts to a `RowPanel` (`type: 'row'`)
- **Behavior**:
  - Tabs are converted to expanded row panels at the top level
  - Panels inside tabs are extracted to the top level (same as expanded rows)
  - Tab row's `panels` array is empty (`[]`)
  - Tab order is preserved

### AutoGridLayout

- **V2**: `AutoGridLayout` with items, `maxColumnCount`, and `rowHeightMode`/`rowHeight`
- **V1**: Panels with calculated sizes based on rowHeight
- **Behavior**:
  - Panel width: `Math.floor(24 / maxColumnCount)` (default: 8 for maxColumnCount=3)
  - Panel height: Converted from `rowHeightMode`/`rowHeight` to grid units
    - `short`: 168px → 5 grid units
    - `standard`: 320px → 9 grid units (default)
    - `tall`: 512px → 14 grid units
    - `custom`: Uses `rowHeight` value in pixels, converted to grid units using `Math.ceil(height / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN))`
  - Panels are arranged in a grid pattern

## Special Cases

### Hidden Header Row (First Row Only)

**Condition**: Only the **first row** with:

- `hideHeader: true`
- Empty title (`title === ''` or `title` is undefined/null)

**Behavior**:

- Do NOT create a `RowPanel` for this row
- Extract panels directly to the top level
- Use absolute Y positions (not relative to a row)
- Panels represent V1 panels that existed outside of any row

**Note**: If a row with `hideHeader: true` is NOT the first row, it should be treated as a regular row panel.

### Collapsed vs Expanded Rows

#### Collapsed Rows (`collapsed: true`)

- Panels are stored in `row.panels` array
- Panels are NOT at the top level
- Row panel has `collapsed: true`

#### Expanded Rows (`collapsed: false`)

- Panels are at the top level of the dashboard panels array
- `row.panels` array is empty (`[]`)
- Panels are positioned after the row in the array
- Panels use absolute Y positions

### Tabs Nested Inside Rows

When tabs are nested inside a row:

- Tab rows are added to `nestedRows` and appear at the top level
- Tab rows are expanded rows, so panels are extracted to the top level
- Tab row's `panels` array is empty (`[]`)
- Tabs are treated the same as expanded rows

## Panel Positioning

### Y Position Calculation

Panels inside rows must use **absolute Y positions** in V1 (not relative to the row).

**Formula**: `absoluteY = rowY + GRID_ROW_HEIGHT + relativeY`

Where:

- `rowY`: The row's Y position in the dashboard
- `GRID_ROW_HEIGHT`: 1 (row header height)
- `relativeY`: The panel's Y position relative to the row in V2

### Grid Position Properties

All panels must have valid `gridPos` with:

- `x`: X position (0-23)
- `y`: Absolute Y position in the dashboard
- `w`: Width (1-24)
- `h`: Height (minimum 1)

## Datasource Conversion

### V2 to V1 Datasource Structure

In V2beta1, datasource information is stored per-query:

- Datasource UID: `q.spec.query.datasource?.name`
- Datasource type: `q.spec.query.group`

In V1, datasources follow a hierarchical model:

- Panel-level datasource: `panel.datasource` (optional)
- Query-level datasource: `target.datasource` (optional, only if different from panel)

**Note**: V1 `DataSourceRef` only includes `uid` and `type` fields. The `apiVersion` field (used in v2) is not part of the v1 schema and should not be included in converted datasource references.

### Conversion Rules

#### 1. Extract Datasources from Queries

For each query in the panel:

- Extract UID from `q.spec.query.datasource?.name`
- Extract type from `q.spec.query.group`

#### 2. Determine Panel-Level Datasource

**No queries (empty queries array):**

- Do NOT set `panel.datasource` (panels without queries, like text panels, don't need a datasource)
- Panel will have no `datasource` field

**All queries share the same datasource:**

- Set `panel.datasource` to the shared datasource
- Do NOT include `datasource` on individual queries (they inherit from panel)

**Queries have different datasources:**

- Set `panel.datasource` to `{ uid: '-- Mixed --' }`
- Include `datasource` on each query with its specific datasource

**Queries exist but have no datasource:**

- Use default datasource (typically Grafana default datasource)
- Queries inherit from panel (no individual datasource)

**Comparison Logic:**

- Compare datasources by UID first (primary identifier)
- If UID is missing, compare by type
- Empty string or undefined values are treated as "no datasource"

#### 3. Build Query Targets

For each query:

- If panel datasource is `"-- Mixed --"`: Always include query datasource
- If query datasource differs from panel datasource: Include query datasource
- If query datasource matches panel datasource: Omit query datasource (inherit from panel)

### Examples

#### Example 1: All Queries Share Same Datasource

**V2:**

```typescript
queries: [
  { query: { group: 'prometheus', datasource: { name: 'prom-uid' } } },
  { query: { group: 'prometheus', datasource: { name: 'prom-uid' } } },
];
```

**V1:**

```typescript
{
  datasource: { uid: 'prom-uid', type: 'prometheus' },
  targets: [
    { refId: 'A', expr: '...' },  // No datasource (inherits from panel)
    { refId: 'B', expr: '...' }   // No datasource (inherits from panel)
  ]
}
```

#### Example 2: Mixed Datasources

**V2:**

```typescript
queries: [
  { query: { group: 'prometheus', datasource: { name: 'prom-uid' } } },
  { query: { group: 'loki', datasource: { name: 'loki-uid' } } },
];
```

**V1:**

```typescript
{
  datasource: { uid: '-- Mixed --' },
  targets: [
    { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' }, expr: '...' },
    { refId: 'B', datasource: { uid: 'loki-uid', type: 'loki' }, expr: '...' }
  ]
}
```

#### Example 3: Query Override

**V2:**

```typescript
queries: [
  { query: { group: 'prometheus', datasource: { name: 'prom-uid' } } },
  { query: { group: 'prometheus', datasource: { name: 'prom-uid' } } },
  { query: { group: 'loki', datasource: { name: 'loki-uid' } } },
];
```

**V1:**

```typescript
{
  datasource: { uid: '-- Mixed --' },
  targets: [
    { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' }, expr: '...' },
    { refId: 'B', datasource: { uid: 'prom-uid', type: 'prometheus' }, expr: '...' },
    { refId: 'C', datasource: { uid: 'loki-uid', type: 'loki' }, expr: '...' }
  ]
}
```

#### Example 4: Panel with No Queries

**V2:**

```typescript
queries: [],  // Empty queries array (e.g., text panel)
```

**V1:**

```typescript
{
  // No datasource field (panels without queries don't need datasource)
  targets: [];
}
```

### Round-Trip Preservation

The conversion must ensure that:

- V1 → V2 → V1 roundtrip preserves datasource structure exactly
- Panel datasource is correctly reconstructed from query datasources
- Query datasources are only included when they differ from panel datasource
- Mixed datasource panels are correctly identified and converted

### Edge Cases

**Query with only type (no UID):**

- If `q.spec.query.group` has a value but `q.spec.query.datasource?.name` is missing
- Use type as panel datasource type
- Query should not have individual datasource if it matches panel

**Query with only UID (no type):**

- If `q.spec.query.datasource?.name` has a value but `q.spec.query.group` is empty
- UID is primary identifier, type can be empty
- Still compare by UID for uniqueness

**Empty datasource:**

- If both UID and type are missing/empty (but queries exist)
- Use default datasource for panel
- Queries inherit from panel (no individual datasource)

**No queries (empty queries array):**

- Panels with no queries (e.g., text panels, stat panels without data queries)
- Do NOT set `panel.datasource` field
- Panel will have no datasource property

## Panel Order and Structure Preservation

### Order Preservation

- Panel order must be preserved exactly (no sorting or normalization)
- Structure must match the original V1 dashboard after round-trip conversion
- Compare panels index-by-index to verify order
- Panels that follow other panels must have a Y position equal to or greater than the previous panel's Y position

### Nested Structure Flattening

- All nested layouts are flattened to a single, ordered list
- Nested rows are extracted to the top level
- Order is maintained: parent row appears before its nested content

## Row Panel ID Assignment

- Row panels initially get `id: -1` during conversion
- After flattening, assign unique IDs by incrementing from the maximum existing panel ID
- Regular panels keep their original IDs

## Conversion Flow

### High-Level Process

1. **Flatten Layout**: Recursively process all layout types and flatten to a single array
2. **Convert Layout Types**: Handle each layout kind appropriately (Grid, Rows, Tabs, AutoGrid)
3. **Handle Special Cases**:
   - Check for hidden header row (first row only)
   - Handle collapsed vs expanded rows
   - Preserve tab structure
4. **Adjust Positions**: Convert relative Y positions to absolute
5. **Assign IDs**: Ensure all row panels have unique IDs

### Function Responsibilities

- `getPanelsV1()`: Main entry point, orchestrates the conversion
- `flattenLayoutToV1Panels()`: Recursively processes layouts and flattens nested structures, delegates to layout-specific handlers
- `convertGridLayoutToV1Panels()`: Handles `GridLayout` conversion to flat panel array
- `flattenRowsLayoutToV1Panels()`: Handles `RowsLayout` conversion, including hidden header rows and collapsed/expanded state
- `flattenTabsLayoutToV1Panels()`: Handles `TabsLayout` conversion to row panels
- `convertAutoGridLayoutToV1Panels()`: Handles `AutoGridLayout` conversion with calculated panel sizes
- `convertRowsLayoutRowToV1()`: Converts a single row, handles collapsed/expanded state
- `convertTabToV1()`: Converts a tab to a row panel, preserves tab structure
- `transformV2PanelToV1Panel()`: Converts individual panel elements, including:
  - Extracting datasources from queries (`q.spec.query.datasource?.name` and `q.spec.query.group`)
  - Reconstructing panel-level datasource from query datasources
  - Determining when to use mixed datasource (`"-- Mixed --"`)
  - Handling panels with no queries (no datasource field)
  - Building query targets with appropriate datasource inheritance
  - Returning only `uid` and `type` for datasource (no `apiVersion`, which is not part of v1 schema)

## Edge Cases

### Nested Rows

- Rows can be nested inside other rows
- All nested rows are flattened to the top level
- Order is preserved: parent row → nested rows → panels

### Tabs Inside Rows

- Tabs can be nested inside rows
- Tab rows appear at the top level
- Panels inside tabs remain in tab row's `panels` array

### Multiple Layout Types

- V2 supports mixing layout types (e.g., GridLayout inside RowsLayout)
- All layouts are recursively processed and flattened

### Empty Layouts

- Empty layouts should result in empty panel arrays
- Rows with no panels should still be created as row panels

## Round-Trip Conversion

### Requirements

- V1 → V2 → V1 conversion must be idempotent
- Structure and order must be preserved exactly
- No normalization or sorting should be applied
- Panel properties must match exactly (except for IDs which may be reassigned)
- **Datasources must be preserved correctly**: Panel datasource and query datasources must match the original V1 structure after round-trip

### Verification

- Compare dashboard structures directly (no normalization)
- Verify panel order index-by-index
- Check that collapsed/expanded state is preserved
- Ensure panels are in correct locations (row.panels vs top level)
- **Verify datasource structure**: Panel datasource should match original, queries should only have datasource when they differ from panel

## Testing Requirements

### Test Cases

1. **Nested Rows**: Verify nested rows are flattened correctly
2. **Tabs**: Verify tabs convert to row panels with panels preserved
3. **AutoGrid**: Verify default panel sizes are applied
4. **Hidden Header Row**: Verify first row special case is handled
5. **Collapsed Rows**: Verify panels are in `row.panels` array
6. **Expanded Rows**: Verify panels are at top level, `row.panels` is empty
7. **Tabs in Rows**: Verify panels inside tabs are preserved
8. **Round-Trip**: Verify V1 → V2 → V1 preserves structure exactly
9. **Datasource Conversion**:
   - No queries (empty array) → no panel datasource field
   - All queries share same datasource → panel datasource set, queries inherit
   - Queries have different datasources → panel datasource is `"-- Mixed --"`, queries have individual datasources
   - Queries with no datasource → default datasource used
   - Query with only type (no UID) → handled correctly
   - Round-trip datasource preservation → V1 → V2 → V1 preserves datasource structure

### Manual Testing

1. Enable dynamic dashboard feature toggle:

   ```ini
   [feature_toggles]
   dashboardNewLayouts = true
   ```

2. Create/load a V2 dashboard with various layouts
3. Set the dashboardNewLayouts feature toggle to false, either by editing custom.ini or setting it in local storage.
4. Verify conversion in JSON Model (Edit → Settings → JSON Model)
5. Check that all panels are present and correctly positioned

## Implementation Notes

### Key Constants

- `GRID_COLUMN_COUNT`: 24
- `GRID_ROW_HEIGHT`: 1

### Type Safety

- Use type guards to identify `RowPanel` types: `panel.type === 'row' && 'panels' in panel`
- Avoid `any` type assertions
- Use explicit type checks for panel types

### Error Handling

- Handle missing elements gracefully
- Validate layout structures before processing
- Provide clear error messages for invalid structures

## Related Files

- `ResponseTransformers.ts`: Main conversion logic
- `ResponseTransformersLayout.test.ts`: Unit tests for layout conversions
- `v1.ts`: V1 API client (handles frontend conversion fallback)
- `UnifiedDashboardAPI.ts`: Unified API (handles version switching)

## References

- V1 Dashboard Schema: `@grafana/schema`
- V2 Dashboard Schema: `@grafana/schema/dist/esm/schema/dashboard/v2`
- Backend Conversion: `apps/dashboard/pkg/migration/conversion/`
