---
aliases:
  - /docs/grafana/latest/features/panels/canvas/
  - /docs/grafana/latest/visualizations/canvas/
  - /docs/grafana/latest/panels-visualizations/visualizations/canvas/
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

## Canvas Editing

### Inline editor

Canvas introduces a new editing experience. You can now edit your canvas panel inline while in the context of dashboard mode.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editor-9-2-0.mp4" max-width="750px" caption="Inline editor demo" >}}

### Context menu

Related to a fresh look at panel editing, the context menu enables you to perform common tasks quickly and efficiently. Supported functionality includes opening / closing the inline editor, duplicating an element, deleting an element, and more.

The context menu is triggered by a right click action over the panel / over a given canvas element

{{< figure src="/static/img/docs/canvas-panel/canvas-context-menu-9-2-0.png" max-width="750px" caption="Canvas context menu" >}}

## Canvas Options

### Inline editing

The inline editing toggle enables you to lock or unlock the canvas panel. When turned off the canvas panel becomes “locked”, freezing elements in place and preventing unintended modifications.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editing-toggle-9-2-0.mp4" max-width="750px" caption="Inline editing toggle demo" >}}
