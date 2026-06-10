---
aliases:
  - ../../../reference/templating/ # /docs/grafana/next/reference/templating/
  - ../../../variables/add-ad-hoc-filters/ # /docs/grafana/next/variables/add-ad-hoc-filters/
  - ../../../variables/add-constant-variable/ # /docs/grafana/next/variables/add-constant-variable/
  - ../../../variables/add-custom-variable/ # /docs/grafana/next/variables/add-custom-variable/
  - ../../../variables/add-data-source-variable/ # /docs/grafana/next/variables/add-data-source-variable/
  - ../../../variables/add-interval-variable/ # /docs/grafana/next/variables/add-interval-variable/
  - ../../../variables/add-query-variable/ # /docs/grafana/next/variables/add-query-variable/
  - ../../../variables/add-template-variables/ # /docs/grafana/next/variables/add-template-variables/
  - ../../../variables/add-text-box-variable/ # /docs/grafana/next/variables/add-text-box-variable/
  - ../../../variables/formatting-multi-value-variables/ # /docs/grafana/next/variables/formatting-multi-value-variables/
  - ../../../variables/manage-variable/ # /docs/grafana/next/variables/manage-variable/
  - ../../../variables/variable-selection-options/ # /docs/grafana/next/variables/variable-selection-options/
  - ../../../variables/variable-types/ # /docs/grafana/next/variables/variable-types/
  - ../../../variables/variable-types/add-ad-hoc-filters/ # /docs/grafana/next/variables/variable-types/add-ad-hoc-filters/
  - ../../../variables/variable-types/add-constant-variable/ # /docs/grafana/next/variables/variable-types/add-constant-variable/
  - ../../../variables/variable-types/add-custom-variable/ # /docs/grafana/next/variables/variable-types/add-custom-variable/
  - ../../../variables/variable-types/add-data-source-variable/ # /docs/grafana/next/variables/variable-types/add-data-source-variable/
  - ../../../variables/variable-types/add-interval-variable/ # /docs/grafana/next/variables/variable-types/add-interval-variable/
  - ../../../variables/variable-types/add-query-variable/ # /docs/grafana/next/variables/variable-types/add-query-variable/
  - ../../../variables/variable-types/add-text-box-variable/ # /docs/grafana/next/variables/variable-types/add-text-box-variable/
  - ../../../dashboards/variables/add-template-variables/ # /docs/grafana/next/dashboards/variables/add-template-variables/
keywords:
  - grafana
  - documentation
  - guide
  - variable
  - global
  - standard
  - nested
  - chained
  - linked
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Add variables
title: Add variables
description: Learn about the types of variables you can add to dashboards and how
weight: 100
---

# Add variables

The following table lists the types of variables shipped with Grafana.

<!-- prettier-ignore-start -->

