# Dashboard Mutation API

Programmatic API for modifying dashboards. Each command is executed via:

```typescript
api.execute({ type: 'COMMAND_NAME', payload: { ... } })
```

All responses share this shape:

```json
{
  "success": true,
  "data": {},
  "changes": [{ "path": "...", "previousValue": "...", "newValue": "..." }],
  "warnings": ["optional array of warning strings"]
}
```

On failure, `success` is `false` and `error` contains a message. `changes` is always `[]` on failure.

---

## Layout

### `GET_LAYOUT`

Read the current layout tree and elements map. Call this first to discover paths and current state.

**Request:**

```json
{ "type": "GET_LAYOUT", "payload": {} }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "layout": {
      "kind": "RowsLayout",
      "spec": {
        "rows": [
          {
            "kind": "RowsLayoutRow",
            "spec": { "title": "Monitoring", "collapse": false, "hideHeader": false, "fillScreen": false },
            "layout": { "kind": "GridLayout" },
            "path": "/rows/0"
          }
        ]
      }
    },
    "elements": {
      "panel-1": { "kind": "Panel", "spec": { "title": "Request rate", "...": "..." } }
    }
  },
  "changes": []
}
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

**Response:**

```json
{
  "success": true,
  "data": { "path": "/", "layoutType": "AutoGridLayout" },
  "changes": [{ "path": "/", "previousValue": "GridLayout", "newValue": "AutoGridLayout" }]
}
```

Allowed conversions are same-category only: `RowsLayout` <-> `TabsLayout` (group) or `GridLayout` <-> `AutoGridLayout` (grid). Providing `options` for a non-AutoGrid layout type returns an error.

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

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "/rows/1",
    "row": { "kind": "RowsLayoutRow", "spec": { "title": "Monitoring" } }
  },
  "changes": [{ "path": "/rows/1", "previousValue": null, "newValue": { "title": "Monitoring" } }]
}
```

### `UPDATE_ROW`

Update a row's properties. Only provided fields are changed.

**Request:**

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

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "/rows/0",
    "row": {
      "kind": "RowsLayoutRow",
      "spec": { "title": "Renamed Row", "collapse": true, "hideHeader": false, "fillScreen": false }
    }
  },
  "changes": [
    {
      "path": "/rows/0",
      "previousValue": { "title": "Old Title", "collapse": false, "hideHeader": false, "fillScreen": false },
      "newValue": { "title": "Renamed Row", "collapse": true, "hideHeader": false, "fillScreen": false }
    }
  ]
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

**Response:**

```json
{
  "success": true,
  "data": { "path": "/rows/0" },
  "changes": [{ "path": "/rows/0", "previousValue": { "title": "Monitoring" }, "newValue": null }]
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

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "/rows/2",
    "row": {
      "kind": "RowsLayoutRow",
      "spec": { "title": "Monitoring", "collapse": false, "hideHeader": false, "fillScreen": false }
    }
  },
  "changes": [{ "path": "/rows/0", "previousValue": "/rows/0", "newValue": "/rows/2" }]
}
```

---

## Tabs

### `ADD_TAB`

Add a tab to the layout. If the target is not a TabsLayout, the existing content is nested inside the new tab.

