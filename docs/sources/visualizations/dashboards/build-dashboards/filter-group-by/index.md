---
aliases:
  - ../../../variables/add-ad-hoc-filters/ # /docs/grafana/next/variables/add-ad-hoc-filters/
  - ../../../variables/variable-types/add-ad-hoc-filters/ # /docs/grafana/next/variables/variable-types/add-ad-hoc-filters/
keywords:
  - panel
  - dashboard
  - create
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Filter and Group by
description: Learn how to add filter and group by controls to dynamically filter and group data across your Grafana dashboard.
weight: 4
---

# Filter and group by controls

<!-- vale Grafana.WordList = NO -->
<!-- vale Grafana.Spelling = NO -->

{{< admonition type="note" >}}
The **Filter and Group by** feature renames the **Ad hoc filters** variable and extends it by adding grouping for Prometheus and Loki data sources.
However, in the dashboard schema, it's still referred to as `"kind": "AdhocVariable"`.
{{< /admonition >}}

<!-- vale Grafana.WordList = YES -->
<!-- vale Grafana.Spelling = YES -->

The **Filter and Group by** option is one of the most complex and flexible dashboard controls available.
Instead of creating a variable for each dimension by which you want to filter, it automatically queries your data source for available dimensions and lets users add or remove filters and group by dimensions on the dashboard dynamically.
This allows you to quickly apply filters dashboard-wide.

The group by function allows you to then group data by keys, letting you split it up.
This function is typically used with aggregation queries, such as `sum(your_metric_here)`, to split aggregated results by the selected dimensions.
Then, you can use filters within panels to filter data in or out, drilling down further into the data.

The filter and group by feature lets you add label/value filter pairs that are automatically added to all queries that use the specified data source.
Unlike variables, you don't use these filters in queries.
Instead, you use them to write filters for existing queries.

The following data sources support filters.
Data sources with an asterisk also support the group by function:

- Prometheus\*
- Loki\*
- InfluxDB
- Elasticsearch
- OpenSearch.
- Special Dashboard data source - Use this special data source to [apply filters to data from unsupported data sources](#filter-any-data-using-the-dashboard-data-source).

## Add filters and group by controls

{{< shared id="add-filter-group-by" >}}

<!-- prettier-ignore-start -->

To add filters and group by controls, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Filter and Group by**.
1. Enter a **Name** for the filter.
1. (Optional) In the **Label** field, enter the display name for the filter drop-down list.

   If you don't enter a display name, then the drop-down list label is the filter name.

1. (Optional) In the **Description** field, enter a description of the filter. The description appears as an info icon tooltip next to the filter name on the dashboard.

   Descriptions support links. You can use Markdown-style links (`[link text](https://example.com)`) or paste bare URLs (`https://example.com`). Only `http` and `https` URLs are rendered as clickable links—other protocols are displayed as plain text.

1. Choose a **Display** option:
   - **Above dashboard**: The filter drop-down list displays above the dashboard with the filter **Name** or **Label** value. This is the default.
   - **Above dashboard, label hidden**: The filter drop-down list displays above the dashboard, but without showing the name of the filter.
   - **Controls menu**: The filter is displayed in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.
   - **Hidden**: No filter drop-down list is displayed on the dashboard.

1. Under the **Filter options** section of the page, set the following options:

   | Option                    | Description                 |
   | ------------------------- | --------------------------- |
   | Data source               | Select a target data source in the drop-down list. You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only). For more information about data sources, refer to [Add a data source](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/).                 |
   | Default filters           | Set a default key/value pair. Optional. In the dashboard filter control, the default value is indicated with an information icon.|
   | Enable group by           | This option only appears if you selected a Prometheus or Loki data source. Toggle the switch on to enable data grouping. |
   | Default group by          | Set a default key for the dashboard. Optional. In the dashboard filter control, the default value is indicated with an information icon.                                         |
   | Use static key dimensions | To provide the filter dimensions as comma-separated values (CSV), toggle the switch on, and then enter the values in the space provided. Optional.                                       |
   | Allow custom values       | Toggle the switch on to allow dashboard users to add custom values to the filter and group by lists. Optional. |

1. Click **Save**.
1. Enter an optional description of your dashboard changes, and then click **Save**.
1. Click **Exit edit**.

<!-- prettier-ignore-end -->

{{< /shared >}}

Now you can filter and group data on the dashboard.

You can remove and reset default filters and group by dimensions, and see your recent ones:

{{< figure src="/media/docs/grafana/dashboards/screenshot-reset-default-v13.0.png" max-width="500px" alt="Dashboard with the filters and group by selections" caption="_Reset default filters and group by selections_" >}}

{{< figure src="/media/docs/grafana/screenshot-filters-group-recent-v13.0.png" max-width="500px" alt="Dashboard with the filters and group by selections" caption="_Recent filters and group by dimensions_" >}}

To see all active filters and group by dimensions across the dashboard all at once, click the **Filters overview** icon (filter) in the toolbar to open an overview.
The overview lets you search for specific keys, and adjust them, without scrolling through the dashboard controls:

{{< figure src="/media/docs/grafana/screenshot-filters-overview-v12.0.png" max-width="500px" alt="Dashboard with the filters and group by dimensions" >}}

