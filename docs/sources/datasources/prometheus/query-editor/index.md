---
aliases:
  - ../../data-sources/prometheus/query-editor/
description: Guide for using the Prometheus data source's query editor
keywords:
  - grafana
  - prometheus
  - logs
  - queries
menuTitle: Query editor
title: Prometheus query editor
weight: 300
---

# Prometheus query editor

Grafana provides a query editor for the Prometheus data source.

For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

For options and functions common to all query editors, refer to [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

## Choose a query editing mode

The Prometheus query editor has two modes:

- [Code mode](#code-mode)
- [Builder mode](#builder-mode)

To switch between editor modes, select the corresponding **Builder** and **Code** tabs.

{{< figure src="/static/img/docs/prometheus/editing-mode.png" max-width="500px" class="docs-image--no-shadow" caption="Query editor mode" >}}

Both modes are synchronized, so you can switch between them without losing your work.

## Toolbar options

The toolbar contains the following elements:

| Name                      | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Kick start your query** | A list of operation patterns that help you quickly add multiple operations to your query. |
| **Explain**               | Displays a step-by-step explanation of all query parts and its operations.                |

## Configure common options

You can configure Prometheus-specific options in the query editor by setting several options regardless of mode.

{{< figure src="/static/img/docs/prometheus/options.png" max-width="500px" class="docs-image--no-shadow" caption="Options" >}}

### Legend

The **Legend** setting defines the time series's name. You can use a predefined or custom format.

| Option      | Description                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto**    | Shows the value of a single label for each series with only one label, or displays all labels if a series has multiple labels.                                                                                        |
| **Verbose** | Displays all label names.                                                                                                                                                                                             |
| **Custom**  | Uses templating to select which labels will be included.<br/>For example, `{{hostname}}` is replaced by the label value for the label `hostname`.<br/>Clear the input and click outside of it to select another mode. |

### Min step

The **Min step** setting defines the lower bounds on the interval between data points.
For example, set this to `1h` to hint that measurements are taken hourly.
This setting supports the `$__interval` and `$__rate_interval` macros.

### Format

You can switch between **Table**, **Time series**, and **Heatmap** options by configuring the query's **Format**.

| Option          | Description                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time series** | Uses the default time series format.                                                                                                                                                                                                |
| **Table**       | This works only in a [Table panel]({{< relref "../../../panels-visualizations/visualizations/table" >}}).                                                                                                                           |
| **Heatmap**     | Displays metrics of the Histogram type on a [Heatmap panel]({{< relref "../../../panels-visualizations/visualizations/heatmap" >}}) by converting cumulative histograms to regular ones and sorting the series by the bucket bound. |

### Type

The **Type** setting sets the query type.

- The **Both** query option is the default option and returns results for both a **Range** query and an **Instant** query.
- A **Range** query returns a range vector consisting of a set of time series data containing a range of data points over time for each time series. You can choose lines, bars, points, stacked lines or stacked bars
- An **Instant** query returns one data point per query and only the most recent point in the time range provided. Instant query results can be depicted in the time series panel by adding a field override, adding a property to the override named `Transform`, and selecting `Constant` from the **Transform** dropdown. The results can be shown in a table or as raw data.
- An **Exemplars** query runs with the regular query and shows exemplars in the graph.

For more information, refer to the [Time Series Transform option documentation]({{< relref "../../../panels-visualizations/visualizations/time-series#transform" >}}).

> **Note:** Grafana modifies the request dates for queries to align them with the dynamically calculated step.
> This ensures a consistent display of metrics data, but it can result in a small gap of data at the right edge of a graph.

## Code mode

**Code mode** is for the experienced Prometheus user with prior expertise in PromQL, Prometheus' query language. The Code mode editor allows you to create queries just as you would in Prometheus. For more information about Prometheus's query language (PromQL), see [Querying Prometheus](http://prometheus.io/docs/querying/basics/).

{{< figure src="/static/img/docs/prometheus/code-mode.png" max-width="500px" class="docs-image--no-shadow" caption="Code mode" >}}

The user interface (UI) also lets you select metrics, label filter and operations.

<!-- You can also use the [Explain feature]({{< relref "#use-explain-mode-to-understand-queries" >}}) to help understand how a query works, and augment queries by using [template variables]({{< relref "./template-variables/" >}}). -->

You can write complex queries using the text editor with autocompletion features and syntax highlighting.
It also contains a [Metrics browser]({{< relref "#metrics-browser" >}}) to further help you write queries.

### Use autocompletion

Code mode's autocompletion feature works automatically while typing. The query editor can autocomplete static functions, aggregations, keywords, and also dynamic items like metrics and labels.
The autocompletion dropdown includes documentation for the suggested items where available.

<!-- To run a query in [Explore]({{< relref "../../../explore/" >}}), use the keyboard shortcut <key>Shift</key> + <key>Enter</key>. -->

### Metrics browser

The metrics browser locates metrics and selects relevant labels to help you build basic queries.
When you open the browser, it displays all available metrics and labels.
If supported by your Prometheus instance, each metric also displays its HELP and TYPE as a tooltip.

{{< figure src="/static/img/docs/prometheus/metric-browser.png" max-width="500px" class="docs-image--no-shadow" caption="Metrics browser" >}}

When you select a metric, the browser narrows down the available labels to show only the ones applicable to the metric.
You can then select one or more labels for which the available label values are shown in lists in the bottom section.
Select one or more values for each label to tighten your query scope.

> **Note:** If you do not remember a metric name to start with, you can also select a few labels to narrow down the list, then find relevant label values.

All lists in the metrics browser have a search field above them to quickly filter for metrics or labels that match a certain string.
The values section has only one search field, and its filtering applies to all labels to help you find values across labels once selected.

For example, among your labels `app`, `job`, `job_name` only one might with the value you are looking for.

Once you are satisfied with your query, click **Run query**.

<!-- The button "Use as rate query" adds a `rate(...)[$__interval]` around your query to help write queries for counter metrics.
The "Validate selector" button will check with Prometheus how many time series are available for that selector. -->

## Builder mode

**Builder mode** helps you build queries using a visual interface. This option is best for users who do not have previous experience working with Prometheus and PromQL.

This video demonstrates how to use the visual Prometheus query builder available since Grafana v9.0:

{{< vimeo 720004179 >}}

</br>

### Metric and labels

{{< figure src="/static/img/docs/prometheus/metrics-and-labels.png" max-width="500px" class="docs-image--no-shadow" caption="Metric and label filters" >}}

Select a specific metric name from the dropdown list.
The data source requests the list of available metrics from the Prometheus server based on the selected time rage.
You can also enter text into the selector when the dropdown is open to search and filter the list.

Select desired labels and their values from the dropdown list.
When a metric is selected, the data source requests available labels and their values from the server.
Use the `+` button to add a label, and the `x` button to remove a label.

### Operations

{{< figure src="/static/img/docs/prometheus/operations.png" max-width="500px" class="docs-image--no-shadow" caption="Operations" >}}

Select the `+ Operations` button to add operations to your query.
The query editor groups operations into related sections, and you can type while the operations dropdown is open to search and filter the list.

The query editor displays a query's operations as boxes in the operations section.
Each operation's header displays its name, and additional action buttons appear when you hover your cursor over the header:

| Button | Action                                                            |
| ------ | ----------------------------------------------------------------- |
| `v`    | Replaces the operation with different operation of the same type. |
| `info` | Opens the operation's description tooltip.                        |
| `x`    | Removes the operation.                                            |

Some operations have additional parameters under the operation header.
For details about each operation, use the `info` button to view the operation's description, or refer to the Prometheus documentation on [query functions](https://prometheus.io/docs/prometheus/latest/querying/functions/).

Some operations make sense only when used in a specific order.
If adding an operation would result in nonsensical query, the query editor adds the operation to the correct place.
To re-order operations manually, drag the operation box by its name and drop it into the desired place.

#### Hints

{{< figure src="/static/img/docs/prometheus/hint-example.png" max-width="500px" class="docs-image--no-shadow" caption="Hint" >}}

The query editor can detect which operations are most appropriate for some selected metrics.
If it does, it displays a hint next to the `+ Operations` button.

To add the operation to your query, click the `hint`.

## Use Explain mode to understand queries

{{< figure src="/static/img/docs/prometheus/explain-results.png" max-width="500px" class="docs-image--no-shadow" caption="Explain results" >}}

Explain mode helps you understand a query by displaying a step-by-step explanation of all query components and operations.

### Additional options

In addition to these Builder mode-specific options, the query editor also displays the options it shares in common with Code mode.
For details, refer to the [common options]({{< relref "#configure-common-options" >}}).

## Apply annotations

[Annotations]({{< relref "../../../dashboards/build-dashboards/annotate-visualizations" >}}) overlay rich event information on top of graphs.
You can add annotation queries in the Dashboard menu's Annotations view.

Prometheus supports two ways to query annotations.

- A regular metric query
- A Prometheus query for pending and firing alerts (for details see [Inspecting alerts during runtime](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/#inspecting-alerts-during-runtime))

The step option is useful to limit the number of events returned from your query.

extras

To run a query, select **Run query** in the upper right of the editor.