| Variable type     | Description                                                                                                                          |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| Query             | Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on. [Add a query variable](#add-a-query-variable).                                  |
| Custom            | Define the variable options manually using a comma-separated list. [Add a custom variable](#add-a-custom-variable).                                                                     |
| Text box          | Display a free text input field with an optional default value. [Add a text box variable](#add-a-text-box-variable).                                                                    |
| Constant          | Define a hidden constant. [Add a constant variable](#add-a-constant-variable).                                                                                                          |
| Data source       | Quickly change the data source for an entire dashboard. [Add a data source variable](#add-a-data-source-variable).                                                                      |
| Interval          | Interval variables represent time spans. [Add an interval variable](#add-an-interval-variable).                                                                                         |
| Filters    | Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only). [Add filters](#add-ad-hoc-filters). |
| Switch            | Display a switch that allows you to toggle between two configurable values for enabled and disabled states. [Add a switch variable](#add-a-switch-variable).                            |

<!-- prettier-ignore-end -->

## Enter General options for any variable

You must enter general options for any type of variable that you create.
To create a variable, follow these steps:

{{< docs/list >}}

1. Click **Edit** in the top-right corner of the dashboard.
1. In the toolbar, click the **Dashboard options** icon to open the sidebar.
1. In the sidebar, click **Settings**.
1. Go to the **Variables** tab.
1. Click **Add variable**, or if there are already variables, **+ New variable**.
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

{{< /shared >}}

1. Click one of the following links to complete the steps for adding your selected variable type:
   - [Query](#add-a-query-variable)
   - [Custom](#add-a-custom-variable)
   - [Textbox](#add-a-text-box-variable)
   - [Constant](#add-a-constant-variable)
   - [Data source](#add-a-data-source-variable)
   - [Interval](#add-an-interval-variable)
   - [Filters](#add-ad-hoc-filters)
   - [Switch](#add-a-switch-variable)

{{< /docs/list >}}

<!-- vale Grafana.Spelling = YES -->

{{< admonition type="tip" >}}
To add variables without leaving the dashboard, click the **Add new element** icon in the dashboard toolbar, and select **Variable**.
For more information, refer to the [Dashboard controls documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/).
{{< /admonition >}}

### Variable best practices

- Variable drop-down lists are displayed in the order in which they're listed in the **Variables** in dashboard settings, so put the variables that you will change often at the top, so they will be shown first (far left on the dashboard).
- By default, variables don't have a default value. This means that the topmost value in the drop-down list is always preselected. If you want to pre-populate a variable with an empty value, you can use the following workaround in the variable settings:
  1. Select the **Include All Option** checkbox.
  2. In the **Custom all value** field, enter a value like `.+`.

## Add a query variable

Query variables enable you to write a data source query that can return a list of metric names, tag values, or keys. For example, a query variable might return a list of server names, sensor IDs, or data centers. The variable values change as they dynamically fetch options with a data source query.

Query variables are generally only supported for strings. If your query returns numbers or any other data type, you might need to convert them to strings to use them as variables. For the Azure data source, for example, you can use the [`tostring`](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/tostringfunction) function for this purpose.

Query expressions can contain references to other variables and in effect create linked variables. Grafana detects this and automatically refreshes a variable when one of its linked variables change.

{{< admonition type="note" >}}
Query expressions are different for each data source. For more information, refer to the documentation for your [data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/).
{{< /admonition >}}

1. [Enter general options](#enter-general-options-for-any-variable).
1. Configure the following options:

   | Option              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
   | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Data source         | Select a target data source in the **Data source** drop-down list. You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only). For more information about data sources, refer to [Add a data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source).                                                                                                                                                                                 |
   | Query type          | Select an option in the drop-down list and fill in the query fields accordingly. For more information, refer to the [Query type](#query-type) section following these steps.                                                                                                                                                                                                                                                                                                                                                            |
   | Regex               | (Optional) Type a regular expression in the field to filter or capture specific parts of the names returned by your data source query. To see examples, refer to [Filter variables with a regular expression](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/advanced-variables/#filter-variables-with-regex).                                                                                                                                                                                                                                                                                            |
   | Apply regex to      | Select **Variable value** or **Display text** to choose where the regex pattern is applied. The default is **Variable value**.                                                                                                                                                                                                                                                                                                                                                                                                          |
   | Sort                | Select the sort order for values to be displayed in the drop-down list. The default option, **Disabled**, means that the order of options returned by your data source query is used.                                                                                                                                                                                                                                                                                                                                                   |
   | Refresh             | Select when the variable should update options:<ul><li>**On dashboard load** - Queries the data source every time the dashboard loads. This slows down dashboard loading, because the variable query needs to be completed before dashboard can be initialized.</li><li>**On time range change** - Queries the data source every time the dashboard loads and when the dashboard time range changes. Use this option if your variable options query contains a time range filter or is dependent on the dashboard time range.</li></ul> |
   | Use static options  | (Optional) Toggle on the switch to add custom options in addition to the query results:<ul><li>Make entries in the **Value** and **Display text** fields.</li><li>Click **+ Add new option** to add another static option.</li></ul> Repeat these steps as many times as needed.                                                                                                                                                                                                                                                        |
   | Multi-value         | Enables multiple values to be selected at the same time. For more information, refer to [Selection Options](#configure-variable-selection-options).                                                                                                                                                                                                                                                                                                                                                                                     |
   | Allow custom values | Enables users to add custom values to the list. For more information, refer to [Selection Options](#configure-variable-selection-options).                                                                                                                                                                                                                                                                                                                                                                                              |
   | Include All option  | Enables an option to include all variables. Enter a value in the **Custom all value** field to set your own "all" option.                                                                                                                                                                                                                                                                                                                                                                                                               |

1. Click **Run query** to test the variable.
1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

### Query type

The query field varies according to your data source.
Some data sources have custom query editors.

Each data source defines how the variable values are extracted.
The typical implementation uses every string value returned from the data source response as a variable value.
Make sure to double-check the documentation for the data source.

Some data sources let you provide custom "display names" for the values.
For instance, the PostgreSQL, MySQL, and Microsoft SQL Server plugins handle this by looking for fields named `__text` and `__value` in the result.
Other data sources may look for `text` and `value` or use a different approach.
Always remember to double-check the documentation for the data source.

If you need more room in a single input field query editor, then hover your cursor over the lines in the lower right corner of the field and drag downward to expand.

## Add a custom variable

Use a _custom_ variable for a value that doesn't change, such as a number or a string.

For example, if you have server names or region names that never change, then you might want to create them as custom variables rather than query variables. Because they don't change, you might use them in [chained variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/advanced-variables/#chained-variables) rather than other query variables. That would reduce the number of queries Grafana must send when chained variables are updated.

1. [Enter general options](#enter-general-options-for-any-variable).
1. Configure the following options:

   | Option              | Description                                                                                                                                                                                                           |
   | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | CSV                 | Enter a flat list of values for the variable in a comma-separated list. You can include numbers, strings, or key/value pairs separated by a space and a colon. For example, `key1 : value1,key2 : value2`.            |
   | JSON                | Provide a JSON array of objects where each object can have any number of properties that can be referenced. For more information refer, to [Configure multi-property variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/advanced-variables/#configure-multi-property-variables). |
   | Multi-value         | Enables multiple values to be selected at the same time. For more information, refer to [Selection Options](#configure-variable-selection-options).                                                                   |
   | Allow custom values | Enables users to add custom values to the list. Only applies to CSV custom values. For more information, refer to [Selection Options](#configure-variable-selection-options).                                         |
   | Include All option  | Enables an option to include all variables. For more information, refer to [Selection Options](#configure-variable-selection-options).                                                                                |

1. Click **Run query** to test the variable.
1. In the **Preview of values** section, Grafana displays a list of the current variable values. If you've entered a JSON array, the preview is a table that includes all the value properties. Review them to ensure they match what you expect.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

## Add a text box variable

_Text box_ variables display a free text input field with an optional default value. This is the most flexible variable, because you can enter any value. Use this type of variable if you have metrics with high cardinality or if you want to update multiple panels in a dashboard at the same time.

For more information about cardinality, refer to [What are cardinality spikes and why do they matter?](https://grafana.com/blog/2022/02/15/what-are-cardinality-spikes-and-why-do-they-matter/)

1. [Enter general options](#enter-general-options-for-any-variable).
1. (Optional) Under the **Text options** section of the page, in the **Default value** field, enter the default value for the variable.

   If you do not enter anything in this field, then Grafana displays an empty text box for users to type text into.

1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

## Add a constant variable

_Constant_ variables enable you to define a hidden constant. This is useful for metric path prefixes for dashboards you want to share. When you export a dashboard, constant variables are converted to import options.

Constant variables are _not_ flexible. Each constant variable only holds one value, and it cannot be updated unless you update the variable settings.

Constant variables are useful when you have complex values that you need to include in queries but don't want to retype in every query. For example, if you had a server path called `i-0b6a61efe2ab843gg`, then you could replace it with a variable called `$path_gg`.

1. [Enter general options](#enter-general-options-for-any-variable).
1. Under the **Constant options** section of the page, in the **Value** field, enter the variable value.

   You can enter letters, numbers, and symbols. You can even use wildcards if you use [raw format](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/variable-syntax/#raw).

1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

## Add a data source variable

_Data source_ variables enable you to quickly change the data source for an entire dashboard. They are useful if you have multiple instances of a data source, perhaps in different environments.

1. [Enter general options](#enter-general-options-for-any-variable).
1. Configure the following options:

   | Option               | Description                                                                                                                                                                        |
   | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Type                 | Select the target data source for the variable.                                                                                                                                    |
   | Instance name filter | (Optional) Enter a regular expression filter for which data source instances to choose from in the variable value drop-down list. Leave this field empty to display all instances. |
   | Multi-value          | Enables multiple values to be selected at the same time. For more information, refer to [Selection Options](#configure-variable-selection-options).                                |
   | Allow custom values  | Enables users to add custom values to the list. For more information, refer to [Selection Options](#configure-variable-selection-options).                                         |
   | Include All option   | Enables an option to include all variables. For more information, refer to [Selection Options](#configure-variable-selection-options).                                             |

1. Click **Run query** to test the variable.
1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

## Add an interval variable

Use an _interval_ variable to represents time spans such as `1m`,`1h`, `1d`. You can think of them as a dashboard-wide "group by time" command. Interval variables change how the data is grouped in the visualization. You can also use the Auto Option to return a set number of data points per time span.

You can use an interval variable as a parameter to group by time (for InfluxDB), date histogram interval (for Elasticsearch), or as a summarize function parameter (for Graphite).

1. [Enter general options](#enter-general-options-for-any-variable).
1. Configure the following options:

   | Option       | Description                                                                                                                                                                                                                                                                                                                                                             |
   | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Values       | Enter the time range intervals that you want to appear in the variable drop-down list. The following time units are supported: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, and `y (years)`. You can also accept or edit the default values: `1m,10m,30m,1h,6h,12h,1d,7d,14d,30d`.                                                 |
   | Auto option  | (Optional) Select on the checkbox if you want to add the `auto` option to the list. This option allows you to specify how many times the current time range should be divided to calculate the current `auto` time span.                                                                                                                                                |
   | Step count   | Select the number of times the current time range is divided to calculate the value, similar to the **Max data points** query option. For example, if the current visible time range is 30 minutes, then the `auto` interval groups the data into 30 one-minute increments. The default value is 30 steps. Only displayed when you select the **Auto option** checkbox. |
   | Min interval | The minimum threshold below which the step count intervals does not divide the time. To continue the 30 minute example, if the minimum interval is set to 2m, then Grafana would group the data into 15 two-minute increments. Only displayed when you select the **Auto option** checkbox.                                                                             |

1. Click **Run query** to test the variable.
1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

### Interval variable examples

The following example shows a template variable `myinterval` in a Graphite function:

```
summarize($myinterval, sum, false)
```

The following example shows a more complex Graphite example, from the [Graphite Template Nested Requests panel](https://play.grafana.org/d/000000056/graphite-templated-nested?editPanel=2&orgId=1):

```
groupByNode(summarize(movingAverage(apps.$app.$server.counters.requests.count, 5), '$interval', 'sum', false), 2, 'sum')
```

<!-- vale Grafana.WordList = NO -->
<!-- vale Grafana.Spelling = NO -->

## Add filters {#add-ad-hoc-filters}

{{< admonition type="note" >}}
In Grafana v13, we released the **Filter and Group by** feature in public preview.
It renames the **Filters** variable (formerly ad hoc filter) and extends it by adding grouping for Prometheus and Loki data sources.
However, in the dashboard schema, it's still referred to as `"kind": "AdhocVariable"`.

To use this feature, enable the `dashboardUnifiedDrilldownControls` feature toggle in your Grafana configuration file.

For more information on the **Filter and Group by** feature, refer to the [Dashboard controls documentation](http://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/#filter-and-group-by).
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

To create a filter, follow these steps:

1. [Enter general options](#enter-general-options-for-any-variable).
1. Under the **Filter options** section of the page, select a target data source in the **Data source** drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only).
   For more information about data sources, refer to [Add a data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source).

1. (Optional) To provide the filter dimensions as comma-separated values (CSV), toggle the **Use static key dimensions** switch on, and then enter the values in the space provided.
1. Click **Save** in the top-right corner.
1. Enter an optional description of your changes and click **Save**.
1. Click **Back to dashboard** and then **Exit edit**.

Now you can [filter data on the dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#filter-dashboard-data).

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
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

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

## Add a switch variable

_Switch_ variables display a switch with two configurable values representing enabled and disabled states. This variable type is useful when you need to:

- Toggle between different query conditions
- Enable or disable specific filters
- Switch between different visualization modes
- Control boolean parameters in your data sources

1. [Enter general options](#enter-general-options-for-any-variable).
1. Configure the following options:

   | Option          | Description                                                                                                                                                                                                                                                                                                                              |
   | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Value pair type | Select one of the following predefined options:<ul><li>**True / False** - Uses boolean values `true` and `false`.</li><li>**1 / 0** - Uses numeric values `1` and `0`.</li><li>**Yes / No** - Uses string values `yes` and `no`.</li><li>**Custom** - Allows you to define custom values for both enabled and disabled states.</li></ul> |
   | Enabled value   | If you selected **Custom**, configure the custom values. Enter the value that represents the enabled state (for example, "on").                                                                                                                                                                                                          |
   | Disabled value  | If you selected **Custom**, enter the value that represents the disabled state (for example, "off").                                                                                                                                                                                                                                     |

1. Click **Save dashboard**.
1. Click **Back to list** to add or edit other variables, or **Back to dashboard** and then **Exit edit**.

### Switch variable examples

The following example shows a switch variable `$debug_mode` used in a Prometheus query to conditionally include debug labels:

```
up{job="my-service"} and ($debug_mode == "true" or on() vector(0))
```

The following example shows a switch variable `$show_errors` used to filter log entries:

```
{job="application"} |= ($show_errors == "1" ? "ERROR" : "")
```

You can also use switch variables in panel titles and other dashboard elements:

```
{{#if debug_mode}}Debug Mode: {{/if}}Application Metrics
```

<!-- vale Grafana.Spelling = YES -->
<!-- vale Grafana.WordList = YES -->

## Variable selection options {#configure-variable-selection-options}

**Selection Options** are a feature you can use to manage variable option selections for query and custom variables. All selection options are optional, and they are off by default.

### Multi-value variables

Interpolating a variable with multiple values selected is tricky as it's not straight forward how to format the multiple values into a string that's valid in the given context where the variable is used. Grafana tries to solve this by allowing each data source plugin to inform the templating interpolation engine what format to use for multiple values.

{{< admonition type="note" >}}
The **Custom all value** option on the variable must be blank for Grafana to format all values into a single string. If it's left blank, then Grafana concatenates (adds together) all the values in the query. Something like `value1,value2,value3`. If a custom `all` value is used, then instead the value is something like `*` or `all`.
{{< /admonition >}}

#### Multi-value variables with a Graphite data source

Graphite uses glob expressions. A variable with multiple values would, in this case, be interpolated as `{host1,host2,host3}` if the current variable value was _host1_, _host2_, and _host3_.

#### Multi-value variables with a Prometheus or InfluxDB data source

InfluxDB and Prometheus use regular expressions, so the same variable would be interpolated as `(host1|host2|host3)`. Every value would also be regular expression escaped. If not, a value with a regular expression control character would break the regular expression.

#### Multi-value variables with an Elastic data source

Elasticsearch uses Lucene query syntax, so the same variable would be formatted as `("host1" OR "host2" OR "host3")`. In this case, every value must be escaped so that the value only contains Lucene control words and quotation marks.

#### Variable indexing

If you have a multi-value variable that's formatted as an array, you can use array positions to reference the values rather than the actual values.
You can use this functionality in dashboard panels to filter data, and when you do so, the array is maintained.

To reference variable values this way, use the following syntax:

```text
${query0.0}
```

The preceding syntax references the first, or `0`, position in the array.

In the following example, there's an array of three values, `1t`, `2t`, and `3t`, and rather than referencing those values, the panel query references the second value in the array using the syntax `${query0.1}`:

{{< figure src="/media/docs/grafana/dashboards/screenshot-indexed-variables-v12.1.png" max-width="750px" alt="Panel query using variable indexing to reference a value" >}}

#### Troubleshoot multi-value variables

Automatic escaping and formatting can cause problems and it can be tricky to grasp the logic behind it. Especially for InfluxDB and Prometheus where the use of regular expression syntax requires that the variable is used in regular expression operator context.

If you do not want Grafana to do this automatic regular expression escaping and formatting, then you must do one of the following:

- Turn off the **Multi-value** or **Include All option** options.
- Use the [raw variable format](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/variable-syntax/#raw).

### Include All option

Grafana adds an `All` option to the variable drop-down list. If a user selects this option, then all variable options are selected.

### Custom all value

This option is only visible if the **Include All option** is selected.

Enter regular expressions, globs, or Lucene syntax in the **Custom all value** field to define the value of the `All` option.

By default the `All` value includes all options in combined expression. This can become very long and can have performance problems. Sometimes it can be better to specify a custom all value, like a wildcard regular expression.

In order to have custom regular expression, globs, or Lucene syntax in the **Custom all value** option, it's never escaped so you have to think about what's a valid value for your data source.

## Global variables

Grafana has global built-in variables that can be used in expressions in the query editor. This topic lists them in alphabetical order and defines them. These variables are useful in queries, dashboard links, panel links, and data links.

### `$__dashboard`

This variable is the name of the current dashboard.

### `$__from` and `$__to`

Grafana has two built-in time range variables: `$__from` and `$__to`. They are currently always interpolated as epoch milliseconds by default, but you can control date formatting.

<!-- prettier-ignore-start -->

| Syntax                   | Example result           | Description                                                                                                                                                      |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${__from}`              | 1594671549254            | Unix millisecond epoch                                                                                                                                           |
| `${__from:date}`         | 2020-07-13T20:19:09.254Z | No arguments, defaults to ISO 8601/RFC 3339                                                                                                                      |
| `${__from:date:iso}`     | 2020-07-13T20:19:09.254Z | ISO 8601/RFC 3339                                                                                                                                                |
| `${__from:date:seconds}` | 1594671549               | Unix seconds epoch                                                                                                                                               |
| `${__from:date:YYYY-MM}` | 2020-07                  | Any custom [date format](https://momentjs.com/docs/#/displaying/) that does not include the `:` character. Uses browser time. Use `:date` or `:date:iso` for UTC |

<!-- prettier-ignore-end -->

The syntax above also works with `${__to}`.

You can use this variable in URLs, as well. For example, you can send a user to a dashboard that shows a time range from six hours ago until now: https://play.grafana.org/d/000000012/grafana-play-home?viewPanel=2&orgId=1?from=now-6h&to=now

### `$__interval`

You can use the `$__interval` variable as a parameter to group by time (for InfluxDB, MySQL, Postgres, MSSQL), Date histogram interval (for Elasticsearch), or as a _summarize_ function parameter (for Graphite).

Grafana automatically calculates an interval that can be used to group by time in queries. When there are more data points than can be shown on a graph, then queries can be made more efficient by grouping by a larger interval. It is more efficient to group by 1 day than by 10s when looking at 3 months of data. The graph looks the same and the query is faster. The `$__interval` is calculated using the time range and the width of the graph (the number of pixels).

Approximate Calculation: `(to - from) / resolution`

For example, when the time range is 1 hour and the graph is full screen, then the interval might be calculated to `2m` - points are grouped in 2 minute intervals. If the time range is 6 months and the graph is full screen, then the interval might be `1d` (1 day) - points are grouped by day.

In the InfluxDB data source, the legacy variable `$interval` is the same variable. `$__interval` should be used instead.

The InfluxDB and Elasticsearch data sources have `Group by time interval` fields that are used to hard code the interval or to set the minimum limit for the `$__interval` variable (by using the `>` syntax -> `>10m`).

### `$__interval_ms`

This variable is the `$__interval` variable in milliseconds, not a time interval formatted string. For example, if the `$__interval` is `20m` then the `$__interval_ms` is `1200000`.

### `$__name`

This variable is only available in the **Singlestat** panel and can be used in the prefix or suffix fields on the Options tab. The variable is replaced with the series name or alias.

{{< admonition type="note" >}}
The **Singlestat** panel is no longer available from Grafana 8.0.
{{< /admonition >}}

### `$__org`

This variable is the ID of the current organization.
`${__org.name}` is the name of the current organization.

### `$__user`

`${__user.id}` is the ID of the current user.
`${__user.login}` is the login handle of the current user.
`${__user.email}` is the email for the current user.

### `$__range`

Currently only supported for Prometheus and Loki data sources. This variable represents the range for the current dashboard. It is calculated by `to - from`. It has a millisecond and a second representation called `$__range_ms` and `$__range_s`.

### `$__rate_interval`

Currently only supported for Prometheus data sources. The `$__rate_interval` variable is meant to be used in the rate function. Refer to [Prometheus query variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/#use-**rate_interval) for details.

### `$__rate_interval_ms`

This variable is the `$__rate_interval` variable in milliseconds, not a time-interval-formatted string. For example, if the `$__rate_interval` is `20m` then the `$__rate_interval_ms` is `1200000`.

### `$timeFilter` or `$__timeFilter`

The `$timeFilter` variable returns the currently selected time range as an expression. For example, the time range interval `Last 7 days` expression is `time > now() - 7d`.

This is used in several places, including:

- The WHERE clause for the InfluxDB data source. Grafana adds it automatically to InfluxDB queries when in Query Editor mode. You can add it manually in Text Editor mode: `WHERE $timeFilter`.
- Log Analytics queries in the Azure Monitor data source.
- SQL queries in MySQL, Postgres, and MSSQL.
- The `$__timeFilter` variable is used in the MySQL data source.

### `$__timezone`

The `$__timezone` variable returns the currently selected time zone, either `utc` or an entry of the IANA time zone database (for example, `America/New_York`).

If the currently selected time zone is _Browser Time_, Grafana tries to determine your browser time zone.