**Request:**

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

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "/tabs/1",
    "tab": { "kind": "TabsLayoutTab", "spec": { "title": "Overview" } }
  },
  "changes": [{ "path": "/tabs/1", "previousValue": null, "newValue": { "title": "Overview" } }]
}
```

### `UPDATE_TAB`

Update a tab's properties. Only provided fields are changed.

**Request:**

```json
{
  "type": "UPDATE_TAB",
  "payload": {
    "path": "/tabs/0",
    "spec": { "title": "Renamed Tab" }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "/tabs/0",
    "tab": { "kind": "TabsLayoutTab", "spec": { "title": "Renamed Tab" } }
  },
  "changes": [
    {
      "path": "/tabs/0",
      "previousValue": { "title": "Old Title" },
      "newValue": { "title": "Renamed Tab" }
    }
  ]
}
```

### `REMOVE_TAB`

Remove a tab. Use `moveContentTo` to relocate panels instead of deleting them.

**Request:**

```json
{
  "type": "REMOVE_TAB",
  "payload": { "path": "/tabs/0", "moveContentTo": "/tabs/1" }
}
```

**Response:**

```json
{
  "success": true,
  "data": { "path": "/tabs/0" },
  "changes": [{ "path": "/tabs/0", "previousValue": { "title": "Overview" }, "newValue": null }]
}
```

### `MOVE_TAB`

Reorder a tab or move it to a different parent.

**Request:**

```json
{
  "type": "MOVE_TAB",
  "payload": { "path": "/tabs/0", "toPosition": 2 }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "path": "/tabs/2",
    "tab": { "kind": "TabsLayoutTab", "spec": { "title": "Overview" } }
  },
  "changes": [{ "path": "/tabs/0", "previousValue": "/tabs/0", "newValue": "/tabs/2" }]
}
```

---

## Panels

### `ADD_PANEL`

Create a new panel and add it to the dashboard. The `id` is auto-assigned. The `layoutItem.kind` is optional -- it is auto-detected from the target layout. If provided and mismatched, a warning is emitted.

**Request:**

```json
{
  "type": "ADD_PANEL",
  "payload": {
    "panel": {
      "kind": "Panel",
      "spec": {
        "title": "Request rate",
        "vizConfig": {
          "kind": "VizConfig",
          "group": "timeseries",
          "spec": { "options": {}, "fieldConfig": { "defaults": {}, "overrides": [] } }
        },
        "data": {
          "kind": "QueryGroup",
          "spec": {
            "queries": [
              {
                "kind": "PanelQuery",
                "spec": {
                  "refId": "A",
                  "query": {
                    "kind": "DataQuery",
                    "group": "prometheus",
                    "spec": { "expr": "rate(http_requests_total[5m])" }
                  }
                }
              }
            ]
          }
        }
      }
    },
    "parentPath": "/rows/0",
    "layoutItem": { "spec": { "x": 0, "y": 0, "width": 12, "height": 8 } }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "element": { "kind": "Panel", "spec": { "title": "Request rate", "...": "..." } },
    "layoutItem": {
      "kind": "GridLayoutItem",
      "spec": { "x": 0, "y": 0, "width": 12, "height": 8, "element": { "kind": "ElementReference", "name": "panel-1" } }
    }
  },
  "changes": [{ "path": "/elements/panel-1", "previousValue": null, "newValue": "..." }]
}
```

All panel write commands (ADD, UPDATE, MOVE) return `{ element, layoutItem }`. The element name is in `layoutItem.spec.element.name`. LIST_PANELS returns the same shape as an array. The `layoutItem` always includes the resolved `kind`, even if the request omitted it.

### `UPDATE_PANEL`

Partial update of an existing panel. Only provided fields are applied. Options and fieldConfig are deep-merged. Plugin type changes use proper fieldConfig cleanup.

**Change title only:**

```json
{
  "type": "UPDATE_PANEL",
  "payload": {
    "element": { "name": "panel-abc" },
    "panel": { "spec": { "title": "New title" } }
  }
}
```

**Deep-merge visualization options:**

```json
{
  "type": "UPDATE_PANEL",
  "payload": {
    "element": { "name": "panel-abc" },
    "panel": {
      "spec": {
        "vizConfig": {
          "spec": { "options": { "legend": { "displayMode": "table" } } }
        }
      }
    }
  }
}
```

**Change plugin type (e.g. timeseries to stat):**

```json
{
  "type": "UPDATE_PANEL",
  "payload": {
    "element": { "name": "panel-abc" },
    "panel": {
      "spec": {
        "vizConfig": { "group": "stat", "spec": { "options": { "graphMode": "none" } } }
      }
    }
  }
}
```

**Response (all UPDATE_PANEL variants):**

```json
{
  "success": true,
  "data": {
    "element": {
      "kind": "Panel",
      "spec": {
        "title": "New title",
        "vizConfig": { "kind": "VizConfig", "group": "timeseries", "spec": { "...": "..." } },
        "data": { "kind": "QueryGroup", "spec": { "queries": ["..."] } }
      }
    },
    "layoutItem": {
      "kind": "GridLayoutItem",
      "spec": {
        "x": 0,
        "y": 0,
        "width": 12,
        "height": 8,
        "element": { "kind": "ElementReference", "name": "panel-abc" }
      }
    }
  },
  "changes": [
    {
      "path": "/elements/panel-abc",
      "previousValue": { "kind": "Panel", "spec": { "...": "previous state" } },
      "newValue": "..."
    }
  ]
}
```

Same `{ element, layoutItem }` shape as ADD_PANEL and MOVE_PANEL. The `transparent` field in the spec maps to the internal `displayMode` state (`true` -> `"transparent"`, `false` -> `"default"`).

### `REMOVE_PANEL`

Remove one or more panels by element name.

**Request:**

```json
{
  "type": "REMOVE_PANEL",
  "payload": {
    "elements": [{ "name": "panel-abc" }, { "name": "panel-def" }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": { "removed": ["panel-abc", "panel-def"] },
  "changes": [
    { "path": "/elements/panel-abc", "previousValue": { "kind": "Panel", "spec": { "...": "..." } }, "newValue": null },
    { "path": "/elements/panel-def", "previousValue": { "kind": "Panel", "spec": { "...": "..." } }, "newValue": null }
  ]
}
```

If some elements fail while others succeed, `success` is `true` and partial failures are reported in `warnings`.

### `LIST_PANELS`

List all elements on the dashboard (panels, library panels, etc.) as an array of `{ element, layoutItem }` entries. Same shape as write command responses, with the element name embedded in `layoutItem.spec.element.name`.

**Request:**

```json
{ "type": "LIST_PANELS", "payload": {} }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "elements": [
      {
        "element": {
          "kind": "Panel",
          "spec": {
            "title": "Request rate",
            "vizConfig": { "kind": "VizConfig", "group": "timeseries", "spec": { "...": "..." } },
            "data": { "kind": "QueryGroup", "spec": { "queries": ["..."] } }
          }
        },
        "layoutItem": {
          "kind": "GridLayoutItem",
          "spec": {
            "x": 0,
            "y": 0,
            "width": 12,
            "height": 8,
            "element": { "kind": "ElementReference", "name": "panel-1" }
          }
        }
      },
      {
        "element": { "kind": "Panel", "spec": { "title": "Error count", "...": "..." } },
        "layoutItem": {
          "kind": "AutoGridLayoutItem",
          "spec": { "element": { "kind": "ElementReference", "name": "panel-2" } }
        }
      }
    ]
  },
  "changes": []
}
```

Each entry uses the same `{ element, layoutItem }` shape as write commands. The element name is in `layoutItem.spec.element.name`.

### `MOVE_PANEL`

Move a panel to a different group or reposition it within a grid. The `layoutItem.kind` is optional -- it is auto-detected from the target layout. If provided and mismatched, a warning is emitted.

**Move to another row:**

```json
{
  "type": "MOVE_PANEL",
  "payload": { "element": { "name": "panel-abc" }, "toParent": "/rows/1" }
}
```

**Reposition within the current grid using layoutItem:**

```json
{
  "type": "MOVE_PANEL",
  "payload": {
    "element": { "name": "panel-abc" },
    "layoutItem": { "spec": { "x": 0, "y": 0, "width": 12, "height": 8 } }
  }
}
```

**Move to an AutoGridLayout parent (position is auto-arranged):**

```json
{
  "type": "MOVE_PANEL",
  "payload": {
    "element": { "name": "panel-abc" },
    "toParent": "/tabs/0"
  }
}
```

**Response (all MOVE_PANEL variants):**

```json
{
  "success": true,
  "data": {
    "element": { "kind": "Panel", "spec": { "title": "Request rate", "...": "..." } },
    "layoutItem": {
      "kind": "GridLayoutItem",
      "spec": {
        "x": 0,
        "y": 0,
        "width": 12,
        "height": 8,
        "element": { "kind": "ElementReference", "name": "panel-abc" }
      }
    }
  },
  "changes": [
    {
      "path": "/elements/panel-abc",
      "previousValue": { "kind": "GridLayoutItem", "spec": { "x": 0, "y": 0, "width": 12, "height": 8 } },
      "newValue": { "parent": "/rows/1" }
    }
  ]
}
```

Same `{ element, layoutItem }` shape as ADD_PANEL and UPDATE_PANEL. When moving to an AutoGridLayout target, `layoutItem` returns `{ "kind": "AutoGridLayoutItem", "spec": { "element": { ... } } }`.

> **Deprecated:** The `position` field (`{ x, y, width, height }`) is deprecated. Use `layoutItem: { spec: { ... } }` instead. If both are provided, `layoutItem` takes precedence.

---

## Variables

### `ADD_VARIABLE`

**Request:**

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

**Response:**

```json
{
  "success": true,
  "data": {
    "variable": { "kind": "CustomVariable", "spec": { "name": "env", "query": "dev,staging,prod", "multi": true } }
  },
  "changes": [
    {
      "path": "/variables/env",
      "previousValue": null,
      "newValue": { "kind": "CustomVariable", "spec": { "...": "..." } }
    }
  ]
}
```

### `UPDATE_VARIABLE`

**Request:**

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

**Response:**

```json
{
  "success": true,
  "data": {
    "variable": {
      "kind": "CustomVariable",
      "spec": { "name": "env", "query": "dev,staging,prod,canary", "multi": true }
    }
  },
  "changes": [
    {
      "path": "/variables/env",
      "previousValue": "...",
      "newValue": { "kind": "CustomVariable", "spec": { "...": "..." } }
    }
  ]
}
```

### `REMOVE_VARIABLE`

**Request:**

```json
{
  "type": "REMOVE_VARIABLE",
  "payload": { "name": "env" }
}
```

**Response:**

```json
{
  "success": true,
  "data": { "name": "env" },
  "changes": [{ "path": "/variables/env", "previousValue": "...", "newValue": null }]
}
```

### `LIST_VARIABLES`

**Request:**

```json
{ "type": "LIST_VARIABLES", "payload": {} }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "variables": [
      {
        "kind": "CustomVariable",
        "spec": { "name": "env", "query": "dev,staging,prod", "multi": true, "hide": "dontHide" }
      },
      {
        "kind": "QueryVariable",
        "spec": {
          "name": "instance",
          "query": { "kind": "DataQuery", "group": "prometheus", "spec": { "expr": "label_values(up, instance)" } },
          "refresh": "onDashboardLoad"
        }
      }
    ]
  },
  "changes": []
}
```

---

## Utility

### `ENTER_EDIT_MODE`

Enter dashboard edit mode. Write commands call this automatically; this is rarely needed directly.

**Request:**

```json
{ "type": "ENTER_EDIT_MODE", "payload": {} }
```

**Response:**

```json
{
  "success": true,
  "data": { "wasAlreadyEditing": false, "isEditing": true },
  "changes": [{ "path": "/isEditing", "previousValue": false, "newValue": true }]
}
```

If already in edit mode, `wasAlreadyEditing` is `true` and `changes` is `[]`.

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
