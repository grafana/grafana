---
description: A reference for the JSON layout schema used with Observability as Code.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
  - layout
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: layout schema
title: layout
weight: 400
---

# `layout`

There are four layout options offering two types of panel control:

**Panel layout options**

These options control the size and position of panels:

- [GridLayoutKind](#gridlayoutkind) - Corresponds to the **Custom** option in the UI. You define panel size and panel positions using x- and y- settings.
- [AutoGridLayoutKind](#autogridlayoutkind) - Corresponds to the **Auto grid** option in the UI. Panel size and position are automatically set based on column and row parameters.

**Panel grouping options**

These options control the grouping of panels:

- [RowsLayoutKind](#rowslayoutkind) - Groups panels into rows.
- [TabsLayoutKind](#tabslayoutkind) - Groups panels into tabs.

## `GridLayoutKind`

The grid layout allows you to manually size and position grid items by setting the height, width, x, and y of each item.
This layout corresponds to the **Custom** option in the UI.

Following is the JSON for a default grid layout, a grid layout item, and a grid layout row:

```json
    "kind": "GridLayout",
    "spec": {
      "items": [
        {
          "kind": "GridLayoutItem",
          "spec": {
            "element": {...},
            "height": 0,
            "width": 0,
            "x": 0,
            "y": 0
          }
        },
        {
          "kind": "GridLayoutRow",
          "spec": {
            "collapsed": false,
            "elements": [],
            "title": "",
            "y": 0
          }
        },
      ]
    }
```

`GridLayoutKind` consists of:

- kind: "GridLayout"
- spec: GridLayoutSpec
  - items: GridLayoutItemKind` or GridLayoutRowKind`
    - GridLayoutItemKind
      - kind: "GridLayoutItem"
      - spec: [GridLayoutItemSpec](#gridlayoutitemspec)
    - GridLayoutRowKind
      - kind: "GridLayoutRow"
      - spec: [GridLayoutRowSpec](#gridlayoutrowspec)

### `GridLayoutItemSpec`

The following table explains the usage of the grid layout item JSON fields:

| Name    | Usage                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x       | integer. Position of the item x-axis.                                                                                                                                                                                 |
| y       | integer. Position of the item y-axis.                                                                                                                                                                                 |
| width   | Width of the item in pixels.                                                                                                                                                                                          |
| height  | Height of the item in pixels.                                                                                                                                                                                         |
| element | `ElementReference`. Reference to a [`PanelKind`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/panel-schema/) from `dashboard.spec.elements` expressed as JSON Schema reference. |
| repeat? | [RepeatOptions](#repeatoptions). Configured repeat options, if any                                                                                                                                                    |

#### `RepeatOptions`

The following table explains the usage of the repeat option JSON fields:

| Name       | Usage                                                |
| ---------- | ---------------------------------------------------- |
| mode       | `RepeatMode` - "variable"                            |
| value      | string                                               |
| direction? | Options are `h` for horizontal and `v` for vertical. |
| maxPerRow? | integer                                              |

### `GridLayoutRowSpec`

The following table explains the usage of the grid layout row JSON fields:

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| y | integer. Position of the row y-axis  |
| collapsed | bool. Whether or not the row is collapsed  |
| title | Row title |
| elements | [`[...GridLayoutItemKind]`](#gridlayoutitemspec). Grid items in the row will have their y value be relative to the row's y value. This means a panel positioned at `y: 0` in a row with `y: 10` will be positioned at `y: 11` (row header has a height of 1) in the dashboard. |
| repeat? | [RowRepeatOptions](#rowrepeatoptions) Configured row repeat options, if any</p> |

<!-- prettier-ignore-end -->

#### `RowRepeatOptions`

| Name  | Usage                     |
| ----- | ------------------------- |
| mode  | `RepeatMode` - "variable" |
| value | string                    |

## `AutoGridLayoutKind`

With an auto grid, Grafana sizes and positions your panels for the best fit based on the column and row constraints that you set.
This layout corresponds to the **Auto grid** option in the UI.

Following is the JSON for a default auto grid layout and a grid layout item:

<!-- prettier-ignore-end -->

```json
    "kind": "AutoGridLayout",
    "spec": {
      "columnWidthMode": "standard",
      "fillScreen": false,
      "items": [
        {
          "kind": "AutoGridLayoutItem",
          "spec": {
            "element": {...},
          }
        }
      ],
      "maxColumnCount": 3,
      "rowHeightMode": "standard"
    }
```

`AutoGridLayoutKind` consists of:

- kind: "AutoGridLayout"
- spec: [AutoGridLayoutSpec](#autogridlayoutspec)

### `AutoGridLayoutSpec`

The following table explains the usage of the auto grid layout JSON fields:

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| maxColumnCount? | number. Default is `3`. |
| columnWidthMode | Options are: `narrow`, `standard`, `wide`, and `custom`. Default is `standard`. |
| columnWidth? | number |
| rowHeightMode | Options are: `short`, `standard`, `tall`, and `custom`. Default is `standard`. |
| rowHeight? | number |
| fillScreen? | bool. Default is `false`. |
| items | `AutoGridLayoutItemKind`. Consists of:<ul><li>kind: "AutoGridLayoutItem"</li><li>spec: [AutoGridLayoutItemSpec](#autogridlayoutitemspec)</li></ul> |

<!-- prettier-ignore-end -->

#### `AutoGridLayoutItemSpec`

The following table explains the usage of the auto grid layout item JSON fields:

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| element | `ElementReference`. Reference to a [`PanelKind`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/panel-schema/) from `dashboard.spec.elements` expressed as JSON Schema reference. |
| repeat? | [AutoGridRepeatOptions](#autogridrepeatoptions). Configured repeat options, if any. |
| conditionalRendering? | `ConditionalRenderingGroupKind`. Rules for hiding or showing panels, if any. Consists of:<ul><li>kind: "ConditionalRenderingGroup"</li><li>spec: [ConditionalRenderingGroupSpec](#conditionalrenderinggroupspec)</li></ul> |

<!-- prettier-ignore-end -->

##### `AutoGridRepeatOptions`

The following table explains the usage of the auto grid repeat option JSON fields:

| Name  | Usage                     |
| ----- | ------------------------- |
| mode  | `RepeatMode` - "variable" |
| value | String                    |

##### `ConditionalRenderingGroupSpec`

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| visibility | Options are `show` and `hide` |
| condition | Options are `and` and `or` |
| items | Options are:<ul><li>ConditionalRenderingVariableKind<ul><li>kind: "ConditionalRenderingVariable"</li><li>spec: [ConditionalRenderingVariableSpec](#conditionalrenderingvariablespec)</li></ul></li><li>ConditionalRenderingDataKind<ul><li>kind: "ConditionalRenderingData"</li><li>spec: [ConditionalRenderingDataSpec](#conditionalrenderingdataspec)</li></ul></li><li>ConditionalRenderingTimeRangeSizeKind<ul><li>kind: "ConditionalRenderingTimeRangeSize"</li><li>spec: [ConditionalRenderingTimeRangeSizeSpec](#conditionalrenderingtimerangesizespec)</li></ul></li></ul> |

<!-- prettier-ignore-end -->

###### `ConditionalRenderingVariableSpec`

| Name     | Usage                                |
| -------- | ------------------------------------ |
| variable | string                               |
| operator | Options are `equals` and `notEquals` |
| value    | string                               |

###### `ConditionalRenderingDataSpec`

| Name  | Type |
| ----- | ---- |
| value | bool |

###### `ConditionalRenderingTimeRangeSizeSpec`

| Name  | Type   |
| ----- | ------ |
| value | string |

## `RowsLayoutKind`

The `RowsLayoutKind` is one of two options that you can use to group panels.
You can nest any other kind of layout inside a layout row.
Rows can also be nested in auto grids or tabs.

Following is the JSON for a default rows layout row:

```json
    "kind": "RowsLayout",
    "spec": {
      "rows": [
        {
          "kind": "RowsLayoutRow",
          "spec": {
            "layout": {
              "kind": "GridLayout", // Can also be AutoGridLayout or TabsLayout
              "spec": {...}
            },
            "title": ""
          }
        }
      ]
    }
```

`RowsLayoutKind` consists of:

- kind: RowsLayout
- spec: RowsLayoutSpec
  - rows: RowsLayoutRowKind
    - kind: RowsLayoutRow
    - spec: [RowsLayoutRowSpec](#rowslayoutrowspec)

### `RowsLayoutRowSpec`

The following table explains the usage of the rows layout row JSON fields:

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| title? | Title of the row. |
| collapse | bool. Whether or not the row is collapsed. |
| hideHeader? | bool. Whether the row header is hidden or shown. |
| fullScreen? | bool. Whether or not the row takes up the full screen. |
| conditionalRendering? | `ConditionalRenderingGroupKind`. Rules for hiding or showing rows, if any. Consists of:<ul><li>kind: "ConditionalRenderingGroup"</li><li>spec: [ConditionalRenderingGroupSpec](#conditionalrenderinggroupspec)</li></ul> |
| repeat? | [RowRepeatOptions](#rowrepeatoptions). Configured repeat options, if any. |
| layout | Supported layouts are:<ul><li>[GridLayoutKind](#gridlayoutkind)</li><li>[RowsLayoutKind](#rowslayoutkind)</li><li>[AutoGridLayoutKind](#autogridlayoutkind)</li><li>[TabsLayoutKind](#tabslayoutkind)</li></ul> |

<!-- prettier-ignore-end -->

## `TabsLayoutKind`

The `TabsLayoutKind` is one of two options that you can use to group panels.
You can nest any other kind of layout inside a tab.
Tabs can also be nested in auto grids or rows.

Following is the JSON for a default tabs layout tab and a tab:

```json
    "kind": "TabsLayout",
    "spec": {
      "tabs": [
        {
          "kind": "TabsLayoutTab",
          "spec": {
            "layout": {
              "kind": "GridLayout", // Can also be AutoGridLayout or RowsLayout
              "spec": {...}
            },
            "title": "New tab"
          }
        }
      ]
    }
```

`TabsLayoutKind` consists of:

- kind: TabsLayout
  - spec: TabsLayoutSpec
    - tabs: TabsLayoutTabKind
      - kind: TabsLayoutTab
      - spec: [TabsLayoutTabSpec](#tabslayouttabspec)

### `TabsLayoutTabSpec`

The following table explains the usage of the tabs layout tab JSON fields:

<!-- prettier-ignore-start -->

| Name | Usage |
| ---- | ----- |
| title? | The title of the tab. |
| layout | Supported layouts are:<ul><li>[GridLayoutKind](#gridlayoutkind)</li><li>[RowsLayoutKind](#rowslayoutkind)</li><li>[AutoGridLayoutKind](#autogridlayoutkind)</li><li>[TabsLayoutKind](#tabslayoutkind)</li></ul> |
| conditionalRendering? | `ConditionalRenderingGroupKind`. Rules for hiding or showing panels, if any. Consists of:<ul><li>kind: "ConditionalRenderingGroup"</li><li>spec: [ConditionalRenderingGroupSpec](#conditionalrenderinggroupspec)</li></ul> |

<!-- prettier-ignore-end -->
