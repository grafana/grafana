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
weight: 200
review_date: 2026-07-29
---

# Loki query editor

The Loki data source's query editor helps you create [log](#create-a-log-query) and [metric](#create-a-metric-query) queries that use Loki's query language, [LogQL](https://grafana.com/docs/loki/latest/logql/).

For general documentation on querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

## Choose a query editing mode

The Loki query editor has two modes:

- [Builder mode](#builder-mode), which provides a visual query designer.
- [Code mode](#code-mode), which provides a feature-rich editor for writing queries.

To switch between the editor modes, select the corresponding **Builder** and **Code** tabs.

To run a query, select **Run queries** located at the top of the editor.

{{< admonition type="note" >}}
To run Loki queries in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/), select **Run query**.
{{< /admonition >}}

Each mode is synchronized, so you can switch between them without losing your work, although there are some limitations. Builder mode doesn't support some complex queries.
When you switch from Code mode to Builder mode with such a query, the editor displays a warning message that explains how you might lose parts of the query if you continue.
You can then decide whether you still want to switch to Builder mode.

You can also augment queries by using [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/template-variables/).

## Toolbar elements

The query editor toolbar contains the following elements:

- **Kick start your query** - Click to see a list of sample queries that help you quickly start creating LogQL queries. These include log query starters and metric query starters. Click the arrow next to each to see the available query options, then continue to complete your query.

- **Label browser** - Use the Loki label browser to navigate through your labels and values, and build queries.

To navigate Loki and build a query:

1. Choose labels to locate.
1. Search for the values of your selected labels.

   The search field supports fuzzy search, and the label browser also supports faceting to list only possible label combinations.

1. Select the **Show logs** button to display log lines based on the selected labels, or select the **Show logs rate** button to show the rate based on metrics such as requests per second. Additionally, you can validate the selector by clicking the **Validate selector** button. Click **Clear** to start from the beginning.

{{< figure src="/static/img/docs/explore/Loki_label_browser.png" class="docs-image--no-shadow" max-width="800px" caption="The Loki label browser" >}}

- **Explain query** - Toggle to display a step-by-step explanation of all query components and operations.

{{< figure src="/static/img/docs/prometheus/explain-results.png" max-width="500px" class="docs-image--no-shadow" caption="Explain results" >}}

- **Builder/Code** - Click the corresponding **Builder** or **Code** tab on the toolbar to select an editor mode.

## Builder mode

Builder mode helps you build queries using a visual interface without needing to manually enter LogQL. This option is best for users who have limited or no previous experience working with Loki and LogQL.

### Label filters

Select labels and their values from the dropdown list.
When you select a label, Grafana retrieves available values from the server.

Use the `+` button to add a label and the `x` button to remove a label. You can add multiple labels.

Select comparison operators from the following options:

- `=` - equal to
- `!=` - is not equal
- `=~` - matches regex
- `!~` - does not match regex

Select values by using the dropdown, which displays all possible values based on the label selected.

### Operations

Select the `+ Operations` button to add operations to your query.
The query editor groups operations into related sections, and you can type while the operations dropdown is open to search and filter the list.

The query editor displays a query's operations as boxes in the operations section.
Each operation's header displays its name, and additional action buttons appear when you hover your cursor over the header:

| Button                                                                                                                  | Action                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| {{< figure src="/static/img/docs/v95/loki_operation_replace.png" class="docs-image--no-shadow" max-width="30px" >}}     | Replaces the operation with different operation of the same type. |
| {{< figure src="/static/img/docs/v95/loki_operation_description.png" class="docs-image--no-shadow" max-width="30px" >}} | Opens the operation's description tooltip.                        |
| {{< figure src="/static/img/docs/v95/loki_operation_remove.png" class="docs-image--no-shadow" max-width="30px" >}}      | Removes the operation.                                            |

The query editor groups operations into the following sections:

- Aggregations - see [Built-in aggregation operators](https://grafana.com/docs/loki/latest/logql/metric_queries/#built-in-aggregation-operators)
- Range functions - see [Range Vector aggregation](https://grafana.com/docs/loki/latest/logql/metric_queries/#range-vector-aggregation)
- Formats - see [Log queries](https://grafana.com/docs/loki/latest/logql/log_queries/#log-queries)
- Binary operations - see [Binary operators](https://grafana.com/docs/loki/latest/logql/#binary-operators)
- Label filters - see [Label filter expression](https://grafana.com/docs/loki/latest/logql/log_queries/#label-filter-expression)
- Line filters - see [Line filter expression](https://grafana.com/docs/loki/latest/logql/log_queries/#label-filter-expression)

Some operations make sense only when used in a specific order. If adding an operation would result in a nonsensical query, the query editor adds the operation to the correct place.
To reorder operations manually, drag the operation box by its name and drop it into the desired place. For more information, refer to [Order of operations](https://grafana.com/docs/loki/latest/logql/#order-of-operations).

### Hints

In some cases, the query editor can detect which operations are most appropriate for a selected log stream. When it does, it shows a hint next to the **+ Operations** button. Click the hint to add the operations to your query.

### Builder mode example

The following steps build a metric query that counts the rate of error lines for the `payments` app, without writing any LogQL:

1. Under **Label filters**, select the `app` label and the value `payments`.
1. Select **+ Operations**, then from **Line filters** add a **Line contains** operation and enter `error`.
1. Select **+ Operations** again, then from **Range functions** add **Rate** with a range of `[5m]`.
1. From **Aggregations**, add **Sum** to combine the results into a single series.

The builder produces the equivalent LogQL query:

```logql
sum(rate({app="payments"} |= `error` [5m]))
```

Switch to [Code mode](#code-mode) at any time to view or refine the generated query.

## Code mode

In **Code mode**, you can write complex queries using a text editor with autocompletion, syntax highlighting, and query validation.
It also provides the [label browser](#toolbar-elements) to further help you write queries.

For more information about Loki's query language, refer to the [Loki documentation](https://grafana.com/docs/loki/latest/logql/).

### Use autocompletion

Code mode's autocompletion feature works automatically while typing.

The query editor can autocomplete static functions, aggregations, and keywords, and also dynamic items like labels.
The autocompletion dropdown includes documentation for the suggested items where available.

## Options

The following options are the same for both **Builder** and **Code** mode:

- **Legend** - Controls the time series name, using a name or pattern. For example, `{{hostname}}` is replaced with the label value for the label `hostname`.

- **Type** - Selects the query type to run. The `instant` type queries against a single point in time, using the **To** time from the time range. The `range` type queries over the selected range of time.

- **Line limit** - Defines the upper limit for the number of log lines returned by a query. The default is `1000`.

- **Direction** - Determines the search order. **Backward** is a backward search starting at the end of the time range. **Forward** is a forward search starting at the beginning of the time range. The default is **Backward**.

- **Step** - Sets the step parameter of Loki metric queries. The default value equals the value of the `$__auto` variable, which Grafana calculates using the time range and the width of the graph in pixels.

## Create a log query

Loki log queries return the contents of the log lines.
You can query and display log data from Loki via [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/), and with the [Logs panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/) in dashboards.

To display the results of a log query, select the Loki data source, then enter a LogQL query.

For more information about log queries and LogQL, refer to the [Loki log queries documentation](https://grafana.com/docs/loki/latest/logql/log_queries/).

### Log query examples

A log query has two parts: a stream selector that chooses log streams by label, and an optional pipeline that filters and parses the matching lines. Replace the label matchers with values from your own logs.

Return every log line from the `payments` app:

```logql
{app="payments"}
```

Keep only lines that contain the word `error`, and drop health-check noise:

```logql
{app="payments"} |= `error` != `healthcheck`
```

Match lines with a regular expression, for example any 4xx or 5xx status:

```logql
{app="nginx"} |~ `status=(4|5)..`
```

Parse structured logs, then filter on an extracted field. This example parses logfmt logs and keeps requests slower than 500 ms:

```logql
{app="payments"} | logfmt | duration > 500ms
```

Parse JSON logs and keep only error-level entries:

```logql
{namespace="prod", app="checkout"} | json | level=`error`
```

**Use case: debug a failing service.** Combine a namespace and app selector with a parser and label filter to isolate the errors for one service during an incident:

```logql
{namespace="prod", app="checkout"} |= `error` | logfmt | status >= 500
```

### Show log context

In Explore, you can retrieve the context surrounding your log results by clicking the **Show context** button. You can then investigate the logs from the same log stream that came before and after the log message you're interested in.

The initial log context query is created from all labels defining the stream for the selected log line. You can use the log context query editor to widen the search by removing one or more of the label filters from the log stream. If you used a parser in your original query, you can refine your search by using extracted label filters.

You can also adjust the size of the time window that the log context loads, so you can expand or narrow the range of surrounding logs without leaving the context view.

To reduce the repetition of selecting and removing the same labels when examining multiple log context windows, Grafana stores your selected labels and applies them to each open context window. This lets you navigate through various log context windows without having to reapply your filters.

To reset filters and use the initial log context query, click the **Revert to initial query** button next to the query preview.

### Tail live logs

Loki supports live tailing of logs in real-time in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

Live tailing relies on two Websocket connections: one between the browser and Grafana server, and another between the Grafana server and Loki server.

To start tailing logs click the **Live** button in the top right corner of the Explore view.
{{< figure src="/static/img/docs/v95/loki_tailing.png" class="docs-image--no-shadow" max-width="80px" >}}

#### Proxying examples

If you use reverse proxies, configure them accordingly to use live tailing:

**Using Apache2 for proxying between the browser and the Grafana server:**

```
ProxyPassMatch "^/(api/datasources/proxy/\d+/loki/api/v1/tail)" "ws://127.0.0.1:3000/$1"
```

**Using NGINX:**

This example provides a basic NGINX proxy configuration.
It assumes that the Grafana server is available at `http://localhost:3000/`, the Loki server is running locally without proxy, and your external site uses HTTPS.
If you also host Loki behind an NGINX proxy, repeat the following configuration for Loki.

In the `http` section of NGINX configuration, add the following map definition:

```
  map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
  }
```

In your `server` section, add the following configuration:

```
  location ~ /(api/datasources/proxy/\d+/loki/api/v1/tail) {
      proxy_pass          http://localhost:3000$request_uri;
      proxy_set_header    Host              $host;
      proxy_set_header    X-Real-IP         $remote_addr;
      proxy_set_header    X-Forwarded-for   $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Proto "https";
      proxy_set_header    Connection        $connection_upgrade;
      proxy_set_header    Upgrade           $http_upgrade;
  }

  location / {
      proxy_pass          http://localhost:3000/;
      proxy_set_header    Host              $host;
      proxy_set_header    X-Real-IP         $remote_addr;
      proxy_set_header    X-Forwarded-for   $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Proto "https";
  }
```

## Create a metric query

You can use LogQL to wrap a log query with functions that create metrics from your logs.

For more information about metric queries, refer to the [Loki metric queries documentation](https://grafana.com/docs/loki/latest/logql/metric_queries/).

### Metric query examples

Metric queries apply a range aggregation, such as `rate` or `count_over_time`, over a log query and an optional range like `[5m]`. You can then wrap the result in an aggregation operator, such as `sum` or `topk`, to group or rank the series.

Count the rate of error lines per second across the `payments` app:

```logql
sum(rate({app="payments"} |= `error` [5m]))
```

Break the request rate down by status code:

```logql
sum by (status) (rate({app="nginx"} | logfmt [5m]))
```

Count how many timeouts occurred in the last hour:

```logql
count_over_time({app="payments"} |= `timeout` [1h])
```

Calculate the 95th percentile request duration per route. This example parses logfmt logs and unwraps the numeric `duration` field:

```logql
quantile_over_time(0.95, {app="payments"} | logfmt | unwrap duration [5m]) by (route)
```

**Use case: find the noisiest endpoints.** Rank the top 10 request paths by log volume over the last hour:

```logql
topk(10, sum by (path) (count_over_time({app="nginx"} | logfmt [1h])))
```

## Query splitting

To keep large queries responsive, Grafana automatically splits Loki queries that cover a long time range into a series of smaller sub-queries. Grafana runs the sub-queries and merges the results, and the query progresses incrementally so you see partial results as they arrive. Query splitting applies to both log and metric queries and requires no configuration.

## Structured metadata

Loki stores three types of labels: indexed labels, parsed fields, and structured metadata. The query editor and log details treat all three types as labels you can filter on and use in [derived fields](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/#derived-fields). For more information, refer to the [Loki structured metadata documentation](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/).

## Apply annotations

You can use Loki log queries as a source for dashboard annotations. For details, refer to [Loki annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/annotations/).
