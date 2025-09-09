---
aliases:
  - ../../reference/templating/
  - ../../variables/add-ad-hoc-filters/
  - ../../variables/add-constant-variable/
  - ../../variables/add-custom-variable/
  - ../../variables/add-data-source-variable/
  - ../../variables/add-interval-variable/
  - ../../variables/add-query-variable/
  - ../../variables/add-template-variables/
  - ../../variables/add-text-box-variable/
  - ../../variables/chained-variables/
  - ../../variables/filter-variables-with-regex/
  - ../../variables/formatting-multi-value-variables/
  - ../../variables/global-variables/
  - ../../variables/manage-variable/
  - ../../variables/variable-selection-options/
  - ../../variables/variable-types/
  - ../../variables/variable-types/add-ad-hoc-filters/
  - ../../variables/variable-types/add-constant-variable/
  - ../../variables/variable-types/add-custom-variable/
  - ../../variables/variable-types/add-data-source-variable/
  - ../../variables/variable-types/add-interval-variable/
  - ../../variables/variable-types/add-query-variable/
  - ../../variables/variable-types/add-text-box-variable/
  - ../../variables/variable-types/chained-variables/
  - ../../variables/variable-types/global-variables/
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
  - best practices
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Add variables
title: Add variables
description: Learn about the types of variables you can add to dashboards and how
weight: 100
refs:
  add:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/
  inspect:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/inspect-variable/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/inspect-variable/
  prometheus-query-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/#use-**rate_interval
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/template-variables/#use-**rate_interval
  raw-variable-format:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#raw
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/#raw
  data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  raw-format:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#raw
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/#raw
  add-a-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#add-a-data-source
  filter-dashboard:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#filter-dashboard-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/use-dashboards/#filter-dashboard-data
---

# Add variables

<!-- vale Grafana.Spelling = NO -->

The following table lists the types of variables shipped with Grafana.