Add an operator and value for a key to add it as a filter or select the **Group by** checkbox to set a group by dimension.
You can use a key for both a filter and a group by.

### Group and filter from the panel

When the **Group by** switch is toggled on, you can also set a group by dimension from a panel rather than from the dashboard-level control.
Hover the cursor over any panel using the data source of the filter to show the **Group by** selector:

{{< figure src="/media/docs/grafana/dashboards/screenshot-panel-groupby-v13.0.png" max-width="550px" alt="Group by control on a panel" >}}

This can be helpful when you're working with a panel that's far away from the dashboard controls.
Your selection is applied to the all the panels in the dashboard with the same data source.

You can also further filter a time series panel, which allows you to drill down further into your data.
After setting your group by dimension and splitting your data, click on a series in a panel and click **Filter on this value** or **Filter out this value**.
This filters by the labels found on that series, which are related to the already set group by dimensions.

To enable this functionality, you need to add one or more overrides for the panel.
In the following example, the override:

- Adds a regular expression, so that all fields are filterable
- Enables the **Filterable** switch

{{< figure src="/media/docs/grafana/dashboards/screenshot-panel-filter-override-v13.1.png" max-width="400px" alt="Field override making all fields filterable" >}}

However, you can create overrides to address specific fields.
You can also do this programmatically by returning the data frame with the appropriate `filterable` property on the desired fields.

With the override in place, you can click a series on a time series panel and filter it in or out.
The new filter is shown in the dashboard filter control and the it's applied to the whole dashboard.

{{< figure src="/media/docs/grafana/dashboards/screenshot-panel-filters-v13.0.png" max-width="675px" alt="Panel with tooltip open showing options to filter on a value or filter it out" >}}

Now you can filter data on the dashboard.

## Advanced filtering

After you've added filters to a dashboard, you can use them in several ways to explore and refine your data.
The following sections explain how to filter data from unsupported data sources, apply filters directly from visualizations, and preserve filters when navigating between panels.

### Filter any data using the Dashboard data source

In cases where a data source doesn't support the use of filters, you can use the Dashboard data source to reference that data, and then filter it in a new panel.
This allows you to bypass the limitations of the data source in the source panel.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-dashboard-ds-v12.2.png" max-width="750px" alt="The query section of a panel with the Dashboard data source configured" >}}

To use filters on data from an unsupported data source, follow these steps:

1. Navigate to the dashboard with the panel with the data you want to filter.
1. Click **Edit** in top-right corner of the dashboard.
1. Click the **Add new element** icon and click or drag a panel onto the dashboard.
1. Click **Configure visualization**.
1. In the **Queries** tab of the edit panel view, enter `Dashboard` in the **Data source** field and select **-- Dashboard --**.
1. In the query configuration section, make the following selections:
   - **Source panel** - Choose the panel with the source data.
   - **Data** - Select **All Data** to use the data of the panel, and not just the annotations. This is the default selection.
   - **Filters** - Toggle on the switch to make the data from the referenced panel filterable.

   {{< admonition type="note">}}
   If you're referencing multiple panels in a dashboard with the Dashboard data source, you can only use one of those source panels at a time for filtering.
   {{< /admonition >}}

1. Configure any other needed options for the panel.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to dashboard** and then **Exit edit**.

Now you can filter the data from the source panel by way of the Dashboard data source.
Add as many panels as you need.

### Dashboard drilldown with filters

In table and bar chart visualizations, you can apply filters directly from the visualization.
To quickly apply filter variables, follow these steps:

1. To display the filter icons, hover your cursor over the table cell with the value for which you want to filter. In this example, the cell value is `ConfigMap Updated`, which is in the `alertname` column:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-icon-v12.2.png" max-width="550px" alt="Table and bar chart with a filter icon displayed on a table cell" >}}

   In bar chart visualizations, hover and click the bar to display the filter button:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-icon-bar-v12.2.png" max-width="300px" alt="The filter button in a bar chart tooltip">}}

1. Click the add filter icon.

   The variable pair `alertname = ConfigMap Updated` is added to the filter and all panels using the same data source that include that variable value are filtered by that value:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-applied-v12.2.png" max-width="550px" alt="Table and bar chart, filtered" >}}

If one of the panels in the dashboard using that data source doesn't include that variable value, the panel won't return any data. In this example, the variable pair `_name_ = ALERTS` has been added to the filter so the bar chart doesn't return any results:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-no-data-v12.2.png" max-width="650px" alt="Table, filtered and bar chart returning no results" >}}

In cases where the data source you're using doesn't support filtering, consider using the special Dashboard data source.
For more information, refer to [Filter any data using the Dashboard data source](#filter-any-data-using-the-dashboard-data-source).

### Panel-to-panel filtering

You can use data links to link back to the dashboard you are currently on. This enables "panel-to-panel filtering," where clicking a data point in one panel updates the dashboard variables and filters the rest of the dashboard.

To preserve the context of the current dashboard:

- **Time range:** You must explicitly include the current time range in the link.
- **Variables:** You must enable **Include all variables** to preserve existing selections.
- **Ordering:** Ensure that **Include all variables** is placed before the specific variable you are defining in the link.

Filters on the current dashboard are automatically preserved.

Learn more in:

- [Configure data links and actions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-data-links/)
- [Create dashboard URL variables > Filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard-url-variables/#filters)
