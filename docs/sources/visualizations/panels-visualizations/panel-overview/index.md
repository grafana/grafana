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

- **View**: View the panel in full screen.
- **Edit**: Open the panel editor to edit panel and visualization options.
- **Share**: Share the panel as a link, embed, or snapshot.
- **Explore**: Open the panel in **Explore**, where you can focus on your query.
- **Inspect**: Open the **Inspect** drawer, where you can review the panel data, stats, metadata, JSON, and query.
  - **Data**: Open the **Inspect** drawer in the **Data** tab.
  - **Query**: Open the **Inspect** drawer in the **Query** tab.
  - **Panel JSON**: Open the **Inspect** drawer in the **JSON** tab.
- **Time settings**: Opens the **Panel time settings** drawer where you can set panel-specific time options. Public preview. For more information, refer to [Panel time settings](#panel-time-settings).
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

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available specifically for panels. Press `?` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

By hovering over a panel with the mouse you can use some shortcuts that will target that panel.

- `e`: Toggle panel edit view
- `v`: Toggle panel full screen view
- `pu`: Share link
- `pe`: Share embed
- `ps`: Share snapshot
- `px`: Open panel in **Explore**
- `pd`: Duplicate Panel
- `i`: Inspect
- `pl`: Hide or show legend
- `pr`: Remove Panel

## Panel time settings

{{< docs/public-preview product="Panel time settings" featureFlag="`panelTimeSettings`" >}}

You can configure the following settings to control the time range for a panel:

| Option                | Description                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Panel time range      | Overrides the dashboard time range. Use one of the preset values or enter a custom value like `5m` or `2h`.                              |
| Time shift            | Adds a time shift relative to the dashboard or panel time range. Use one of the preset values or enter a custom value like `5m` or `2h`. |
| Time comparison       | <p>Compare data between two time ranges.</p><p>To try out this feature, enable the `timeComparison` feature toggle.</p>                  |
| Hide panel time range | Don't show the panel time range in the panel header.                                                                                     |

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

![Empty dashboard state](/media/docs/grafana/dashboards/screenshot-empty-dashboard-v13.0.png)

To add a panel to an existing dashboard, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click the **Add new element** icon (blue plus sign).

   {{< figure src="/media/docs/grafana/dashboards/screenshot-add-element-icon-v13.0.png" max-width="250px" alt="Add element icon" >}}

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