| Variable type     | Description                                                                                                                                                                             |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query             | Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on. [Add a query variable](#add-a-query-variable).                                  |
| Custom            | Define the variable options manually using a comma-separated list. [Add a custom variable](#add-a-custom-variable).                                                                     |
| Text box          | Display a free text input field with an optional default value. [Add a text box variable](#add-a-text-box-variable).                                                                    |
| Constant          | Define a hidden constant. [Add a constant variable](#add-a-constant-variable).                                                                                                          |
| Data source       | Quickly change the data source for an entire dashboard. [Add a data source variable](#add-a-data-source-variable).                                                                      |
| Interval          | Interval variables represent time spans. [Add an interval variable](#add-an-interval-variable).                                                                                         |
| Ad hoc filters    | Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only). [Add ad hoc filters](#add-ad-hoc-filters). |
| Global variables  | Built-in variables that can be used in expressions in the query editor. Refer to [Global variables](#global-variables).                                                                 |
| Chained variables | Variable queries can contain other variables. Refer to [Chained variables](#chained-variables).                                                                                         |

## Enter General options

You must enter general options for any type of variable that you create.
To create a variable, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.
1. Go to the **Variables** tab.
1. Click **Add variable**, or if there are already existing variables, **+ New variable**.
1. Choose an option in the **Select variable type** drop-down list.
1. Enter a **Name** for the variable.
1. (Optional) In the **Label** field, enter the display name for the variable drop-down list.

   If you don't enter a display name, then the drop-down list label is the variable name.

1. Choose a **Show on dashboard** option:
   - **Label and value** - The variable drop-down list displays the variable **Name** or **Label** value. This is the default.
   - **Value:** The variable drop-down list only displays the selected variable value and a down arrow.
   - **Nothing:** No variable drop-down list is displayed on the dashboard.

1. Click one of the following links to complete the steps for adding your selected variable type:
   - [Query](#add-a-query-variable)
   - [Custom](#add-a-custom-variable)
   - [Textbox](#add-a-text-box-variable)
   - [Constant](#add-a-constant-variable)
   - [Data source](#add-a-data-source-variable)
   - [Interval](#add-an-interval-variable)
   - [Ad hoc filters](#add-ad-hoc-filters)

<!-- vale Grafana.Spelling = YES -->

### Variable best practices

- Variable drop-down lists are displayed in the order in which they're listed in the **Variables** in dashboard settings, so put the variables that you will change often at the top, so they will be shown first (far left on the dashboard).
- By default, variables don't have a default value. This means that the topmost value in the drop-down list is always preselected. If you want to pre-populate a variable with an empty value, you can use the following workaround in the variable settings:
  1. Select the **Include All Option** checkbox.
  2. In the **Custom all value** field, enter a value like `+`.

## Add a query variable

Query variables enable you to write a data source query that can return a list of metric names, tag values, or keys. For example, a query variable might return a list of server names, sensor IDs, or data centers. The variable values change as they dynamically fetch options with a data source query.

Query variables are generally only supported for strings. If your query returns numbers or any other data type, you might need to convert them to strings to use them as variables. For the Azure data source, for example, you can use the [`tostring`](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/tostringfunction) function for this purpose.

Query expressions can contain references to other variables and in effect create linked variables. Grafana detects this and automatically refreshes a variable when one of its linked variables change.

{{< admonition type="note" >}}
Query expressions are different for each data source. For more information, refer to the documentation for your [data source](ref:data-source).
{{< /admonition >}}

1. [Enter general options](#enter-general-options).
1. Under the **Query options** section of the page, select a target data source in the **Data source** drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only).
   For more information about data sources, refer to [Add a data source](ref:add-a-data-source).

1. In the **Query type** drop-down list, select one of the following options:
   - **Label names**
   - **Label values**
   - **Metrics**
   - **Query result**
   - **Series query**
   - **Classic query**

1. In the **Query** field, enter a query.
   - The query field varies according to your data source. Some data sources have custom query editors.
   - Each data source defines how the variable values are extracted. The typical implementation uses every string value returned from the data source response as a variable value. Make sure to double-check the documentation for the data source.
   - Some data sources let you provide custom "display names" for the values. For instance, the PostgreSQL, MySQL, and Microsoft SQL Server plugins handle this by looking for fields named `__text` and `__value` in the result. Other data sources may look for `text` and `value` or use a different approach. Always remember to double-check the documentation for the data source.
   - If you need more room in a single input field query editor, then hover your cursor over the lines in the lower right corner of the field and drag downward to expand.

1. (Optional) In the **Regex** field, type a regular expression to filter or capture specific parts of the names returned by your data source query. To see examples, refer to [Filter variables with a regular expression](#filter-variables-with-regex).
1. In the **Sort** drop-down list, select the sort order for values to be displayed in the dropdown list. The default option, **Disabled**, means that the order of options returned by your data source query is used.
1. Under **Refresh**, select when the variable should update options:
   - **On dashboard load** - Queries the data source every time the dashboard loads. This slows down dashboard loading, because the variable query needs to be completed before dashboard can be initialized.
   - **On time range change** - Queries the data source every time the dashboard loads and when the dashboard time range changes. Use this option if your variable options query contains a time range filter or is dependent on the dashboard time range.

1. (Optional) Configure the settings in the [Selection Options](#configure-variable-selection-options) section:
   - **Multi-value** - Enables multiple values to be selected at the same time.
   - **Include All option** - Enables an option to include all variables.

1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

## Add a custom variable

Use a _custom_ variable for a value that does not change, such as a number or a string.

For example, if you have server names or region names that never change, then you might want to create them as custom variables rather than query variables. Because they do not change, you might use them in [chained variables](#chained-variables) rather than other query variables. That would reduce the number of queries Grafana must send when chained variables are updated.

1. [Enter general options](#enter-general-options).
1. Under the **Custom options** section of the page, in the **Values separated by comma** field, enter the values for this variable in a comma-separated list.

   You can include numbers, strings, or key/value pairs separated by a space and a colon. For example, `key1 : value1,key2 : value2`.

1. (Optional) Configure the settings in the [Selection Options](#configure-variable-selection-options) section:
   - **Multi-value** - Enables multiple values to be selected at the same time.
   - **Include All option** - Enables an option to include all variables.

1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

## Add a text box variable

_Text box_ variables display a free text input field with an optional default value. This is the most flexible variable, because you can enter any value. Use this type of variable if you have metrics with high cardinality or if you want to update multiple panels in a dashboard at the same time.

For more information about cardinality, refer to [What are cardinality spikes and why do they matter?](https://grafana.com/blog/2022/02/15/what-are-cardinality-spikes-and-why-do-they-matter/)

1. [Enter general options](#enter-general-options).
1. (Optional) Under the **Text options** section of the page, in the **Default value** field, enter the default value for the variable.

   If you do not enter anything in this field, then Grafana displays an empty text box for users to type text into.

1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

## Add a constant variable

_Constant_ variables enable you to define a hidden constant. This is useful for metric path prefixes for dashboards you want to share. When you export a dashboard, constant variables are converted to import options.

Constant variables are _not_ flexible. Each constant variable only holds one value, and it cannot be updated unless you update the variable settings.

Constant variables are useful when you have complex values that you need to include in queries but don't want to retype in every query. For example, if you had a server path called `i-0b6a61efe2ab843gg`, then you could replace it with a variable called `$path_gg`.

1. [Enter general options](#enter-general-options).
1. Under the **Constant options** section of the page, in the **Value** field, enter the variable value.

   You can enter letters, numbers, and symbols. You can even use wildcards if you use [raw format](ref:raw-format).

1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

## Add a data source variable

_Data source_ variables enable you to quickly change the data source for an entire dashboard. They are useful if you have multiple instances of a data source, perhaps in different environments.

1. [Enter general options](#enter-general-options).
1. Under the **Data source options** section of the page, in the **Type** drop-down list, select the target data source for the variable.
1. (Optional) In **Instance name filter**, enter a regular expression filter for which data source instances to choose from in the variable value drop-down list.

   Leave this field empty to display all instances.

1. (Optional) Configure the settings in the [Selection Options](#configure-variable-selection-options) section:
   - **Multi-value** - Enables multiple values to be selected at the same time.
   - **Include All option** - Enables an option to include all variables.

1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

## Add an interval variable

Use an _interval_ variable to represents time spans such as `1m`,`1h`, `1d`. You can think of them as a dashboard-wide "group by time" command. Interval variables change how the data is grouped in the visualization. You can also use the Auto Option to return a set number of data points per time span.

You can use an interval variable as a parameter to group by time (for InfluxDB), date histogram interval (for Elasticsearch), or as a summarize function parameter (for Graphite).

1. [Enter general options](#enter-general-options).
1. Under the **Interval options** section, in the **Values** field, enter the time range intervals that you want to appear in the variable drop-down list.

   The following time units are supported: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, and `y (years)`. You can also accept or edit the default values: `1m,10m,30m,1h,6h,12h,1d,7d,14d,30d`.

1. (Optional) Select on the **Auto option** checkbox if you want to add the `auto` option to the list.

   This option allows you to specify how many times the current time range should be divided to calculate the current `auto` time span. If you turn it on, then two more options appear:
   - **Step count** - Select the number of times the current time range is divided to calculate the value, similar to the **Max data points** query option. For example, if the current visible time range is 30 minutes, then the `auto` interval groups the data into 30 one-minute increments. The default value is 30 steps.
   - **Min interval** - The minimum threshold below which the step count intervals does not divide the time. To continue the 30 minute example, if the minimum interval is set to 2m, then Grafana would group the data into 15 two-minute increments.

1. In the **Preview of values** section, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

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

## Add ad hoc filters

_Ad hoc filters_ are one of the most complex and flexible variable options available.
Instead of creating a variable for each dimension by which you want to filter, ad hoc filters automatically create variables (key/value pairs) for all the dimensions returned by your data source query.
This allows you to build dashboard-wide ad hoc queries.

Ad hoc filters let you add label/value filters that are automatically added to all metric queries that use the specified data source.
Unlike other variables, you don't use ad hoc filters in queries.
Instead, you use ad hoc filters to write filters for existing queries.

The following data sources support ad hoc filters:

- Dashboard - Use this special data source to [apply ad hoc filters to data from unsupported data sources](#filter-any-data-using-the-dashboard-data-source).
- Prometheus
- Loki
- InfluxDB
- Elasticsearch
- OpenSearch

To create an ad hoc filter, follow these steps:

1. [Enter general options](#enter-general-options).
1. Under the **Ad-hoc options** section of the page, select a target data source in the **Data source** drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only).
   For more information about data sources, refer to [Add a data source](ref:add-a-data-source).

1. (Optional) To provide the filter dimensions as comma-separated values (CSV), toggle the **Use static key dimensions** switch on, and then enter the values in the space provided.
1. Click **Save dashboard**.
1. Enter an optional description of your dashboard changes, and then click **Save**.
1. Click **Back to dashboard** and **Exit edit**.

Now you can [filter data on the dashboard](ref:filter-dashboard).

### Filter any data using the Dashboard data source

In cases where a data source doesn't support the use of ad hoc filters, you can use the Dashboard data source to reference that data, and then filter it in a new panel.
This allows you to bypass the limitations of the data source in the source panel.

To use ad hoc filters on data from an unsupported data source, follow these steps:

1. Navigate to the dashboard with the panel with the data you want to filter.
1. Click **Edit** in top-right corner of the dashboard.
1. At the top of the dashboard, click **Add** and select **Visualization** in the drop-down list.
1. In the **Queries** tab of the edit panel view, enter `Dashboard` in the **Data source** field and select **-- Dashboard --**.
1. In the query configuration section, make the following selections:
   - **Source panel** - Choose the panel with the source data.
   - **Data** - Select **All Data** to use the data of the panel, and not just the annotations. This is the default selection.
   - **AdHoc Filters** - Toggle on the switch to make the data from the referenced panel filterable.

   {{< admonition type="note">}}
   If you're referencing multiple panels in a dashboard with the Dashboard data source, you can only use one of those source panels at a time for ad hoc filtering.
   {{< /admonition >}}

1. Configure any other needed options for the panel.
1. Click **Save dashboard**.

Now you can filter the data from the source panel by way of the Dashboard data source.
Add as many panels as you need.

### Panel filtering with ad hoc filters

{{< docs/shared lookup="visualizations/panel-filtering.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Filter between dashboards

You can also filter panels on another dashboard using data links, by including a variable in the link:

```
https://play.grafana.org/d/HYaGDGIMk/templating-global-variables-and-interpolation?orgId=1&from=now-6h&to=now&timezone=utc&var-Server=CCC&var-MyCustomDashboardVariable=Hello%20World%21
```

In the preceding example, the variables and values are `var-Server=CCC` and `var-MyCustomDashboardVariable=Hello%20World%21`.
When someone clicks the link, they're taken to a version of the dashboard with those variables already applied.

<!-- vale Grafana.Spelling = YES -->
<!-- vale Grafana.WordList = YES -->

## Configure variable selection options

**Selection Options** are a feature you can use to manage variable option selections. All selection options are optional, and they are off by default.

### Multi-value variables

Interpolating a variable with multiple values selected is tricky as it is not straight forward how to format the multiple values into a string that is valid in the given context where the variable is used. Grafana tries to solve this by allowing each data source plugin to inform the templating interpolation engine what format to use for multiple values.

{{< admonition type="note" >}}
The **Custom all value** option on the variable must be blank for Grafana to format all values into a single string. If it is left blank, then Grafana concatenates (adds together) all the values in the query. Something like `value1,value2,value3`. If a custom `all` value is used, then instead the value is something like `*` or `all`.
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
- Use the [raw variable format](ref:raw-variable-format).

### Include All option

Grafana adds an `All` option to the variable dropdown list. If a user selects this option, then all variable options are selected.

### Custom all value

This option is only visible if the **Include All option** is selected.

Enter regular expressions, globs, or Lucene syntax in the **Custom all value** field to define the value of the `All` option.

By default the `All` value includes all options in combined expression. This can become very long and can have performance problems. Sometimes it can be better to specify a custom all value, like a wildcard regular expression.

In order to have custom regular expression, globs, or Lucene syntax in the **Custom all value** option, it is never escaped so you have to think about what is a valid value for your data source.

## Global variables

Grafana has global built-in variables that can be used in expressions in the query editor. This topic lists them in alphabetical order and defines them. These variables are useful in queries, dashboard links, panel links, and data links.

### `$__dashboard`

This variable is the name of the current dashboard.

### `$__from` and `$__to`

Grafana has two built-in time range variables: `$__from` and `$__to`. They are currently always interpolated as epoch milliseconds by default, but you can control date formatting.

| Syntax                   | Example result           | Description                                                                                                                                                      |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${__from}`              | 1594671549254            | Unix millisecond epoch                                                                                                                                           |
| `${__from:date}`         | 2020-07-13T20:19:09.254Z | No arguments, defaults to ISO 8601/RFC 3339                                                                                                                      |
| `${__from:date:iso}`     | 2020-07-13T20:19:09.254Z | ISO 8601/RFC 3339                                                                                                                                                |
| `${__from:date:seconds}` | 1594671549               | Unix seconds epoch                                                                                                                                               |
| `${__from:date:YYYY-MM}` | 2020-07                  | Any custom [date format](https://momentjs.com/docs/#/displaying/) that does not include the `:` character. Uses browser time. Use `:date` or `:date:iso` for UTC |

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

Currently only supported for Prometheus data sources. The `$__rate_interval` variable is meant to be used in the rate function. Refer to [Prometheus query variables](ref:prometheus-query-variables) for details.

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

## Chained variables

_Chained variables_, also called _linked variables_ or _nested variables_, are query variables with one or more other variables in their variable query. This section explains how chained variables work and provides links to example dashboards that use chained variables.

Chained variable queries are different for every data source, but the premise is the same for all. You can use chained variable queries in any data source that allows them.

Extremely complex linked templated dashboards are possible, 5 or 10 levels deep. Technically, there is no limit to how deep or complex you can go, but the more links you have, the greater the query load.

### Grafana Play dashboard examples

The following Grafana Play dashboards contain fairly simple chained variables, only two layers deep. To view the variables and their settings, click **Edit**
and then **Settings**; then go to the **Variables** tab. Both examples are expanded in the following section.

- [Graphite Templated Nested](https://play.grafana.org/d/000000056/graphite-templated-nested?orgId=1&var-app=country&var-server=All&var-interval=1h)
- [InfluxDB Templated](https://play.grafana.org/d/e7bad3ef-db0c-4bbd-8245-b85c0b2ca2b9/influx-2-73a-hourly-electric-grid-monitor-for-us?orgId=1&refresh=1m)

### Examples explained

Variables are useful to reuse dashboards and dynamically change what is shown in dashboards. Chained variables are especially useful to filter what you see.

Create parent/child relationship in a variable, sort of a tree structure where you can select different levels of filters.

The following sections explain the linked examples in the dashboards above in depth and builds on them. While the examples are data source-specific, the concepts can be applied broadly.

#### Graphite example

In this example, there are several applications. Each application has a different subset of servers. It is based on the [Graphite Templated Nested](https://play.grafana.org/d/000000056/graphite-templated-nested?orgId=1&var-app=country&var-server=All&var-interval=1h).

Now, you could make separate variables for each metric source, but then you have to know which server goes with which app. A better solution is to use one variable to filter another. In this example, when the user changes the value of the `app` variable, it changes the dropdown options returned by the `server` variable. Both variables use the **Multi-value** option and **Include all option**, enabling users to select some or all options presented at any time.

##### `app` variable

The query for this variable basically says, "Find all the applications that exist."

```
apps.*
```

The values returned are `backend`, `country`, `fakesite`, and `All`.

##### `server` variable

The query for this variable basically says, "Find all servers for the currently chosen application."

```
apps.$app.*
```

If the user selects `backend`, then the query changes to:

```
apps.backend.*
```

The query returns all servers associated with `backend`, including `backend_01`, `backend_02`, and so on.

If the user selects `fakesite`, then the query changes to:

```
apps.fakesite.*
```

The query returns all servers associated with `fakesite`, including `web_server_01`, `web_server_02`, and so on.

##### More variables

{{< admonition type="note" >}}
This example is theoretical. The Graphite server used in the example does not contain CPU metrics.
{{< /admonition >}}

The dashboard stops at two levels, but you could keep going. For example, if you wanted to get CPU metrics for selected servers, you could copy the `server` variable and extend the query so that it reads:

```
apps.$app.$server.cpu.*
```

This query basically says, "Find the CPU metrics for the selected server."

Depending on what variable options the user selects, you could get queries like:

```
apps.backend.backend_01.cpu.*
apps.{backend.backend_02,backend_03}.cpu.*
apps.fakesite.web_server_01.cpu.*
```

#### InfluxDB example

In this example, you have several data centers. Each data center has a different subset of hosts. It is based on the [InfluxDB Templated](https://play.grafana.org/d/e7bad3ef-db0c-4bbd-8245-b85c0b2ca2b9/influx-2-73a-hourly-electric-grid-monitor-for-us?orgId=1&refresh=1m) dashboard.

In this example, when the user changes the value of the `datacenter` variable, it changes the dropdown options returned by the `host` variable. The `host` variable uses the **Multi-value** option and **Include all option**, allowing users to select some or all options presented at any time. The `datacenter` does not use either option, so you can only select one data center at a time.

##### `datacenter` variable

The query for this variable basically says, "Find all the data centers that exist."

```
SHOW TAG VALUES WITH KEY = "datacenter"
```

The values returned are `America`, `Africa`, `Asia`, and `Europe`.

##### `host` variable

The query for this variable basically says, "Find all hosts for the currently chosen data center."

```
SHOW TAG VALUES WITH KEY = "hostname" WHERE "datacenter" =~ /^$datacenter$/
```

If the user selects `America`, then the query changes to:

```
SHOW TAG VALUES WITH KEY = "hostname" WHERE "datacenter" =~ /^America/
```

The query returns all servers associated with `America`, including `server1`, `server2`, and so on.

If the user selects `Europe`, then the query changes to:

```
SHOW TAG VALUES WITH KEY = "hostname" WHERE "datacenter" =~ /^Europe/
```

The query returns all servers associated with `Europe`, including `server3`, `server4`, and so on.

##### More variables

{{< admonition type="note" >}}
This example is theoretical. The InfluxDB server used in the example does not contain CPU metrics.
{{< /admonition >}}

The dashboard stops at two levels, but you could keep going. For example, if you wanted to get CPU metrics for selected hosts, you could copy the `host` variable and extend the query so that it reads:

```
SHOW TAG VALUES WITH KEY = "cpu" WHERE "datacenter" =~ /^$datacenter$/ AND "host" =~ /^$host$/
```

This query basically says, "Find the CPU metrics for the selected host."

Depending on what variable options the user selects, you could get queries like:

```bash
SHOW TAG VALUES WITH KEY = "cpu" WHERE "datacenter" =~ /^America/ AND "host" =~ /^server2/
SHOW TAG VALUES WITH KEY = "cpu" WHERE "datacenter" =~ /^Africa/ AND "host" =~ /^server/7/
SHOW TAG VALUES WITH KEY = "cpu" WHERE "datacenter" =~ /^Europe/ AND "host" =~ /^server3+server4/
```

### Best practices and tips

The following practices make your dashboards and variables easier to use.

#### New linked variables creation

- Chaining variables create parent/child dependencies. You can envision them as a ladder or a tree.
- The easiest way to create a new chained variable is to copy the variable that you want to base the new one on. In the variable list, click the **Duplicate variable** icon to the right of the variable entry to create a copy. You can then add on to the query for the parent variable.
- New variables created this way appear at the bottom of the list. You might need to drag it to a different position in the list to get it into a logical order.

#### Variable order

You can change the orders of variables in the dashboard variable list by clicking the up and down arrows on the right side of each entry. Grafana lists variable dropdowns left to right according to this list, with the variable at the top on the far left.

- List variables that do not have dependencies at the top, before their child variables.
- Each variable should follow the one it is dependent on.
- Remember there is no indication in the UI of which variables have dependency relationships. List the variables in a logical order to make it easy on other users (and yourself).

#### Complexity consideration

The more layers of dependency you have in variables, the longer it takes to update dashboards after you change variables.

For example, if you have a series of four linked variables (country, region, server, metric) and you change a root variable value (country), then Grafana must run queries for all the dependent variables before it updates the visualizations in the dashboard.

<!-- vale Grafana.WordList = NO -->

## Filter variables with regular expressions {#filter-variables-with-regex}

<!-- vale Grafana.WordList = NO -->

Using the **Regex** query option, you filter the list of options returned by the variable query or modify the options returned.

This page shows how to use a regular expression to filter/modify values in the variable dropdown.

Using the **Regex** query option, you filter the list of options returned by the Variable query or modify the options returned. For more information, refer to the Mozilla guide on [Regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

Examples of filtering on the following list of options:

```text
backend_01
backend_02
backend_03
backend_04
```

### Filter so that only the options that end with `01` or `02` are returned:

**Regex**:

```regex
/(01|02)$/
```

Result:

```text
backend_01
backend_02
```

### Filter and modify the options using a regular expression to capture group to return part of the text:

**Regex**:

```regex
/.*(01|02)/
```

Result:

```text
01
02
```

### Filter and modify - Prometheus Example

List of options:

```text
up{instance="demo.robustperception.io:9090",job="prometheus"} 1 1521630638000
up{instance="demo.robustperception.io:9093",job="alertmanager"} 1 1521630638000
up{instance="demo.robustperception.io:9100",job="node"} 1 1521630638000
```

**Regex**:

```regex
/.*instance="([^"]*).*/
```

Result:

```text
demo.robustperception.io:9090
demo.robustperception.io:9093
demo.robustperception.io:9100
```

### Filter and modify using named text and value capture groups

Using named capture groups, you can capture separate 'text' and 'value' parts from the options returned by the variable query. This allows the variable drop-down list to contain a friendly name for each value that can be selected.

For example, when querying the `node_hwmon_chip_names` Prometheus metric, the `chip_name` is a lot friendlier than the `chip` value. So the following variable query result:

```text
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_0",chip_name="enp216s0f0np0"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_1",chip_name="enp216s0f0np1"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_2",chip_name="enp216s0f0np2"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_3",chip_name="enp216s0f0np3"} 1
```

Passed through the following regular expression:

```regex
/chip_name="(?<text>[^"]+)|chip="(?<value>[^"]+)/g
```

Would produce the following drop-down list:

```text
Display Name          Value
------------          -------------------------
enp216s0f0np0         0000:d7:00_0_0000:d8:00_0
enp216s0f0np1         0000:d7:00_0_0000:d8:00_1
enp216s0f0np2         0000:d7:00_0_0000:d8:00_2
enp216s0f0np3         0000:d7:00_0_0000:d8:00_3
```

{{< admonition type="note" >}}
Only `text` and `value` capture group names are supported.
{{< /admonition >}}
