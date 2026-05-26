---
---

# Filter and Group by

<!-- vale Grafana.WordList = NO -->
<!-- vale Grafana.Spelling = NO -->

{{< admonition type="note" >}}
The **Filter and Group by** feature renames the **Ad hoc filters** variable and extends it by adding grouping for Prometheus and Loki data sources.
However, in the dashboard schema, it's still referred to as `"kind": "AdhocVariable"`.
{{< /admonition >}}

_Filters_ are one of the most complex and flexible variable options available.
Instead of creating a variable for each dimension by which you want to filter, filters automatically create variables (key/value pairs) for all the dimensions returned by your data source query.
This allows you to apply filters dashboard-wide.

Filters let you add label/value filters that are automatically added to all metric queries that use the specified data source.
Unlike other variables, you don't use filters in queries.
Instead, you use filters to write filters for existing queries.

The following data sources support filters:

- Dashboard - Use this special data source to [apply filters to data from unsupported data sources](#filter-any-data-using-the-dashboard-data-source).
- Prometheus
- Loki
- InfluxDB
- Elasticsearch
- OpenSearch

## Add filters {#add-ad-hoc-filters}

To create a filter, follow these steps:

1. [Enter general options](#enter-general-options).
1. Under the **Filter options** section of the page, select a target data source in the **Data source** drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only).
   For more information about data sources, refer to [Add a data source](ref:add-a-data-source).

1. (Optional) To provide the filter dimensions as comma-separated values (CSV), toggle the **Use static key dimensions** switch on, and then enter the values in the space provided.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to dashboard** and then **Exit edit**.

Now you can [filter data on the dashboard](ref:filter-dashboard).

{{< admonition type="tip" >}}
You can use data links to link back to the dashboard you are currently on. This enables "panel-to-panel filtering," where clicking a data point in one panel updates the dashboard variables and filters the rest of the dashboard.

To preserve the context of the current dashboard:

- **Time range:** You must explicitly include the current time range in the link.
- **Variables:** You must enable **Include all variables** to preserve existing selections.
- **Ordering:** Ensure that **Include all variables** is placed before the specific variable you are defining in the link.

Filters on the current dashboard are automatically preserved.

Learn more in:

- [Configure data links and actions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-data-links/)
- [Create dashboard URL variables – Filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard-url-variables/#ad-hoc-filters)
  {{< /admonition >}}

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
For more information, refer to [Filter any data using the Dashboard data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#filter-any-data-using-the-dashboard-data-source).

## Add filters and groupings

1. Click **Edit** in the top-right corner of the dashboard.
1. In the toolbar, click the **Dashboard options** icon to open the sidebar.
1. In the sidebar, click **Settings**.
1. Go to the **Variables** tab.
1. Click **Add variable**, or if there are already existing variables, **+ New variable**.
1. Choose an option in the **Select variable type** drop-down list.

{{< shared id="add-variable" >}}

1. Enter a **Name** for the variable.
1. (Optional) In the **Label** field, enter the display name for the variable drop-down list.

   If you don't enter a display name, then the drop-down list label is the variable name.

1. (Optional) In the **Description** field, enter a description of the variable. The description appears as an info icon tooltip next to the variable name on the dashboard.

   Descriptions support links. You can use Markdown-style links (`[link text](https://example.com)`) or paste bare URLs (`https://example.com`). Only `http` and `https` URLs are rendered as clickable links — other protocols are displayed as plain text.

1. Choose a **Display** option:
   - **Above dashboard** - The variable drop-down list displays above the dashboard with the variable **Name** or **Label** value. This is the default.
   - **Above dashboard, label hidden** - The variable drop-down list displays above the dashboard, but without showing the name of the variable.
   - **Controls menu** - The variable is displayed in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.
   - **Hidden** - No variable drop-down list is displayed on the dashboard.

## Variable best practices
<!--TODO: update title and figure out if this is relevant -->

- Variable drop-down lists are displayed in the order in which they're listed in the **Variables** in dashboard settings, so put the variables that you will change often at the top, so they will be shown first (far left on the dashboard).
- By default, variables don't have a default value. This means that the topmost value in the drop-down list is always preselected. If you want to pre-populate a variable with an empty value, you can use the following workaround in the variable settings:
  1. Select the **Include All Option** checkbox.
  2. In the **Custom all value** field, enter a value like `.+`.