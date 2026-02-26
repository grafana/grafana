# Dashboard Mutation API

Programmatic API for modifying dashboards. Each command is executed via:

```typescript
api.execute({ type: 'COMMAND_NAME', payload: { ... } })
```

---

## Layout

### `GET_LAYOUT`

Read the current layout tree and elements map. Call this first to discover paths and current state.

```json
{ "type": "GET_LAYOUT", "payload": {} }
```

### `UPDATE_LAYOUT`

Switch layout type and/or update layout properties at a path. Omit `layoutType` to keep the current type and only apply options.

**Switch rows to tabs:**

```json
{
  "type": "UPDATE_LAYOUT",
  "payload": { "path": "/", "layoutType": "TabsLayout" }
}
```

**Switch to AutoGridLayout with options:**

```json
{
  "type": "UPDATE_LAYOUT",
  "payload": {
    "path": "/",
    "layoutType": "AutoGridLayout",
    "options": { "maxColumnCount": 4, "columnWidthMode": "wide", "fillScreen": true }
  }
}
```

**Update AutoGrid properties without switching type:**

```json
{
  "type": "UPDATE_LAYOUT",
  "payload": {
    "path": "/",
    "options": { "columnWidthMode": "custom", "columnWidth": 500, "rowHeightMode": "standard" }
  }
}
```

Allowed conversions are same-category only: `RowsLayout` <-> `TabsLayout` (group) or `GridLayout` <-> `AutoGridLayout` (grid).

---

## Rows

### `ADD_ROW`

Add a row to the layout. If the target is not a RowsLayout, the existing content is nested inside the new row.

**Add a row at the root:**

```json
{
  "type": "ADD_ROW",
  "payload": {
    "row": { "spec": { "title": "Monitoring" } },
    "parentPath": "/"
  }
}
```

**Add a repeated row inside a tab:**

```json
{
  "type": "ADD_ROW",
  "payload": {
    "row": { "spec": { "title": "Region stats", "repeat": { "mode": "variable", "value": "region" } } },
    "parentPath": "/tabs/0",
    "position": 0
  }
}
```

### `UPDATE_ROW`

Update a row's properties. Only provided fields are changed.

```json
{
  "type": "UPDATE_ROW",
  "payload": {
    "path": "/rows/0",
    "spec": { "title": "Renamed Row", "collapse": true }
  }
}
```

**Set repeat on an existing row:**

```json
{
  "type": "UPDATE_ROW",
  "payload": {
    "path": "/rows/1",
    "spec": { "repeat": { "mode": "variable", "value": "cluster" } }
  }
}
```

### `REMOVE_ROW`

Remove a row. Use `moveContentTo` to relocate panels instead of deleting them.

**Remove and relocate panels:**

```json
{
  "type": "REMOVE_ROW",
  "payload": { "path": "/rows/0", "moveContentTo": "/rows/1" }
}
```

**Remove and delete panels:**

```json
{
  "type": "REMOVE_ROW",
  "payload": { "path": "/rows/2" }
}
```

### `MOVE_ROW`

Reorder a row or move it to a different parent.

**Reorder within the same parent:**

```json
{
  "type": "MOVE_ROW",
  "payload": { "path": "/rows/0", "toPosition": 2 }
}
```

**Move a row from one tab to another:**

```json
{
  "type": "MOVE_ROW",
  "payload": { "path": "/tabs/0/rows/0", "toParent": "/tabs/1", "toPosition": 0 }
}
```

---

## Tabs

### `ADD_TAB`

Add a tab to the layout. If the target is not a TabsLayout, the existing content is nested inside the new tab.

```json
{
  "type": "ADD_TAB",
  "payload": {
    "tab": { "spec": { "title": "Overview" } },
    "parentPath": "/"
  }
}
```

**Add a repeated tab:**

```json
{
  "type": "ADD_TAB",
  "payload": {
    "tab": { "spec": { "title": "Environment", "repeat": { "mode": "variable", "value": "env" } } },
    "parentPath": "/"
  }
}
```

### `UPDATE_TAB`

Update a tab's properties. Only provided fields are changed.

```json
{
  "type": "UPDATE_TAB",
  "payload": {
    "path": "/tabs/0",
    "spec": { "title": "Renamed Tab" }
  }
}
```

### `REMOVE_TAB`

Remove a tab. Use `moveContentTo` to relocate panels instead of deleting them.

```json
{
  "type": "REMOVE_TAB",
  "payload": { "path": "/tabs/0", "moveContentTo": "/tabs/1" }
}
```

### `MOVE_TAB`

Reorder a tab or move it to a different parent.

```json
{
  "type": "MOVE_TAB",
  "payload": { "path": "/tabs/0", "toPosition": 2 }
}
```

---

## Panels

### `MOVE_PANEL`

Move a panel to a different group or reposition it within a grid.

**Move to another row:**

```json
{
  "type": "MOVE_PANEL",
  "payload": { "element": { "name": "panel-abc" }, "toParent": "/rows/1" }
}
```

**Reposition within the current grid:**

```json
{
  "type": "MOVE_PANEL",
  "payload": {
    "element": { "name": "panel-abc" },
    "position": { "x": 0, "y": 0, "width": 12, "height": 8 }
  }
}
```

---

## Variables

### `ADD_VARIABLE`

```json
{
  "type": "ADD_VARIABLE",
  "payload": {
    "variable": {
      "kind": "CustomVariable",
      "spec": { "name": "env", "query": "dev,staging,prod", "multi": true }
    }
  }
}
```

### `UPDATE_VARIABLE`

```json
{
  "type": "UPDATE_VARIABLE",
  "payload": {
    "name": "env",
    "variable": {
      "kind": "CustomVariable",
      "spec": { "name": "env", "query": "dev,staging,prod,canary", "multi": true }
    }
  }
}
```

### `REMOVE_VARIABLE`

```json
{
  "type": "REMOVE_VARIABLE",
  "payload": { "name": "env" }
}
```

### `LIST_VARIABLES`

```json
{ "type": "LIST_VARIABLES", "payload": {} }
```

---

## Utility

### `ENTER_EDIT_MODE`

Enter dashboard edit mode. Write commands call this automatically; this is rarely needed directly.

```json
{ "type": "ENTER_EDIT_MODE", "payload": {} }
```

---

## Paths

Every layout node has a path string returned by `GET_LAYOUT`:

| Path             | Meaning                         |
| ---------------- | ------------------------------- |
| `/`              | Root layout                     |
| `/rows/0`        | First row                       |
| `/rows/1`        | Second row                      |
| `/tabs/0`        | First tab                       |
| `/tabs/1/rows/0` | First row inside the second tab |

Paths are positional and shift after add/remove operations. Re-read the layout between complex restructuring steps to get updated paths.

## Layout types

| Type             | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `RowsLayout`     | Panels organized into collapsible rows.                                          |
| `TabsLayout`     | Panels organized into tabs.                                                      |
| `GridLayout`     | Flat grid with explicit x/y/width/height positioning.                            |
| `AutoGridLayout` | Auto-arranged grid with configurable column width, row height, and column count. |

## Nesting rules

- Maximum two layers of group nesting (root group + one nested group).
- No same-type nesting (rows inside rows, tabs inside tabs).

For example, tabs containing rows is valid. Tabs containing tabs is rejected.
