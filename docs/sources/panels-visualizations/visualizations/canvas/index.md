---
aliases:
  - ../../features/panels/canvas/
  - ../../visualizations/canvas/
description: Canvas visualization documentation
keywords:
  - grafana
  - canvas
  - panel
  - documentation
title: Canvas
weight: 600
---

# Canvas

Canvas is a new panel that combines the power of Grafana with the flexibility of custom elements. Canvas visualizations are extensible form-built panels that allow you to explicitly place elements within static and dynamic layouts. This empowers you to design custom visualizations and overlay data in ways that aren't possible with standard Grafana panels, all within Grafana's UI. If you've used popular UI and web design tools, then designing Canvas panels will feel very familiar.

> We would love your feedback on Canvas. Please check out the [Github discussion](https://github.com/grafana/grafana/discussions/56835) and join the conversation.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-beta-overview-9-2-0.mp4" max-width="750px" caption="Canvas panel beta overview" >}}

## Elements

### Metric value

The metric value element enables you to easily select the data you want to display on canvas. This element has a unique “edit” mode that can be triggered either through the context menu “Edit” option or by double clicking. When in edit mode you can select which field data that you want to display.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-metric-value-9-2-0.mp4" max-width="750px" caption="Metric value element demo" >}}

### Text

The text element enables you to easily add text to the canvas. The element also supports an editing mode, triggered via either double clicking or the edit menu option in the context menu.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-text-9-2-0.mp4" max-width="750px" caption="Text element demo" >}}

### Rectangle

The rectangle element enables you to add a basic rectangle to the canvas. Rectangle elements support displaying text (both fixed and field data) as well as can change background color based on data thresholds.

### Icon

The icon element enables you to add a supported icon to the canvas. Icons can have their color set based on thresholds / value mappings.

### Server

The server element enables you to easily represent a single server, a stack of servers, a database, or a terminal. Server elements support status color, bulb color, and a bulb blink rate all configurable by fixed or field values.

{{< figure src="/media/docs/grafana/canvas-server-element-9-4-0.png" max-width="750px" caption="Canvas server element" >}}

## Connections

When building a canvas panel, you can connect elements together to create more complex visualizations. Connections are created by dragging from the connection anchor of one element to the connection anchor of another element. You can also create connections to the background of the canvas panel. Connection anchors are displayed when you hover over an element and inline editing is turned on. To remove a connection, simply click on the connection directly and then press the "Delete" or "Backspace" key.

{{< video-embed src="/media/docs/grafana/canvas-connections-9-4-0.mp4" max-width="750px" caption="Canvas connections demo" >}}

## Canvas editing

### Inline editor

Canvas introduces a new editing experience. You can now edit your canvas panel inline while in the context of dashboard mode.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editor-9-2-0.mp4" max-width="750px" caption="Inline editor demo" >}}

### Context menu

Related to a fresh look at panel editing, the context menu enables you to perform common tasks quickly and efficiently. Supported functionality includes opening / closing the inline editor, duplicating an element, deleting an element, and more.

The context menu is triggered by a right click action over the panel / over a given canvas element. When right clicking the panel, you are able to set a background image and easily add elements to the canvas.

{{< figure src="/static/img/docs/canvas-panel/canvas-panel-context-menu-9-3-0.png" max-width="750px" caption="Canvas panel context menu" >}}

When right clicking an element, you are able to edit, delete, duplicate, and modify the element's layer positioning.

{{< figure src="/static/img/docs/canvas-panel/canvas-context-menu-9-2-0.png" max-width="750px" caption="Canvas element context menu" >}}

## Canvas options

### Inline editing

The inline editing toggle enables you to lock or unlock the canvas panel. When turned off the canvas panel becomes “locked”, freezing elements in place and preventing unintended modifications.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editing-toggle-9-2-0.mp4" max-width="750px" caption="Inline editing toggle demo" >}}

### Data links

Canvas supports [data links](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/). You can create a data link for a metric-value element and display it for all elements that use the field name by following these steps:

1. Set an element to be tied to a field value.
1. Turn off the inline editing toggle.
1. Create an override for **Fields with name** and select the element field name from the list.
1. Click the **+ Add override property** button.
1. Select `Datalinks > Datalinks` from the list.
1. Click **+Add link** add a title and URL for the data link.
1. Hover over the element to display the data link tooltip.
1. Click on the element to be able to open the data link.

If multiple elements use the same field name, and you want to control which elements display the data link, you can create a unique field name using the [add field from calculation transform](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation). The alias you create in the transformation will appear as a field you can use with an element.

1. In the panel editor for the canvas panel, click the **Transform** tab.
1. Select **Add field from calculation** from the list of transformations, or click **+ Add transformation** to display the list first.
1. Choose **Reduce row** from the dropdown and click the field name that you want to use for the element.
1. Select **All Values** from the **Calculation** dropdown.
1. Add an alias for the field name.
1. Reference the new unique field alias to create the element and field override.

{{< video-embed src="/media/docs/grafana/canvas-data-links-9-4-0.mp4" max-width="750px" caption="Data links demo" >}}
