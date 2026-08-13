---
keywords:
  - transform
  - query
  - panel
  - dashboard
  - rows
  - dynamic
  - add
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Panel overview
title: Panel overview
description: Learn about the features of the panel
weight: 15
aliases:
  - ../../panels-visualizations/panel-overview/ # /docs/grafana/next/panels-visualizations/panel-overview/
---

# Panel overview

A Grafana panel is a visual representation of data composed of a [query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/) and a [visualization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/visualizations/). Within panels, you can apply [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/transform-data/), which process the results of a query before they're passed on for visualization. You can also further customize a panel by formatting data and configuring visualization options.

Each panel has a query editor specific to the data source selected in the panel. The query editor allows you to build a query that returns the data you want to visualize.

Panels offer a wide variety of formatting and styling options, from applying colors based on field values to creating custom units. Each visualization also comes with options specific to it that give you further control over how your data is displayed. Panels can also be dragged, dropped, and resized to rearrange them on the dashboard.

To get started adding panels, ensure that you have configured a data source:

- For details about using data sources, refer to [Data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/).
- For more information about managing data sources as an administrator, refer to [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

  {{< admonition type="note" >}}
  [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/) is only available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
  {{< /admonition >}}

## Panel feature overview

The following image and descriptions highlight the panel features:

![Annotated panel with time series visualization](/media/docs/grafana/panels-visualizations/screenshot-panel-overview-ann-v11.0.png)

1. **Panel title** - You can create your own panel titles or have Grafana create them for you using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards).
1. **Panel description** - You can create your own panel descriptions or have Grafana create them for you using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards)
1. **Links** - Add [panel links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/#panel-links) to other dashboards, panels, or external sites.
1. **Panel menu** - In the [panel menu](#panel-menu), access actions such as **View**, **Edit**, **Inspect**, and **Remove**.
1. **Legend** - Change series colors, y-axis, and series visibility directly from the [legend](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-legend/).
1. **Tooltips** - View [tooltips](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-tooltips/) to get more information about data points.

## Panel menu

To access the panel editor, hover the cursor over the top-right corner of any panel.
Click the panel menu icon that appears and select **Edit**.

The panel menu also gives you access to several actions.
If an option is only available in view mode or edit mode, that's indicated:

- **View**: View the panel in full screen. Opens the [View panel sidebar](#view-mode-panel-controls) and displays controls for supported visualizations.
- **Edit**: Open the panel editor to edit panel and visualization options.
- **Share**: Share the panel as a link, embed, or snapshot.
- **Explore**: Open the panel in **Explore**, where you can focus on your query.
- **Inspect**: Open the **Inspect** drawer, where you can review the panel data, stats, metadata, JSON, and query.
  - **Data**: Open the **Inspect** drawer in the **Data** tab.
  - **Query**: Open the **Inspect** drawer in the **Query** tab.
  - **Panel JSON**: Open the **Inspect** drawer in the **JSON** tab.
- **Time settings**: Opens the **Panel time settings** drawer where you can set panel-specific time options. Public preview. For more information, refer to [Panel time settings](#panel-time-settings).
- **Styles**: Edit mode only. Copy and paste styles from one panel to another in the same dashboard. For more information, refer to [Copy and paste panel styles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/panel-editor-overview/#copy-and-paste-panel-styles).
- **Assistant**: View mode only. Access Grafana Assistant help options. This option is only available on Grafana Cloud.
- **Metrics drilldown**: Open the panel in the **Drilldown > Metrics** feature for further exploration. For more information, refer to [Metrics drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/simplified-exploration/metrics/).
- **Extensions**: View mode only. Access other actions provided by installed applications, such as declaring an incident. This option is only available in view mode and only appears if you have app plugins installed that contribute an [extension](https://grafana.com/developers/plugin-tools/key-concepts/ui-extensions) to the panel menu.
- **More**: Access other panel actions.
  - **Duplicate**: Edit mode only. Make a copy of the panel. Duplicated panels query data separately from the original panel. You can use the special `Dashboard` data source to [share the same query results across panels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/share-query/) instead.
  - **Copy**: Copy the panel to the clipboard.
  - **New library panel**: Edit mode only. Create a panel that can be imported into other dashboards.
  - **New alert rule**: Open the alert rule configuration page in **Alerting**, where you can [create a Grafana-managed alert](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#create-alerts-from-panels) based on the panel queries.
  - **Hide/Show legend**: Hide or show the panel legend.
  - **Get help**: Send a snapshot or panel data to Grafana Labs Technical Support.
- **Remove**: Edit mode only. Remove the panel from the dashboard.

## View mode panel controls

When you open a panel in full-screen view mode, Grafana displays a **View panel** sidebar with controls for adjusting the panel.
These controls make it easier to view specific data or identify patterns and correlations.
Because these controls exist in view mode, you don't need edit permissions to use these controls, and the changes you make don't affect the saved dashboard.

The sidebar includes the following controls:

- **Quick toggles**: Adjust common visualization options, such as legend visibility and basic graph styles.
- **Fan-out by series or label**: Split one graph into multiple graphs—one per series or label value. For example, if you see a latency spike across several series, fanning out by label helps you identify which services are causing it.

Available quick toggles and fan-out support depend on the visualization type.
This feature is supported for time series visualizations.

<!-- screenshot here: View panel mode with the View panel side pane open (Back to dashboard, Quick toggles, and Fan-out sections visible) -->

### Open the View panel controls

1. Hover over a panel and open the panel menu.
1. Select **View**.

   You can also press `v` while hovering over a panel.

On larger screens, the **View panel** side pane opens automatically.
On smaller screens, open it from the dashboard sidebar by clicking the **View panel controls** button.

To return to the dashboard, click **Back to dashboard** in the side pane, or use the dashboard breadcrumb.

### Quick toggles

The **Quick toggles** section exposes a subset of visualization options so you can change them while viewing the panel.

Which options appear depends on the visualization.
For **Time series**, the quick toggles include:

- **Visibility**: Show or hide the legend.
- **Placement**: Place the legend at the bottom or on the right.
- **Stack series**: Stack series in the graph.
- **Scale**: Change the axis scale (for example, linear or logarithmic).

<!-- screenshot here: Quick toggles section in the View panel side pane for a Time series panel -->

Other visualizations might not offer quick toggles yet.
If a visualization doesn't support them, the **Quick toggles** section doesn't appear.

### Fan-out by series or label

**Fan-out** splits one panel into multiple panels so you can compare series or label values side by side.
This is useful when a single graph has many series and you need to spot which series or label share an anomaly.

Fan-out is available for visualizations that enable it.
**Time series** supports fan-out.

In the **Fan-out by series or label** section, choose one of the following:

| Option | Description |
| --- | --- |
| **Disabled** | Show the original single panel. |
| **By series** | Create one panel per series. |
| A label name under **Labels** | Create one panel per value of that label (for example, `method` or `status`). |

If the panel data has no labels, Grafana shows **Data has no labels** under **Labels**.

<!-- screenshot here: Fan-out set to By series, with multiple panels rendered in view mode -->

<!-- screenshot here: Fan-out set to a label (for example, method), with panels grouped by label value -->

When you select a fan-out mode, Grafana updates the dashboard URL with a `fanout` query parameter so you can share the split view.
Leaving view mode removes that parameter.

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available specifically for panels. Press `?` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

By hovering over a panel with the mouse you can use some shortcuts that target that panel.

- `e`: Toggle panel edit view
- `v`: Toggle panel full screen view
- `pu`: Copy panel share link
- `pe`: Share embed
- `ps`: Share snapshot
- `px`: Open panel in **Explore**
- `pc`: Copy panel
- `pv`: Paste panel
- `pd`: Duplicate Panel
- `i`: Inspect
- `pl`: Hide or show legend
- `pr`: Remove Panel

## Panel time settings

{{< docs/public-preview product="Panel time settings" featureFlag="`panelTimeSettings`" >}}

You can configure the following settings to control the time range for a panel:

| Option                | Description                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panel time range      | Overrides the dashboard time range. Use one of the preset values or enter a custom value like `5m` or `2h`.                                                              |
| Time shift            | Adds a time shift relative to the dashboard or panel time range. Use one of the preset values or enter a custom value like `5m` or `2h`.                                 |
| Time comparison       | <p>Compare data between two time ranges. Applied after **Time shift** when used together.</p><p>To try out this feature, enable the `timeComparison` feature toggle.</p> |
| Hide panel time range | Don't show the panel time range in the panel header.                                                                                                                     |

## Pan and zoom panel time range

You can pan the panel time range left and right, and zoom it and in and out.
This, in turn, changes the dashboard time range.

This feature is supported for the following visualizations:

- Candlestick
- Heatmap
- State timeline
- Status history
- Time series

### Zoom in

Click and drag on the panel to zoom in on a particular time range.

The following screen recordings show this interaction in the time series and candlestick visualizations:

Time series

{{< video-embed src="/media/docs/grafana/panels-visualizations/recording-ts-time-zoom-in-mouse.mp4" >}}

Candlestick

{{< video-embed src="/media/docs/grafana/panels-visualizations/recording-candle-panel-time-zoom-in-mouse.mp4" >}}

### Zoom out

Double-click anywhere on the panel to zoom out the time range.

The range doubles with each double-click, adding equal time to each side of the range.
For example, if the original time range is from 9:00 to 9:59, the time range changes as follows with each double-click:

- Next range: 8:30 - 10:29
- Next range: 7:30 - 11:29

The following screen recordings demonstrate the preceding example in the time series and heatmap visualizations:

Time series

{{< video-embed src="/media/docs/grafana/panels-visualizations/recording-ts-time-zoom-out-mouse.mp4" >}}

Heatmap

{{< video-embed src="/media/docs/grafana/panels-visualizations/recording-heatmap-panel-time-zoom-out-mouse.mp4" >}}

### Pan

Click and drag the x-axis area of the panel to pan the time range.

The time range shifts by the distance you drag.
For example, if the original time range is from 9:00 to 9:59 and you drag 30 minutes to the right, the time range changes to 9:30 to 10:29.

The following screen recordings show this interaction in the time series visualization:

Time series

{{< video-embed src="/media/docs/grafana/panels-visualizations/recording-ts-time-pan-mouse.mp4" >}}

## Add a panel

To add a panel to an empty dashboard, click or drag the panel onto the dashboard:

![Empty dashboard state](/media/docs/grafana/dashboards/screenshot-empty-dashboard-v13.1.png)

To add a panel to an existing dashboard, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click the **Add new element** icon (blue plus sign).

   {{< figure src="/media/docs/grafana/dashboards/screenshot-add-element-icon-v13.1.png" max-width="250px" alt="Add element icon" >}}

1. Click or drag a panel onto the dashboard.

## Panel configuration

To configure panels, refer to the following subtopics:

- [Configure panel options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-panel-options/)
- [Configure standard options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-standard-options/)
- [Configure a legend](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-legend/)
- [Configure tooltips](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-tooltips/)
- [Configure data links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-data-links/)
- [Configure value mappings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-value-mappings/)
- [Configure thresholds](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-thresholds/)
- [Configure field overrides](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-overrides/)
