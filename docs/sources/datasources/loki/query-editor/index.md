---
aliases:
  - ../../data-sources/loki/query-editor/
description: Guide for using the Loki data source's query editor
keywords:
  - grafana
  - loki
  - logs
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Loki query editor
weight: 300
refs:
  logs:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/template-variables/
  configure-loki:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
  loki-troubleshooting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/troubleshooting/
---

# Loki query editor

The Loki data source query editor helps you create [log](#create-a-log-query) and [metric](#create-a-metric-query) queries using [LogQL](https://grafana.com/docs/loki/latest/logql/), Loki's query language.

You can query and display log data from Loki in [Explore](ref:explore) and in dashboards using the [Logs panel](ref:logs).

For general documentation on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

## Before you begin

- [Configure the Loki data source](ref:configure-loki).
- Familiarize yourself with [LogQL](https://grafana.com/docs/loki/latest/logql/).

## Choose a query editing mode

The Loki query editor has two modes:

- **Builder mode** - Build queries using a visual interface without manually entering LogQL. Best for users new to Loki and LogQL.
- **Code mode** - Write queries using a text editor with autocompletion, syntax highlighting, and query validation.

To switch between modes, select the **Builder** or **Code** tab at the top of the editor.

Both modes are synchronized, so you can switch between them without losing your work. However, Builder mode doesn't support some complex queries. When switching from Code mode to Builder mode with an unsupported query, the editor displays a warning explaining which parts of the query might be lost.

## Toolbar features

The query editor toolbar provides features available in both Builder and Code mode.

### Kick start your query

Click **Kick start your query** to see a list of example queries that help you get started quickly. These include:

- Log query starters
- Metric query starters

Click the arrow next to each category to see available query templates. Selecting a template populates the query editor with a starting query you can customize.

### Label browser

Use the label browser to explore available labels and values in your Loki instance:

1. Click **Label browser** in the toolbar.
1. Select labels to filter.
1. Search for values using the search field, which supports fuzzy matching.

The label browser supports faceting to show only valid label combinations.

Click **Show logs** to display log lines based on the selected labels, or **Show logs rate** to show a rate metric. Use **Validate selector** to check your selection, or **Clear** to start over.

{{< figure src="/static/img/docs/explore/Loki_label_browser.png" class="docs-image--no-shadow" max-width="800px" caption="The Loki label browser" >}}

### Explain query

Toggle **Explain query** to display a step-by-step explanation of all query components and operations. This helps you understand how your query works and learn LogQL syntax.

{{< figure src="/static/img/docs/prometheus/explain-results.png" max-width="500px" class="docs-image--no-shadow" caption="Explain query results" >}}

## Build a query in Builder mode

Builder mode provides a visual interface for constructing LogQL queries without writing code.

### Select labels

Start by selecting labels to filter your log streams:

1. Select a label from the **Label** dropdown.
1. Choose a comparison operator:
   - `=` - equals
   - `!=` - does not equal
   - `=~` - matches regex
   - `!~` - does not match regex
1. Select a value from the **Value** dropdown, which displays available values for the selected label.

Use the `+` button to add additional label filters and the `x` button to remove them.

### Add operations

Select the **+ Operations** button to add operations to your query. The query editor groups operations into the following categories:

- **Aggregations** - refer to [Built-in aggregation operators](https://grafana.com/docs/loki/latest/logql/metric_queries/#built-in-aggregation-operators)
- **Range functions** - refer to [Range Vector aggregation](https://grafana.com/docs/loki/latest/logql/metric_queries/#range-vector-aggregation)
- **Formats** - refer to [Log queries](https://grafana.com/docs/loki/latest/logql/log_queries/#log-queries)
- **Binary operations** - refer to [Binary operators](https://grafana.com/docs/loki/latest/logql/#binary-operators)
- **Label filters** - refer to [Label filter expression](https://grafana.com/docs/loki/latest/logql/log_queries/#label-filter-expression)
- **Line filters** - refer to [Line filter expression](https://grafana.com/docs/loki/latest/logql/log_queries/#line-filter-expression)

You can type while the operations dropdown is open to search and filter the list.

Each operation appears as a box in the query editor. Hover over an operation's header to reveal action buttons:

| Button | Action |
| ------ | ------ |
| {{< figure src="/static/img/docs/v95/loki_operation_replace.png" class="docs-image--no-shadow" max-width="30px" >}} | Replace the operation with a different operation of the same type. |
| {{< figure src="/static/img/docs/v95/loki_operation_description.png" class="docs-image--no-shadow" max-width="30px" >}} | Open the operation's description tooltip. |
| {{< figure src="/static/img/docs/v95/loki_operation_remove.png" class="docs-image--no-shadow" max-width="30px" >}} | Remove the operation. |

Some operations only make sense in a specific order. If adding an operation would result in an invalid query, the editor automatically places it in the correct position. To re-order operations manually, drag the operation box by its name and drop it in the desired location.

For more information, refer to [Order of operations](https://grafana.com/docs/loki/latest/logql/#order-of-operations).

### Query preview

As you build your query, the editor displays a visual preview of the query structure. Each step is numbered and includes a description:

- **Step 1** typically shows your label selector (for example, `{}` with "Fetch all log lines matching label filters")
- **Subsequent steps** show operations you've added (for example, `|= ""` with "Return log lines that contain string")

The raw LogQL query is displayed at the bottom of the query editor, showing the complete syntax that will be executed.

### Hints

The query editor can detect which operations would be most appropriate for a selected log stream. When available, a hint appears next to the **+ Operations** button. Click the hint to add the suggested operations to your query.

## Write a query in Code mode

Code mode provides a text editor for writing LogQL queries directly. This mode is ideal for complex queries or users familiar with LogQL syntax.

### Autocompletion

Autocompletion works automatically as you type. The editor can autocomplete:

- Static functions, aggregations, and keywords
- Dynamic items like labels and label values

The autocompletion dropdown includes documentation for suggested items where available.

## Configure query options

The following options are available in both Builder and Code mode. Expand the **Options** section to configure them.

| Option | Description |
| ------ | ----------- |
| **Legend** | Controls the time series name using a name or pattern. For example, `{{hostname}}` is replaced with the label value for the label `hostname`. |
| **Type** | Selects the query type. `instant` queries a single point in time (uses the "To" time from the time range). `range` queries over the selected time range. |
| **Line limit** | Defines the maximum number of log lines returned by a query. Default is `1000`. |
| **Direction** | Determines the search order. **Backward** searches from the end of the time range (default). **Forward** searches from the beginning. |
| **Step** | Sets the step parameter for metric queries. Default is `$__auto`, calculated using the time range and graph width. |

### Query stats

The Options section displays query statistics to help you estimate the size and cost of your query before running it. Stats include:

- **Streams** - Number of log streams matching your label selectors
- **Chunks** - Number of data chunks to be scanned
- **Bytes** - Estimated data size
- **Entries** - Estimated number of log entries

These statistics update automatically as you build your query and can help you optimize queries to reduce load on your Loki instance.

## Run a query

To execute your query, click **Run queries** at the top of the query editor. The results display in the visualization panel below the editor.

In Explore, you can also press `Shift+Enter` to run the query.

## Create a log query

Log queries return the contents of log lines. These are the most common type of Loki query.

To create a log query:

1. Select labels to filter your log streams.
1. Optionally add line filters to search for specific text patterns.
1. Optionally add parsers (like `json` or `logfmt`) to extract fields from log lines.
1. Click **Run queries** to execute the query.

For more information about log queries and LogQL, refer to the [Loki log queries documentation](https://grafana.com/docs/loki/latest/logql/log_queries/).

### Show log context

In Explore, click **Show Context** on any log line to view the surrounding logs from the same log stream.

The initial context query uses all labels from the selected log line. You can widen the search by removing label filters in the log context query editor. If your original query used a parser, you can also refine the search using extracted label filters.

Grafana stores your label selections and applies them to each context window you open, so you don't need to reapply filters when examining multiple log lines.

To reset filters, click **Revert to initial query** next to the query preview.

## Create a metric query

Metric queries use LogQL to extract numeric data from logs. You wrap a log query with aggregation functions to create time series data for visualization and alerting.

### Common metric query patterns

| Function | Description | Example |
| -------- | ----------- | ------- |
| `rate()` | Calculates the number of log entries per second | `rate({job="app"}[5m])` |
| `count_over_time()` | Counts log entries over the specified interval | `count_over_time({job="app"}[1h])` |
| `bytes_rate()` | Calculates bytes per second of log entries | `bytes_rate({job="app"}[5m])` |
| `sum_over_time()` | Sums extracted numeric values | `sum_over_time({job="app"} \| unwrap duration [5m])` |

### Build a metric query

To create a metric query in Builder mode:

1. Select labels to filter your log streams.
1. Click **+ Operations** and select a range function (for example, **Rate**).
1. The editor wraps your log selector with the function and adds a time interval.
1. Optionally add aggregations like `sum`, `avg`, or `max` to combine results.

In Code mode, enter the full LogQL expression directly:

```logql
sum(rate({job="app", level="error"}[5m])) by (instance)
```

This query calculates the per-second rate of error logs, then sums the results grouped by instance.

For more information, refer to the [Loki metric queries documentation](https://grafana.com/docs/loki/latest/logql/metric_queries/).

## Tail live logs

Loki supports live tailing of logs in real-time in [Explore](ref:explore).

To start tailing logs, click the **Live** button in the top right corner of the Explore view.

{{< figure src="/static/img/docs/v95/loki_tailing.png" class="docs-image--no-shadow" max-width="80px" >}}

Live tailing relies on two WebSocket connections: one between the browser and Grafana server, and another between the Grafana server and Loki server.

If you use reverse proxies, you may need to configure them to support WebSocket connections. For proxy configuration examples, refer to the [Loki troubleshooting documentation](ref:loki-troubleshooting).

## Use template variables

You can use template variables in your queries to create dynamic, reusable dashboards. Template variables appear as dropdown menus at the top of dashboards, allowing users to change query parameters without editing the query directly.

For information on creating and using template variables with Loki, refer to [Loki template variables](ref:template-variables).
