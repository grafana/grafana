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
---

# Panel overview

The _panel_ is the basic visualization building block in Grafana.
Each panel has a query editor specific to the data source selected in the panel.
The query editor allows you to build a query that returns the data you want to visualize.

There are a wide variety of styling and formatting options for each panel.
Panels can be dragged, dropped, and resized to rearrange them on the dashboard.

Before you add a panel, ensure that you have configured a data source.

- For details about using data sources, refer to [Data sources][].

- For more information about managing data sources as an administrator, refer to [Data source management][].

  {{% admonition type="note" %}}
  [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/) is only available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
  {{% /admonition %}}

## Panel feature overview

The panel has the following features:

<!-- The following image and descriptions highlight all panel features. -->

<!-- {{< figure src="tbd" width="700px" alt="An annotated image of a panel" >}} -->

- **Panel title** - You can create your own panel titles or have Grafana create them for you using [generative AI features][].
- **Links** - Add [panel links][] to other dashboards, panels, or external sites.
- **Panel menu** - In the [panel menu](#panel-menu), access actions such as **View**, **Edit**, **Inspect**, and **Remove**.
- **Tooltips** - View [tooltips][] to get more information about data points.
- **Legend** - Change series colors, y-axis and series visibility directly from the [legend][].

## Panel menu

To access the panel editor, hover over the top-right corner of any panel. Click the panel menu icon that appears and select **Edit**. The panel menu gives you access to the following actions:

- **View**: View the panel in full screen.
- **Edit**: Open the panel editor to edit panel and visualization options.
- **Share**: Share the panel as a link, embed, or library panel.
- **Explore**: Open the panel in **Explore**, where you can focus on your query.
- **Inspect**: Open the **Inspect** drawer, where you can review the panel data, stats, metadata, JSON, and query.
  - **Data**: Open the **Inspect** drawer in the **Data** tab.
  - **Query**: Open the **Inspect** drawer in the **Query** tab.
  - **Panel JSON**: Open the **Inspect** drawer in the **JSON** tab.
- **Extensions**: Access other actions provided by installed applications, such as declaring an incident. Note that this option doesn't appear unless you have app plugins installed which contribute an [extension](https://grafana.com/developers/plugin-tools/ui-extensions/) to the panel menu.
- **More**: Access other panel actions.
  - **Duplicate**: Make a copy of the panel. Duplicated panels query data separately from the original panel. You can use the special `Dashboard` data source to [share the same query results across panels][share] instead.
  - **Copy**: Copy the panel to the clipboard.
  - **Create library panel**: Create a panel that can be imported into other dashboards.
  - **Create alert**: Open the alert rule configuration page in **Alerting**, where you can [create a Grafana-managed alert][create] based on the panel queries.
  - **Hide legend**: Hide the panel legend.
  - **Get help**: Send a snapshot or panel data to Grafana Labs Technical Support.
- **Remove**: Remove the panel from the dashboard.

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available specifically for panels. Press `?` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

By hovering over a panel with the mouse you can use some shortcuts that will target that panel.

- `e`: Toggle panel edit view
- `v`: Toggle panel fullscreen view
- `ps`: Open Panel Share Modal
- `pd`: Duplicate Panel
- `pr`: Remove Panel
- `pl`: Toggle panel legend

## Panel configuration

To configure panels, refer to the following sub topics:

- [Configure panel options][]
- [Configure standard options][]
- [Configure a legend][legend]
- [Configure tooltips][tooltips]
- [Configure data links][]
- [Configure value mappings][]
- [Configure thresholds][]
- [Configure field overrides][]

{{% docs/reference %}}
[generative AI features]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards#set-up-generative-ai-features-for-dashboards"
[generative AI features]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/manage-dashboards#set-up-generative-ai-features-for-dashboards"

[panel links]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links#panel-links"
[panel links]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links#panel-links"

[tooltips]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-tooltips"
[tooltips]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-tooltips"

[legend]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-legend"
[legend]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-legend"

[share]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data/share-query"
[share]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/share-query"

[create]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/alerting-rules/create-grafana-managed-rule#create-alerts-from-panels"
[create]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule#create-alerts-from-panels"

[Data source management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[Data source management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[Data sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources"
[Data sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources"

[Configure panel options]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-panel-options"
[Configure panel options]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-panel-options"

[Configure standard options]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options"
[Configure standard options]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options"

[Configure data links]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links"
[Configure data links]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links"

[Configure value mappings]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-value-mappings"
[Configure value mappings]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-value-mappings"

[Configure thresholds]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-thresholds"
[Configure thresholds]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-thresholds"

[Configure field overrides]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides"
[Configure field overrides]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides"
{{% /docs/reference %}}
