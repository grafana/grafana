---
aliases:
  - ../../features/panels/canvas/
  - ../../visualizations/canvas/
description: Configure options for Grafana's canvas visualization
keywords:
  - grafana
  - canvas
  - panel
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Canvas
weight: 100
---

# Canvas

Canvases combine the power of Grafana with the flexibility of custom elements. Canvases are extensible form-built visualizations that allow you to explicitly place elements within static and dynamic layouts. This empowers you to design custom visualizations and overlay data in ways that aren't possible with standard Grafana panels, all within Grafana's UI. If you've used popular UI and web design tools, then designing canvases will feel very familiar.

> We would love your feedback on Canvas. Please check out the [open Github issues](https://github.com/grafana/grafana/issues?page=1&q=is%3Aopen+is%3Aissue+label%3Aarea%2Fpanel%2Fcanvas) and [submit a new feature request](https://github.com/grafana/grafana/issues/new?assignees=&labels=type%2Ffeature-request,area%2Fpanel%2Fcanvas&title=Canvas:&projects=grafana-dataviz&template=1-feature_requests.md) as needed.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-beta-overview-9-2-0.mp4" max-width="750px" caption="Canvas beta overview" >}}

## Elements

### Metric value

The metric value element lets you easily select the data you want to display on a canvas. This element has a unique “edit” mode that can be triggered either through the context menu “Edit” option or by double clicking. When in edit mode you can select which field data that you want to display.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-metric-value-9-2-0.mp4" max-width="750px" caption="Metric value element demo" >}}

### Text

The text element lets you easily add text to the canvas. The element also supports an editing mode, triggered via either double clicking or the edit menu option in the context menu.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-text-9-2-0.mp4" max-width="750px" caption="Text element demo" >}}

### Ellipse

The ellipse element lets you add a basic ellipse to the canvas. An ellipse element can display text (both fixed and field data) and its background color can be changed based on data thresholds.

### Rectangle

The rectangle element lets you add a basic rectangle to the canvas. A rectangle element can display text (both fixed and field data) and its background color can be changed based on data thresholds.

### Icon

The icon element lets you add a supported icon to the canvas. Icons can have their color set based on thresholds / value mappings.

### Server

The server element lets you easily represent a single server, a stack of servers, a database, or a terminal. Server elements support status color, bulb color, and a bulb blink rate all configurable by fixed or field values.

{{< figure src="/media/docs/grafana/canvas-server-element-9-4-0.png" max-width="750px" caption="Canvas server element" >}}

### Button

The button element lets you add a basic button to the canvas. Button elements support triggering basic, unauthenticated API calls. API settings are found in the button element editor. You can also pass template variables in the API editor.

{{% admonition type="note" %}}
A button click will only trigger an API call when [inline editing](#inline-editing) is disabled.
{{% /admonition %}}

{{< video-embed src="/media/docs/grafana/2023-20-10-Canvas-Button-Element-Enablement-Video.mp4" max-width="750px" caption="Canvas button element demo" >}}

## Connections

When building a canvas, you can connect elements together to create more complex visualizations. Connections are created by dragging from the connection anchor of one element to the connection anchor of another element. You can also create connections to the background of the canvas. Connection anchors are displayed when you hover over an element and inline editing is turned on. To remove a connection, simply click on the connection directly and then press the "Delete" or "Backspace" key.

{{< video-embed src="/media/docs/grafana/canvas-connections-9-4-0.mp4" max-width="750px" caption="Canvas connections demo" >}}

You can set both the size and color of connections based on fixed or field values. To do so, enter into panel edit mode, select the connection, and modify the connection's properties in the panel editor.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-canvas-service-graph.png" max-width="750px" caption="Canvas service graph" >}}

## Canvas editing

### Inline editor

You can edit your canvas inline while in the context of dashboard mode.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editor-9-2-0.mp4" max-width="750px" caption="Inline editor demo" >}}

### Pan and zoom

You can enable panning and zooming in a canvas. This allows you to both create and navigate more complex designs.

{{< docs/public-preview product="Canvas pan and zoom" featureFlag="`canvasPanelPanZoom`" >}}

{{< figure src="/media/docs/grafana/screenshot-grafana-10-3-canvas-pan-zoom-setting.png" max-width="300px" alt="Canvas pan zoom control" >}}

{{< video-embed src="/media/docs/grafana/2024-01-05-Canvas-Pan-&-Zoom-Enablement-Video.mp4" max-width="750px" caption="Canvas pan and zoom enablement video" >}}

### Context menu

The context menu lets you perform common tasks quickly and efficiently. Supported functionality includes opening / closing the inline editor, duplicating an element, deleting an element, and more.

The context menu is triggered by a right click action over the panel / over a given canvas element. When right clicking the panel, you are able to set a background image and easily add elements to the canvas.

{{< figure src="/static/img/docs/canvas-panel/canvas-panel-context-menu-9-3-0.png" max-width="750px" caption="Canvas panel context menu" >}}

When right clicking an element, you are able to edit, delete, duplicate, and modify the element's layer positioning.

{{< figure src="/static/img/docs/canvas-panel/canvas-context-menu-9-2-0.png" max-width="750px" caption="Canvas element context menu" >}}

### Element snapping and alignment

When you're moving elements around the canvas, snapping and alignment guides help you create more precise layouts.

{{% admonition type="note" %}}
Currently, element snapping and alignment only works when the canvas is not zoomed in.
{{% /admonition %}}

<!-- TODO: Add gif showcasing feature (when creating what's new entry for 10.4) -->

## Canvas options

### Inline editing

The inline editing toggle lets you lock or unlock the canvas. When turned off the canvas becomes “locked”, freezing elements in place and preventing unintended modifications.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editing-toggle-9-2-0.mp4" max-width="750px" caption="Inline editing toggle demo" >}}

### Data links

Canvases support [data links](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/), but only for metric-value, text, rectangle, and ellipse elements. You can add a data link by following these steps:

1. Set an element to be tied to a field value.
1. Turn off the inline editing toggle.
1. Create an override for **Fields with name** and select the element field name from the list.
1. Click the **+ Add override property** button.
1. Select `Datalinks > Datalinks` from the list.
1. Click **+Add link** add a title and URL for the data link.
1. Hover over the element to display the data link tooltip.
1. Click on the element to be able to open the data link.

If multiple elements use the same field name, and you want to control which elements display the data link, you can create a unique field name using the [add field from calculation transform](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation). The alias you create in the transformation will appear as a field you can use with an element.

1. In the panel editor for the canvas, click the **Transform** tab.
1. Select **Add field from calculation** from the list of transformations, or click **+ Add transformation** to display the list first.
1. Choose **Reduce row** from the dropdown and click the field name that you want to use for the element.
1. Select **All Values** from the **Calculation** dropdown.
1. Add an alias for the field name.
1. Reference the new unique field alias to create the element and field override.

{{< video-embed src="/media/docs/grafana/canvas-data-links-9-4-0.mp4" max-width="750px" caption="Data links demo" >}}
