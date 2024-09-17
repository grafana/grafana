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
refs:
  data-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links/
  add-field-from-calculation-transform:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation
---

# Canvas

Canvases combine the power of Grafana with the flexibility of custom elements.
They are extensible visualizations that allow you to add and arrange elements wherever you want within unstructured static and dynamic layouts.
This lets you design custom visualizations and overlay data in ways that aren't possible with standard Grafana visualizations, all within the Grafana UI.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-beta-overview-9-2-0.mp4" max-width="750px" alt="Canvas beta overview" >}}

If you've used popular UI and web design tools, then designing canvases will feel very familiar.
With all of these dynamic elements, there's almost no limit to what a canvas can display.

{{< admonition type="note" >}}
We'd love your feedback on the canvas visualization. Please check out the [open Github issues](https://github.com/grafana/grafana/issues?page=1&q=is%3Aopen+is%3Aissue+label%3Aarea%2Fpanel%2Fcanvas) and [submit a new feature request](https://github.com/grafana/grafana/issues/new?assignees=&labels=type%2Ffeature-request,area%2Fpanel%2Fcanvas&title=Canvas:&projects=grafana-dataviz&template=1-feature_requests.md) as needed.
{{< /admonition >}}

## Supported data formats

The canvas visualization is unique in that it doesn't have any specific data requirements. You can even start adding and configuring visual elements without providing any data. However, any data you plan to consume should be accessible through supported Grafana data sources and structured in a way that ensures smooth integration with your custom elements.

If your canvas is going to update in real time, your data should support refreshes at your desired intervals without degrading the user experience.

You can tie [Elements](#elements) and [Connections](#connections) to data through options like text, colors, and background pattern images, etc. available in the canvas visualization.

## Elements

Elements are the basic building blocks of a canvas and they help you visualize data with different shapes and options. You can rotate and move elements around the canvas. When you move elements, snapping and alignment guides help you create more precise layouts.

{{% admonition type="note" %}}
Element snapping and alignment only works when the canvas is not zoomed in.
{{% /admonition %}}

When you select an element that you've added to a canvas, you can access editing options for it that are dependent on the element type. The following sections describe the different elements available.

### Basic shapes

A basic shape element can display text (both fixed and field data) and its background color can be changed based on data thresholds. You can add the following basic shapes to a canvas:

- Cloud
- Ellipse
- Parallelogram
- Rectangle
- Triangle

### Metric value

The metric value element lets you easily select the data you want to display on a canvas. This element has a unique “edit” mode that can be triggered either through the context menu “Edit” option or by double clicking. When in edit mode you can select which field data that you want to display.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-metric-value-9-2-0.mp4" max-width="750px" caption="Metric value element demo" >}}

### Text

The text element lets you easily add text to the canvas. The element also supports an editing mode, triggered via either double clicking or the edit menu option in the context menu.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-text-9-2-0.mp4" max-width="750px" caption="Text element demo" >}}

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

{{< docs/play title="Canvas Visualization: Buttons" url="https://play.grafana.org/d/c9ea65f5-ed5a-45cf-8fb7-f82af7c3afdf/" >}}

## Connections

When building a canvas, you can connect elements together to create more complex visualizations. Connections are created by dragging from the connection anchor of one element to the connection anchor of another element. You can also create connections to the background of the canvas. Connection anchors are displayed when you hover over an element and inline editing is turned on.

To remove a connection, simply click on the connection directly and then press the "Delete" or "Backspace" key.

{{< video-embed src="/media/docs/grafana/canvas-connections-9-4-0.mp4" max-width="750px" caption="Canvas connections demo" >}}

### Adjust connectors

You can adjust connectors, adding angles to them, to fit the canvas you're working in. When you move connected elements, the connector resizes to fit the space. To adjust a connector, click it to display the midpoint controls and move those as needed. To make a connector a straight line again, move the midpoint back until the midpoint controls disappear.

If you move a connector so that it's almost a right angle or a straight line, the connector snaps into that angle or into a straight line.

<!-- TODO: Use updated demo from what's new when uploaded to YouTube -->

{{< video-embed src="/media/docs/grafana/panels-visualizations/gif-canvas-connector-vertex-control-v11.0.mp4" alt="Changing a connector from a straight line to a right angle" >}}

### Style connectors

You can set the size, color, direction, and style of connections based on fixed or field values. To do so, enter into panel edit mode, select the connection, and modify the connection's properties in the panel editor.

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

#### Infinite panning

You can enable infinite panning in a canvas when pan and zoom is enabled. This allows you to pan and zoom the canvas and uncover larger designs.

{{% admonition type="note" %}}
Infinite panning is an experimental feature that may not work as expected in all scenarios. For example, elements that are not top-left constrained may experience unexpected movement when panning.
{{% /admonition %}}

<!-- TODO: Add gif -->

### Context menu

The context menu lets you perform common tasks quickly and efficiently. Supported functionality includes opening / closing the inline editor, duplicating an element, deleting an element, and more.

The context menu is triggered by a right click action over the panel / over a given canvas element. When right clicking the panel, you are able to set a background image and easily add elements to the canvas.

{{< figure src="/static/img/docs/canvas-panel/canvas-panel-context-menu-9-3-0.png" max-width="750px" caption="Canvas panel context menu" >}}

When right clicking an element, you are able to edit, delete, duplicate, and modify the element's layer positioning.

{{< figure src="/static/img/docs/canvas-panel/canvas-context-menu-9-2-0.png" max-width="750px" caption="Canvas element context menu" >}}

## Canvas options

### Inline editing

The inline editing toggle lets you lock or unlock the canvas. When turned off the canvas becomes “locked”, freezing elements in place and preventing unintended modifications.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editing-toggle-9-2-0.mp4" max-width="750px" caption="Inline editing toggle demo" >}}

### Data links

Canvases support [data links](ref:data-links) for all elements except drone and button elements. You can add a data link by following these steps:

1. Enable inline editing.
1. Click the element you to which you want to add the data link.
1. In either the inline editor or panel editor, expand the **Selected element** editor.
1. Scroll down to the **Data links** section and expand it.
1. Click **Add link**.
1. In the dialog box that opens, enter a **Title**. This is a human-readable label for the link, which will be displayed in the UI.
1. Enter the **URL** or variable to which you want to link.

   To add a data link variable, click in the **URL** field and enter `$` or press Ctrl+Space or Cmd+Space to see a list of available variables.

1. If you want the link to open in a new tab, toggle the **Open in a new tab** switch.
1. Click **Save** to save changes and close the dialog box.
1. Disable inline editing.

If you add multiple data links, you can control the order in which they appear in the visualization. To do this, click and drag the data link to the desired position.

#### One-click data link

You can configure a canvas data link to open with a single click on the element. To enable this feature, follow these steps:

1. Enable inline editing.
1. Click the element to which you want to add the data link.
1. In either the inline editor or panel editor, expand the **Selected element** editor.
1. Scroll down to the **Data links** section and expand it.
1. In the **One-click** section, choose **Link**.
1. Disable inline editing.

The first data link in the list will be configured as your one-click data link. If you want to change the one-click data link, simply drag the desired data link to the top of the list.

{{< video-embed src="/media/docs/grafana/panels-visualizations/canvas-one-click-datalink-.mp4" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
