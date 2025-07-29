---
aliases:
  - ../../data-sources/prometheus/query-editor/
description: Guide for using the Prometheus data source's query editor
keywords:
  - grafana
  - prometheus
  - logs
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Prometheus query editor
title: Prometheus query editor
weight: 300
refs:
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
  exemplars:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  heatmap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/heatmap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/heatmap/
  time-series-transform:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/#transform
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/#transform
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Prometheus query editor

Grafana provides a query editor for the Prometheus data source to create queries in PromQL. For more information about PromQL, see [Querying Prometheus](http://prometheus.io/docs/querying/basics/). The Prometheus query editor is located on the [Explore page](ref:explore). You can also access the PostgreSQL query editor from a dashboard panel. Click the ellipsis in the upper right of the panel and select **Edit**.

For general documentation on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data). For options and functions common to all query editors, refer to [Query editors](ref:query-transform-data).

The Prometheus query editor has two modes:

- [Builder mode](#builder-mode)
- [Code mode](#code-mode)

![Query editor mode](/media/docs/prometheus/builder-code-v11-mode.png)

Grafana synchronizes both modes, allowing you to switch between them. Grafana also displays a warning message if it detects an issue with the query while switching modes.

You can configure Prometheus-specific options in the query editor by setting several options regardless of mode.

{{< figure src="/static/img/docs/prometheus/options.png" max-width="500px" class="docs-image--no-shadow" caption="Options" >}}

## Builder mode

**Builder mode** helps you build queries using a visual interface. This option is best for users who have limited experience working with Prometheus and PromQL.

The following video demonstrates how to use the visual Prometheus query builder:

{{< vimeo 720004179 >}}

Builder mode contains the following components:

- **Kick start your query** - Click to view a list of predefined operation patterns that help you quickly build queries with multiple operations. These include:
  - Rate query starters
  - Histogram query starters
  - Binary query starters

Click the arrow next to each to see the available options to add to your query.

- **Explain** - Toggle on to display a step-by-step explanation of all query components and operations.

{{< figure src="/static/img/docs/prometheus/explain-results.png" max-width="500px" class="docs-image--no-shadow" caption="Explain results" >}}

- **Builder/Code** - Click the corresponding **Builder** or **Code** tab on the toolbar to select an editor mode.

If you select Builder mode you will see the following options:

- **Metric** - Select a metric from the drop-down. Click the icon to open Metrics explorer, where you can search for metrics by name and filter by type if your instance has a large number of metrics. Refer to [Metrics explorer](#metrics-explorer) for more detail on using this feature.
- **Label filters** - Select label filters from the drop-down. Select an operator and a value.
  Select desired labels and their values from the drop-down list.
  When a metric is selected, the data source requests available labels and their values from the server.
  Use the `+` button to add a label, and the `x` button to remove a label.

Click **+ Operations** to select from a list of operations including Aggregations, Range functions, Functions, Binary operations, Trigonometric and Time functions. You can select multiple operations. Refer to [Operations](#operations) for more detail.

**Options:**

- **Legend**- Lets you customize the name for the time series. You can use a predefined or custom format.

  - **Auto** - Displays unique labels. Also displays all overlapping labels if a series has multiple labels.
  - **Verbose** - Displays all label names.
  - **Custom** - Lets you customize the legend using label templates. For example, `{{hostname}}` is replaced with the value of the `hostname` label. To switch to a different legend mode, clear the input and click outside the field.

- **Min step** - Sets the minimum interval between data points returned by the query. For example, setting this to `1h` suggests that data is collected or displayed at hourly intervals. This setting supports the `$__interval` and `$__rate_interval` macros. Note that the time range of the query is aligned to this step size, which may adjust the actual start and end times of the returned data.

- **Format** - Determines how the data from your Prometheus query is interpreted and visualized in a panel. Choose from the following format options:

  - **Time series** - The default format. Refer to [Time series kind formats](https://grafana.com/developers/dataplane/timeseries/) for information on time series data frames and how time and value fields are structured.
  - **Table** - Displays data in table format. This format works only in a [Table panel](ref:table).
  - **Heatmap** - Displays Histogram-type metrics in a [Heatmap panel](ref:heatmap) by converting cumulative histograms to regular ones and sorting the series by the bucket bound. Converts cumulative histogram data into regular histogram format and sorts the series by bucket boundaries for proper display.

- **Type** - This setting determines the query type. These include:
  - **Both** - The default option. Returns results for both a **Range** query and an **Instant** query.
  - **Range** - Returns a range vector - a set of time series
    a set of time series where each series includes multiple data points over a period of time. You can choose to visualize the data as lines, bars, points, stacked lines, or stacked bars.
  - **Instant** - Returns a single data point per series — the most recent value within the selected time range. The results can be displayed in a table or as raw data. To visualize instant query results in a time series panel, start by adding field override, then add a property to the override called `Transform`, and set the Transform value to `Constant` in the drop-down. For more information, refer to the [Time Series Transform option documentation](ref:time-series-transform).

{{< admonition type="note" >}}
Grafana adjusts the query time range to align with the dynamically calculated step interval. This alignment ensures consistent metric visualization and supports Prometheus's result caching requirements. However, this alignment can cause minor visual differences, such as a slight gap at the graph's right edge or a shifted start time. For example, a `15s` step aligns timestamps to Unix times divisible by 15 seconds. A `1w` `minstep` aligns the range to the start of the week, which for Prometheus is Thursday at 00:00 UTC.
{{< /admonition >}}

- **Exemplars** - Toggle on to run a query that includes exemplars in the graph. Exemplars are unique to Prometheus. For more information see [Introduction to exemplars](ref:exemplars).

{{< admonition type="note" >}}
There is no option to add exemplars with an **Instant** query type.
{{< /admonition >}}

### Filter metrics

{{< figure src="/static/img/docs/prometheus/metrics-and-labels.png" max-width="500px" class="docs-image--no-shadow" caption="Metric and label filters" >}}

When you are ready to create a query, you can choose the specific metric name from the drop-down list under **Metric**.
The data source provides the list of available metrics based on the selected time range.
You can also enter text into the selector when the drop-down is open to search and filter the list.

#### Metrics explorer in Builder mode

{{< figure src="/static/img/docs/prometheus/screenshot-grafana-prometheus-metrics-explorer-2.png" max-width="500px" class="docs-image--no-shadow" caption="Metrics explorer" >}}

Click the **Open book icon** to open the Metrics explorer, where you can search for and filter all the metrics in your instance.

If you would like to explore your metrics in the query builder further, you can open the **Metrics explorer** by clicking the first option in the metric select component of the query builder.

The Metrics explorer displays all metrics in a paginated table list. The list shows the total number of metrics, as well as the name, type, and description for each metric. You can enter text into the search input to filter results.
You can also filter by type.

The following options are included under the **Additional Settings** drop-down:

- **Include description in search**: Toggle on to search by both name and description.
- **Include results with no metadata**: Toggle on to include metrics that lack type or description metadata.
- **Disable text wrap**: Toggle on to disable text wrapping.
- **Enable regex search**: Toggle on to filter metric names by regex search, which uses an additional call on the Prometheus API.

{{< admonition type="note" >}}
The Metrics explorer (Builder mode) and [Metrics browser (Code mode)](#metrics-browser-in-code-mode) are separate elements. The Metrics explorer does not have the ability to browse labels yet, but the Metrics browser can display all labels on a metric name.
{{< /admonition >}}

### Operations

{{< figure src="/static/img/docs/prometheus/operations.png" max-width="500px" class="docs-image--no-shadow" caption="Operations" >}}

Select the **+ Operations** button to add operations to your query.

The query editor groups operations into the following sections:

- Aggregations - for additional information see [Aggregation operators](https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators).
- Range functions - for additional information see [Functions](https://prometheus.io/docs/prometheus/latest/querying/functions/#functions).
- Functions - for additional information see [Functions](https://prometheus.io/docs/prometheus/latest/querying/functions/#functions).
- Binary operations - for additional information see [Binary operators](https://prometheus.io/docs/prometheus/latest/querying/operators/#binary-operators).
- Trigonometric - for additional information see [Trigonometric functions](https://prometheus.io/docs/prometheus/latest/querying/functions/#trigonometric-functions).
- Time functions - for additional information see [Functions](https://prometheus.io/docs/prometheus/latest/querying/functions/#functions).

All operations have function parameters under the operation header. Click the `operator` to see a full list of supported functions. Some operations allow you to apply specific labels to functions.

{{< figure src="/static/img/docs/prometheus/use-function-by-label-9-5.png" max-width="500px" class="docs-image--no-shadow" caption="Functions and labels" >}}

Some operations are only valid when used in a specific order. If you add an operation in a way that would create an invalid or illogical query, the query editor automatically places it in the correct position to maintain a valid query structure.

### Hints

The query editor can detect which operations are most appropriate for certain selected metrics.
When it does, it displays a hint next to the **+ Operations** button.

To add the operation to your query, click the **Hint**.

{{< figure src="/static/img/docs/prometheus/hint-example.png" max-width="500px" class="docs-image--no-shadow" caption="Hint" >}}

When you are satisfied with your query, click **Run query**.

## Code mode

**Code mode** is for the experienced Prometheus user with prior expertise in PromQL, Prometheus' query language. The Code mode editor allows you to create queries just as you would in Prometheus. For more information about PromQL see [Querying Prometheus](http://prometheus.io/docs/querying/basics/).

{{< figure src="/static/img/docs/prometheus/code-mode.png" max-width="500px" class="docs-image--no-shadow" caption="Code mode" >}}

The user interface (UI) also lets you select metrics, labels, filters, and operations.

You can write complex queries using the text editor with autocompletion features and syntax highlighting. Code mode's autocomplete feature works automatically while typing. The query editor can autocomplete static functions, aggregations, keywords, and also dynamic items like metrics and labels. The autocompletion drop-down includes documentation for the suggested items where available.

It also contains a [Metrics browser](#metrics-browser-in-code-mode) to further help you write queries. To open the Metrics browser, click the arrow next to **Metrics browser**.

### Metrics browser in Code mode

The Metrics browser locates metrics and selects relevant labels to help you build basic queries.
When you click **Metrics browser** in `Code` mode, it displays all available metrics and labels.
If supported by your Prometheus instance, each metric also displays its `HELP` and `TYPE` as a tooltip.

{{< figure alt="Prometheus query editor metrics browser"  src="/media/docs/prometheus/Metrics-browser-V10-prom-query-editor.png" caption="Metrics browser" >}}

When you select a metric under **Step 1**, the browser narrows down the available labels to show only the ones applicable to the metric.
You can then select one or more labels shown in **Step 2**.
Select one or more values in **Step 3** for each label to tighten your query scope.
In **Step 4**, you can select **Use query** to run the query, **Use as rate query** to add the rate operation to your query (`$__rate_interval`), **Validate selector** to verify the selector is valid and show the number of series found, or **Clear** to clear your selections and start over.

{{< admonition type="note" >}}
If you don't remember the exact metric name, you can start by selecting a few labels to filter the list. This helps you find relevant label values and narrow down your options.
{{< /admonition >}}

All lists in the Metrics browser include a search field to quickly filter metrics or labels by keyword.
In the **Values** section, there's a single search field that filters across all selected labels, making it easier to find matching values. For example, if you have labels like `app`, `job`, and `job_name`, only one of them might contain the value you're looking for.

When you are satisfied with your query, click **Run query**.

## Incremental dashboard queries (beta)

Starting with Grafana v10, the Prometheus data source supports incremental querying for live dashboards. Instead of re-querying the entire time range on each refresh, Grafana can fetch only new data since the last query.

You can enable or disable this feature in the data source configuration or provisioning file using the `incrementalQuerying` field in `jsonData`.

You can also control the overlap between consecutive incremental queries using the `incrementalQueryOverlapWindow` field in `jsonData`. By default, this is set to `10m` (10 minutes). Increasing the `incrementalQueryOverlapWindow` value increases the time range covered by each incremental query. This can help in environments where the most recent data may be delayed or incomplete.
