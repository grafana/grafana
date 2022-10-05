---
aliases:
  - /docs/grafana/latest/features/panels/canvas/
  - /docs/grafana/latest/visualizations/canvas/
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

Introducing the Canvas panel, a new panel that combines the power of Grafana with the flexibility of custom elements. Canvas visualizations are extensible form-built panels that allow you to explicitly place elements within static and dynamic layouts. This empowers you to design custom visualizations and overlay data in ways that aren't possible with standard Grafana panels, all within Grafana's UI. If you've used popular UI and web design tools, then designing Canvas panels will feel very familiar.

TODO: add gif from what's new

## Elements

### Metric value

The metric value element allows you to easily select the data you want to display on canvas. This element has a unique “edit” mode that can be triggered either through the context menu “Edit” option or by double clicking. When in edit mode you can select which field data that you want to display.

TODO: Gif of metric value element?

### Text

The text element allows you to easily add text to the canvas. The element also supports an editing mode, triggered via either double clicking or the edit menu option in the context menu.

TODO: Gif of text element

### Rectangle

The rectangle element allows you to add a basic rectangle to the canvas. Rectangle elements support displaying text (both fixed and field data) as well as can change background color based on data thresholds.

### Icon

The icon element allows you to add a supported icon to the canvas. Icons can have their color set based on thresholds / value mappings.

## Canvas Editing

### Inline editor

Canvas introduces a new editing experience. You can now edit your canvas panel inline while in the context of dashboard mode.

TODO: Gif of inline editor experience?

### Context menu

Related to a fresh look at panel editing, the context menu allows you to perform common tasks quickly and efficiently. Supported functionality includes opening / closing the inline editor, duplicating an element, deleting an element, and more.

The context menu is triggered by a right click action over the panel / over a given canvas element

TODO: add pic of context menu

## Canvas Options

### Inline editing

The inline editing toggle allows you to lock or unlock the canvas panel. When turned off the canvas panel becomes “locked”, freezing elements in place and preventing unintended modifications.

TODO: gif of "locked" vs "unlocked" behavior?
