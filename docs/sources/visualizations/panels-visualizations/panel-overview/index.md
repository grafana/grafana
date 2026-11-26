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
1. **Actions tooltip** - Hover over the panel to display the [actions tooltip](#actions-tooltip), where you can access actions such as **Edit visualization**, **Explore**, **Expand**, and the panel menu.
1. **Legend** - Change series colors, y-axis, and series visibility directly from the [legend](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-legend/).
1. **Tooltips** - View [tooltips](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-tooltips/) to get more information about data points.

## Actions tooltip

The actions tooltip puts the most common panel actions one click away, in both view and edit mode.

To display the actions tooltip, do one of the following:

- Hover your cursor over any part of a panel.
- Use the `Tab` key to move keyboard focus into a panel.
- On a touch device, tap the panel. Tap outside the panel to close the tooltip.

The tooltip is displayed above the top-right corner of the panel.
Hover your cursor over an icon to display its name and keyboard shortcut.
The available actions depend on the dashboard mode:

<!-- prettier-ignore-start -->

| Action | View mode | Edit mode | Description |
| ------ | --------- | --------- | ----------- |
| **Quick edits** | No | Yes | Displays the quick edits for the panel, so you can change its most common options without opening the panel editor. Only displayed for visualizations that support quick edits. For more information, refer to [Change common panel options with quick edits](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#change-common-panel-options-with-quick-edits). |
| **Edit visualization** | Yes | Yes | Opens the panel editor. In view mode, this also switches the dashboard to edit mode. Only displayed if you can edit the dashboard. |
| **Explore** | Yes | No | Opens the panel query in **Explore**. Because this is a link, you can open it in a new browser tab. |
| **Panel settings** | No | Yes | Opens high-level panel options in the sidebar. |
| **Duplicate** | No | Yes | Adds a copy of the panel next to the original one. Duplicated panels query data separately from the original panel. You can use the special `Dashboard` data source to [share the same query results across panels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/share-query/) instead. |
| **Remove** | No | Yes | Removes the panel from the dashboard, after you confirm. |
| **Expand** or **Restore size** | Yes | Yes | Expands the panel to fill the window and opens the [View panel sidebar](#view-mode-panel-controls) for supported visualizations, or returns an expanded panel to its original size. |
| **More actions** | Yes | Yes | Opens the [panel menu](#panel-menu). |

<!-- prettier-ignore-end -->

Keep the following actions tooltip behavior in mind:

- **Untitled panels**: The tooltip also displays the panel description, links, and alert state, which untitled panels don't have a header to show. In edit mode, it also displays the drag handle that you use to move the panel.
- **Repeated panels**: **Edit visualization**, **Duplicate**, and **Remove** are disabled. Hover your cursor over them to see why.
- **Multiple selected panels**: In edit mode, when you hover your cursor over one of several selected panels, the tooltip displays the [bulk actions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#group-and-delete-multiple-panels-with-bulk-actions) instead.
- **Keyboard navigation**: Press `Escape` to close the tooltip and return focus to the panel.
- **Public and embedded dashboards**: Public dashboards and embedded dashboards don't display the actions tooltip.

## Panel menu

To open the panel menu, hover your cursor over any part of a panel to display the actions tooltip, and then click **More actions**.

The panel menu gives you access to more panel actions.
If an option is only available in view mode or edit mode, that's indicated:

- **Share**: Share the panel as a link, embed, or snapshot.
- **Group by…**: Group the panel data by a key. This option is only available if the dashboard has a [Filter and Group by](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/filter-group-by/) control with grouping enabled.
- **Explore**: Edit mode only. Open the panel in **Explore**, where you can focus on your query. In view mode, click **Explore** in the actions tooltip instead.
- **Inspect**: Open the **Inspect** drawer, where you can review the panel data, stats, metadata, JSON, and query.
  - **Data**: Open the **Inspect** drawer in the **Data** tab.
  - **Query**: Open the **Inspect** drawer in the **Query** tab.
  - **Panel JSON**: Open the **Inspect** drawer in the **JSON** tab.
- **Time settings**: Opens the **Panel time settings** drawer where you can set panel-specific time options. For more information, refer to [Panel time settings](#panel-time-settings).
- **Styles**: Edit mode only. Copy and paste styles from one panel to another in the same dashboard. For more information, refer to [Copy and paste panel styles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/panel-editor-overview/#copy-and-paste-panel-styles).
- **Assistant**: View mode only. Access Grafana Assistant help options. This option is only available on Grafana Cloud.
- **Metrics drilldown**: Open the panel in the **Drilldown > Metrics** feature for further exploration. For more information, refer to [Metrics drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/simplified-exploration/metrics/).
- **Extensions**: View mode only. Access other actions provided by installed applications, such as declaring an incident. This option is only available in view mode and only appears if you have app plugins installed that contribute an [extension](https://grafana.com/developers/plugin-tools/key-concepts/ui-extensions) to the panel menu.
- **More**: Access other panel actions.
  - **Copy**: Copy the panel to the clipboard. For repeated panels, this option is labeled **Copy repeated panel**, and it copies the original panel with its repeat options.
  - **New library panel**: Edit mode only. Create a panel that can be imported into other dashboards.
  - **New alert rule**: Open the alert rule configuration page in **Alerting**, where you can [create a Grafana-managed alert](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#create-alerts-from-panels) based on the panel queries.
  - **Hide/Show legend**: Hide or show the panel legend.
  - **Get help**: Send a snapshot or panel data to Grafana Labs Technical Support.
- **Add to notebook**: Add a copy of the panel to a new or existing notebook. This option is only available when notebooks are enabled and you have permission to edit or create notebooks. For more information, refer to [Add a panel from a dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/notebooks/#add-a-panel-from-a-dashboard).

## View mode panel controls

{{< admonition type="note" >}}
View panel sidebar is currently in public preview. Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

This feature is enabled by default. To turn it off, disable the `viewPanelPane` feature toggle in your Grafana configuration file or contact Support.
{{< /admonition >}}

When you open a panel in full-screen view mode, Grafana displays a **View panel** sidebar with controls for adjusting the panel.
These controls make it easier to view specific data or identify patterns and correlations.
Because these controls exist in view mode, you don't need edit permissions to use them, and the changes you make don't affect the saved dashboard.

After you close the sidebar, it stays closed when you view a panel again.
Select **View panel controls** in the toolbar to reopen it and turn automatic opening back on.

The sidebar includes the following controls:

- **Quick toggles**: Adjust common visualization options, such as legend visibility and basic graph styles.
- **Fan-out by series or label**: Split one graph into multiple graphs per series or label value. This is useful when a single graph has many series and you need to spot which series or labels share an anomaly.

{{< figure src="/media/docs/grafana/dashboards/screenshot-view-panel-sidebar-2-v13.2.png" max-width="750px" alt="Panel in view mode with sidebar" >}}

{{< admonition type="note" >}}
This feature is supported for time series visualizations.
If it's added to more visualizations, available quick toggles and fan-out support will depend on the visualization type.
{{< /admonition >}}

### Fan-out by series or label

Fan-out splits one panel into multiple panels so you can compare series or label values side by side.
This is useful when a single graph has many series and you need to spot which series or labels share an anomaly.

In the **Fan-out by series or label** section, choose one of the following:

| Option        | Description                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| **Disabled**  | Show the original single panel.                                                       |
| **By series** | Create one panel per series.                                                          |
| **Labels**    | Create one panel per value of the selected label (for example, `method` or `status`). |

If the panel data has no labels, Grafana shows **Data has no labels** under **Labels**.

{{< figure src="/media/docs/grafana/dashboards/screenshot-view-panel-sidebar-v13.2.png" max-width="750px" caption="Panel in view mode with fan-out applied to series" >}}

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

You can configure the following settings to control the time range for a panel:

| Option                         | Description                                                                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel time range               | Overrides the dashboard time range. Use one of the preset values or enter a custom value like `5m` or `2h`.                                                                                                                                                     |
| Time shift                     | Adds a time shift relative to the dashboard or panel time range. Use one of the preset values or enter a custom value like `5m` or `2h`.                                                                                                                        |
| Time comparison                | Compares data with an earlier time range, such as the day or week before. Applied after **Time shift** when used together.                                                                                                                                      |
| Comparison tooltip delta color | Colors the change between the original and comparison values in the tooltip. An increase is green with **Standard**, red with **Inverted**, or the series color with **Same as value**. Only shown for time series visualizations with **Time comparison** set. |
| Hide panel time range          | Don't show the panel time range in the panel header.                                                                                                                                                                                                            |

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

To add a panel to an empty dashboard, click **+ Add visualization**:

![Empty dashboard state](/media/docs/grafana/dashboards/screenshot-empty-dashboard-v13.3.png)

To add a panel to an existing dashboard, follow these steps:

1. Select **Editing** in the dashboard mode drop-down list.
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
