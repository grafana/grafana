+++
title = "Panel editor"
type = "docs"
[menu.docs]
identifier = "panel-editor"
weight = 200
+++

# Panel editor

This page describes the parts of the Grafana panel editor and links to where you can find more information.

{{< docs-imagebox img="/img/docs/panel-editor/panel-editor-7-0.png" class="docs-image--no-shadow" max-width="1500px" >}}

## Open the Panel editor

There are several ways to access the panel editor, also called the **Edit Panel** screen, _edit mode_, or _panel edit mode_:

- Click the **Add panel** icon at the top of the screen and then click **Add new panel**. The new panel opens in the panel editor. For detailed instructions on how to add a panel, refer to [Add a panel]({{< relref "add-a-panel.md" >}})
- Click the title of an existing panel and then click **Edit**. The panel opens in edit mode.
- Click anywhere on an existing panel and then press **e** on your keyboard. The panel opens in edit mode.

## Resize panel editor sections

Drag to resize sections of the panel editor. If the side pane becomes too narrow, then the Panel, Field, and Overrides tabs change to a dropdown list.

{{< docs-imagebox img="/img/docs/panel-editor/resize-panel-editor-panels-7-0.gif" class="docs-image--no-shadow" max-width="600px" >}}

## Parts of the panel editor

This section describes the parts of the panel editor screen and a bit about fields, options, or tasks associated with each part. Some sections in this page link to pages where sections or tasks are documented more fully.

### Header

The header section lists the name of the dashboard that the panel is in and some dashboard commands. You can also click the **Go back** arrow to return to the dashboard.

{{< docs-imagebox img="/img/docs/panel-editor/edit-panel-header-7-0.png" class="docs-image--no-shadow" max-width="1000px" >}}

On the right side of the header are the following options:

- **Dashboard settings (gear) icon -** Click to access the dashboard settings.
- **Discard -** Discards all changes you have made to the panel since you last saved the dashboard.
- **Save -** Saves the dashboard, including all changes you have made in the panel editor.
- **Apply -** Applies changes you made and then closes the panel editor, returning you to the dashboard. You will have to save the dashboard to persist the applied changes.


### Visualization preview

The visualization preview section contains viewing options, time range controls, the visualization preview, and (if applicable) the panel title, axes, and legend.

{{< docs-imagebox img="/img/docs/panel-editor/visualization-preview-7-0.png" class="docs-image--no-shadow" max-width="1200px" >}}

- **Fill -** The visualization preview will fill the available space in the preview part. If you change the width of the side pane or height of the bottom pane the visualisation will adapt to fill whatever space is available.
- **Fit -** The visualization preview will fill the available space in but preserve the aspect ratio of the panel.
- **Exact -** The visualization preview will have the exact size as the size on the dashboard. If not enough space is available, the visualization will scale down preserving the aspect ratio.
- **Time range controls -** For more information, refer to [Time range controls]({{< relref "../dashboards/time-range-controls.md" >}}).

### Data section (bottom pane)

The section contains tabs where you enter queries, transform your data, and create alert rules (if applicable).

{{< docs-imagebox img="/img/docs/panel-editor/data-section-7-0.png" class="docs-image--no-shadow" max-width="1200px" >}}

- **Query tab -** Select your data source and enter queries here. For more information, refer to [Queries]({{< relref "queries.md" >}}).
- **Transform tab -** Apply data transformations. For more information, refer to [Transformations]({{< relref "transformations.md" >}}).
- **Alert tab -** Write alert rules. For more information, refer to [Create alerts]({{< relref "../alerting/create-alerts.md" >}}).

### Panel and field configuration options (side pane)

The section contains tabs where you control almost every aspect of how your data is visualized. Not all tabs are available for each visualization.

Features in these tabs are documented in the following topics:

- [Add a panel]({{< relref "add-a-panel.md" >}}) describes basic panel settings.
- [Visualizations]({{< relref "visualizations/_index.md" >}}) display options vary widely. They are described in the individual visualization topic.
- [Field configuration options and overrides]({{< relref "field-configuration-options.md" >}}) allow you to control almost every aspect of your visualization, including units, value mappings, and [Thresholds]({{< relref "thresholds.md" >}}).
- [Panel links]({{< relref "../linking/panel-links.md" >}}) and [Data links]({{< relref "../linking/data-links.md" >}}) help you connect your visualization to other resources.
