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

## Configure a canvas visualization

The following video shows you how to create and configure a canvas visualization:

{{< youtube id="b7AYKoFcPpY" >}}

## Supported data formats

The canvas visualization is unique in that it doesn't have any specific data requirements. You can even start adding and configuring visual elements without providing any data. However, any data you plan to consume should be accessible through supported Grafana data sources and structured in a way that ensures smooth integration with your custom elements.

If your canvas is going to update in real time, your data should support refreshes at your desired intervals without degrading the user experience.

You can tie [Elements](#elements) and [Connections](#connections) to data through options like text, colors, and background pattern images, etc. available in the canvas visualization.

## Elements

Elements are the basic building blocks of a canvas and they help you visualize data with different shapes and options. You can rotate and move elements around the canvas. When you move elements, snapping and alignment guides help you create more precise layouts.

Add elements in the [Layer](#layer-options) section of canvas options.

{{% admonition type="note" %}}
Element snapping and alignment only works when the canvas is not zoomed in.
{{% /admonition %}}

### Element types

When you select an element that you've added to a canvas, you can access [configuration options](#selected-element-options) for it that are dependent on the element type.

The following sections describe the different elements available.

{{< column-list >}}

- [Metric value](#metric-value)
- [Text](#text)
- [Ellipse](#basic-shapes)
- [Rectangle](#basic-shapes)
- [Icon](#icon)
- [Server](#server)
- [Triangle](#basic-shapes)
- [Cloud](#basic-shapes)
- [Parallelogram](#basic-shapes)
- [Button](#button)

{{< /column-list >}}

#### Basic shapes

A basic shape element can display text (both fixed and field data) and its background color can be changed based on data thresholds. You can add the following basic shapes to a canvas:

- Cloud
- Ellipse
- Parallelogram
- Rectangle
- Triangle

#### Metric value

The metric value element lets you select the data you want to display on a canvas. This element has a unique “edit” mode that can be triggered either through the context menu “Edit” option or by double clicking. When in edit mode you can select which field data that you want to display.

#### Text

The text element lets you add text to the canvas. The element also supports an editing mode, triggered via either double clicking or the edit menu option in the context menu.

#### Icon

The icon element lets you add a supported icon to the canvas. Icons can have their color set based on thresholds or value mappings.

##### Add a custom icon

You can add a custom icon by referencing an SVG file. To add a custom icon, follow these steps:

1. Under **Icon > SVG Path**, if it's not already selected, select **Fixed** as your file source.
1. Click **Select a value** in the field below.
1. In the dialog box that opens, click the **URL** tab.
1. Enter the URL in the field below the **URL** tab.

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-canvas-custom-image-v11.3.png" max-width="250px" alt="Add a custom image URL" >}}

1. Click **Select**.
1. (Optional) Add a background image to your icon with the **Background (icon)** option by following the steps to [add a custom image](#add-custom-images-to-elements).

If you don't have an SVG file, you can use a rectangle element instead of an icon and set its background image to an image file type. To add a custom image for another element type, follow the steps to [add a custom image](#add-custom-images-to-elements).

#### Server

The server element lets you easily represent a single server, a stack of servers, a database, or a terminal. Server elements support status color, bulb color, and a bulb blink rate all configurable by fixed or field values.

{{< figure src="/media/docs/grafana/canvas-server-element-9-4-0.png" max-width="650px" alt="Canvas server element" >}}

#### Button

The button element lets you add a basic button to the canvas. Button elements support triggering basic, unauthenticated API calls. [API settings](#button-api-options) are found in the button element editor. You can also pass template variables in the API editor.

{{% admonition type="note" %}}
A button click will only trigger an API call when [inline editing](#inline-editing) is disabled.
{{% /admonition %}}

{{< video-embed src="/media/docs/grafana/2023-20-10-Canvas-Button-Element-Enablement-Video.mp4" max-width="650px" alt="Canvas button element demo" >}}

{{< docs/play title="Canvas Visualization: Buttons" url="https://play.grafana.org/d/c9ea65f5-ed5a-45cf-8fb7-f82af7c3afdf/" >}}

##### Button API options

The following options let you configure basic, unauthenticated API calls:

<!-- prettier-ignore-start -->
| Option  | Description  |
| ------- | ------------ |
| Endpoint | Enter the endpoint URL. |
| Method | Choose from **GET**, **POST**, and **PUT**. |
| Content-Type | Select an option in the drop-down list. Choose from: JSON, Text, JavaScript, HTML, XML, and x-www-form-urlencoded. |
| Query parameters | Enter as many **Key**, **Value** pairs as you need. |
| Header parameters | Enter as many **Key**, **Value** pairs as you need. |
| Payload | Enter the body of the API call. |

<!-- prettier-ignore-end -->

### Add custom images to elements

You can add custom background images to all elements except **Button** by referencing an image URL.
The image must be hosted at a URL that allows requests from your Grafana instance.

To upload a custom image, follow these steps:

1. Under **Background (\<ELEMENT TYPE\>)**, if it's not already selected, select **Fixed** as your image source.

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-canvas-custom-image-src-v11.3.png" max-width="300px" alt="Custom image source selection" >}}

1. Click **Select a value** in the field below.
1. In the dialog box that opens, click the **URL** tab.
1. Enter the URL in the field below the **URL** tab.

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-canvas-custom-image-v11.3.png" max-width="250px" alt="Add a custom image URL" >}}

1. Click **Select**.

## Connections

When building a canvas, you can connect elements together to create more complex visualizations. You can also create connections to the background of the canvas.

To create a connection, follow these steps:

1. In the panel edit pane, expand the **Canvas** options section.
1. Toggle on the **Inline editing** switch.
1. Hover the cursor over an element you want to connect to display the connection anchors:

   ![Element with connection anchors displayed](/media/docs/grafana/panels-visualizations/screenshot-connection-anchors-v11.3.png)

1. Drag the cursor from a connection anchor on that element to one on another element.

To remove a connection, click the connection and then press the `Delete` or `Backspace` key.

### Connection adjustments

You can adjust connections, adding angles to them, to fit the canvas you're working in. When you move connected elements, the connection resizes to fit the space.

- To adjust a connection, click it to display the midpoint controls and move those as needed.
- To make a connection a straight line again, move the midpoint back until the midpoint controls disappear.

If you move a connection so that it's almost a right angle or a straight line, the connection snaps into that angle or into a straight line.

### Connection styles

You can set the size, color, direction, and style of connections based on fixed or field values. To do so, enter into panel edit mode, select the connection, and modify the connection's properties in the panel editor. For more information on connection styles, refer to [Selected connection options](#selected-connection-options).

{{< youtube id="0iO2gqv0XNA" >}}

## Canvas editing

You can make changes to a canvas visualization while in the context of the dashboard, or in dashboard mode. The following sections describe the editing options available in dashboard mode.

### Inline editor

You can edit your canvas inline while in dashboard mode. The inline editor menu displays the options relevant to the part of the canvas that you've selected. You can also move the editor window around.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editor-9-2-0.mp4" max-width="750px" alt="Inline editor demo" >}}

### Context menu

The context menu lets you perform common tasks quickly and efficiently. Supported functionality includes opening and closing the inline editor, duplicating an element, deleting an element, and more.

The context menu is triggered by a right click action over the panel or over a given canvas element. When right clicking the panel, you are able to set a background image and easily add elements to the canvas.

{{< figure src="/static/img/docs/canvas-panel/canvas-panel-context-menu-9-3-0.png" max-width="350px" alt="Canvas panel context menu" >}}

When right clicking an element, you are able to edit, delete, duplicate, and modify the element's layer positioning.

{{< figure src="/static/img/docs/canvas-panel/canvas-context-menu-9-2-0.png" max-width="250px"  alt="Canvas element context menu" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Canvas options

#### Inline editing

The inline editing toggle lets you lock or unlock the canvas. When turned off the canvas becomes “locked”, freezing elements in place and preventing unintended modifications.

{{< video-embed src="/static/img/docs/canvas-panel/canvas-inline-editing-toggle-9-2-0.mp4" max-width="750px" alt="Inline editing toggle demo" >}}

#### Experimental Element types

Toggle the switch to include experimental element types in the available selections.

#### Pan and zoom

You can enable panning and zooming in a canvas. This allows you to both create and navigate more complex designs.

{{< docs/public-preview product="Canvas pan and zoom" featureFlag="`canvasPanelPanZoom`" >}}

{{< video-embed src="/media/docs/grafana/2024-01-05-Canvas-Pan-&-Zoom-Enablement-Video.mp4" max-width="750px" alt="Canvas pan and zoom enablement video" >}}

##### Infinite panning

You can enable infinite panning in a canvas when pan and zoom is enabled. This allows you to pan and zoom the canvas and uncover larger designs.

{{% admonition type="note" %}}
Infinite panning is an experimental feature that may not work as expected in all scenarios. For example, elements that are not top-left constrained may experience unexpected movement when panning.
{{% /admonition %}}

### Layer options

The **Layer** options let you add elements to the canvas and control its appearance:

- [Elements](#elements-layer)
- [Background](#background-canvas)
- [Border](#border-canvas)

#### Elements (layer)

Use the **Add item** button to open the [element type](#element-types) drop-down list. Elements are listed in the reverse order that you add them to the canvas:

![Canvas elements added in the Layer options](/media/docs/grafana/panels-visualizations/screenshot-canvas-elements-v11.3.png)

By default, elements have numbered names, like "Element 1", and those numbers correspond to the order in which the elements were added, but you can [change the default names](#rename-an-element).

You can also take the following actions on elements:

- Change the order of elements by clicking and holding the row of the element while moving it up and down in the element list.
- Duplicate or remove elements by clicking the icons on the element row.
- Access the element editing options by clicking the element row. This displays the [Selected element](#selected-element-options) section of options. Click **Clear selection** to remove the element from focus and stop displaying that section of options.

##### Rename an element

To update the name of an element, follow these steps:

1. Hover the cursor over the element name so the **Edit layer name** (pencil) icon is displayed.
1. Click the **Edit layer name** icon.
1. Enter a new name.
1. Click outside of the name field.

#### Background (canvas)

Use the following options to control the background of the canvas:

| Option     | Description                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Color      | Set the background color.                                                                                 |
| Image      | Use one of the provided background images or [add your own custom image](#add-custom-images-to-elements). |
| Image size | Control the size of the image or set it as a tile.                                                        |

#### Border (canvas)

Use the following options to control the border of the canvas:

| Option | Description                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------- |
| Width  | Set the border width in pixels.                                                                 |
| Color  | Set the border color. This option is only displayed when the border width is greater than zero. |
| Radius | Add rounded corners to the border and control the degree of curve.                              |

### Selected element options

The following options allow you to control the appearance of the element you've selected. To access an element so that you can edit it, expand the **Layer** section and select the desired element.

| Option                                      | Description                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Element type](#element-type)               | Change the selected element type.                                                               |
| [Element](#element)                         | Control the appearance of text on the element. This section is named based on the element type. |
| [Layout](#layout)                           | Control the placement of elements on the canvas.                                                |
| [Background (element)](#background-element) | Set the background of the element.                                                              |
| [Border (element)](#border-element)         | Set the border of the element.                                                                  |
| [Data links](#data-links)                   | Configure data links for elements.                                                              |

#### Element type

You can change element type by making a new selection in the drop-down list:

![Cursor on the element type selection drop-down](/media/docs/grafana/panels-visualizations/screenshot-element-type-select-v11.3.png)

#### Element

This section is named based on the element type. Control the appearance of text on the element with the following options:

<!-- prettier-ignore-start -->

| Option         | Description                                               |
| -------------- | --------------------------------------------------------- |
| Style          | Buttons only. Select an option in the **Variant** drop-down list to indicate what kind of action the button initiates. Choose from **primary**, **secondary**, **success**, and **destructive**. |
| Text           | Select a **Source**. Choose from **Fixed** or **Field**. If you selected **Fixed**, enter text in the **Value** field. If you selected **Field**, choose the field. |
| Text color     | Choose a text color.     |
| Align text     | Set the horizontal alignment of text within the element. Choose from **Left**, **Center**, and **Right**.  |
| Vertical align | Set the vertical alignment of the text within the element. Choose from **Top**, **Middle**, and **Bottom**. |
| Text size      | Set the text size. Leave the field empty to allow Grafana to automatically set the text size. |
| API      | Buttons only. Configure API options. For more information, refer to [Button API options](#button-api-options).   |

<!--prettier-ignore-end -->

<!-- prettier-ignore-start -->

Icons don't have text, so they have different options:

| Option         | Description                                               |
| -------------- | --------------------------------------------------------- |
| SVG Path     | Choose whether the icon SVG file source is **Fixed** or **Field**. If you selected **Fixed**, choose a provided option or [add a custom icon](#add-a-custom-icon). If you selected **Field**, choose a field. |
| Fill color     | Choose a fill color for the icon.   |

<!--prettier-ignore-end -->

#### Layout

Control the placement of elements on the canvas with the following options:

<!-- prettier-ignore-start -->

| Option          | Description     |
| --------------- | --------------- |
| Quick placement | Select an alignment option to automatically place the element. Choose from:<ul><li>Align left</li><li>Align horizontal centers</li><li>Align right</li><li>Align top</li><li>Align vertical centers</li><li>Align bottom</li></ul> |
| Constraints     | Set element constraints. Choose from: **Left**, **Right**, **Left & Right**, **Center**, and **Scale**.<br></br>Use the **Scale** option to ensure that elements are automatically resized when the panel size changes. |
| Position        | Use these settings to manually set the position of an element. Set any or all of the following options: **top**, **left**, **width**, **height**, and **rotation**. |

<!-- prettier-ignore-end -->

#### Background (element)

Use the following options to set the background of the element:

- **Color** - Set the background color.
- **Image** - Use one of the provided background images or [add your own custom image](#add-custom-images-to-elements).

This option doesn't apply to the button element.

#### Border (element)

Use the following options to set the border of the element:

- **Width** - Set the border width in pixels.
- **Color** - Set the border color. This option is only displayed when the border width is greater than zero.
- **Radius** - Add rounded corners to the element border and control the degree of curve.

#### Data links

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

##### One-click data link

You can configure a canvas data link to open with a single click on the element. To enable this feature, follow these steps:

1. Enable inline editing.
1. Click the element to which you want to add the data link.
1. In either the inline editor or panel editor, expand the **Selected element** editor.
1. Scroll down to the **Data links** section and expand it.
1. In the **One-click** section, choose **Link**.
1. Disable inline editing.

The first data link in the list will be configured as your one-click data link. If you want to change the one-click data link, simply drag the desired data link to the top of the list.

{{< video-embed src="/media/docs/grafana/panels-visualizations/canvas-one-click-datalink-.mp4" >}}

### Selected connection options

You can style the selected connection using the following options:

- **Color** - Set the connection color.
- **Size** - Control the size of the connection by entering a number in the **Value** field.
- **Radius** - Add curve to the connection by entering a value to represent the degree.
- **Arrow Direction** - Control the appearance of the arrow head. Choose from:

  - **Forward** - The arrow head points in the direction in which the connection was drawn.
  - **Reverse** - The arrow head points in the opposite direction of which the connection was drawn.
  - **Both** - Adds arrow heads to both ends of the connection.
  - **None** - Removes the arrow head.

- **Line style** - Choose from the following line styles: **Solid**, **Dashed**, and **Dotted**.

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}
