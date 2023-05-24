---
aliases:
  - ../../data-sources/loki/query-editor/
description: Guide for using the Loki data source's query editor
keywords:
  - grafana
  - loki
  - logs
  - queries
menuTitle: Query editor
title: Loki query editor
weight: 300
---

# Loki query editor

The Loki data source's query editor helps you create [log]({{< relref "#create-a-log-query" >}}) and [metric]({{< relref "#create-a-metric-query" >}}) queries that use Loki's query language, [LogQL](/docs/loki/latest/logql/).

This topic explains querying specific to the Loki data source.
For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

## Choose a query editing mode

You can switch the Loki query editor between two modes:

- [Code mode]({{< relref "#code-mode" >}}), which provides a feature-rich editor for writing queries
- [Builder mode]({{< relref "#builder-mode" >}}), which provides a visual query designer

To switch between the editor modes, select the corresponding **Builder** and **Code** tabs.

To run a query, select **Run queries** located at the top of the editor.

> **Note:** To run Loki queries in [Explore]({{< relref "../../../explore/" >}}), select **Run query**.

Each mode is synchronized with the other modes, so you can switch between them without losing your work, although there are some limitations.

Builder mode doesn't yet support some complex queries.
When you switch from Code mode to Builder mode with such a query, the editor displays a popup that explains how you might lose parts of the query if you continue.
You can then decide whether you still want to switch to Builder mode.

You can also augment queries by using [template variables]({{< relref "./template-variables/" >}}).

## Code mode

In **Code mode**, you can write complex queries using a text editor with autocompletion features and syntax highlighting.
It also contains a [label browser]({{< relref "#label-browser" >}}) to further help you write queries.

For more information about Loki's query language, refer to the [Loki documentation](/docs/loki/latest/logql/).

### Use autocompletion

Code mode's autocompletion feature works automatically while typing.

The query editor can autocomplete static functions, aggregations, and keywords, and also dynamic items like labels.
The autocompletion dropdown includes documentation for the suggested items where available.

### Label browser

You can use the Loki label browser to navigate through your labels and values, and build queries.

**To navigate Loki and build a query:**

1. Choose labels to locate.
1. Search for the values of your selected labels.

   The search field supports fuzzy search, and the label browser also supports faceting to list only possible label combinations.

1. Choose a query type between [**logs query**]({{< relref "#create-a-log-query" >}}) and [**rate metrics query**]({{< relref "#create-a-metric-query" >}}).
   You can also validate the selector.

{{< figure src="/static/img/docs/v75/loki_log_browser.png" class="docs-image--no-shadow" max-width="800px" caption="The Loki label browser" >}}

### Configure query settings

| Name           | Description                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Type**       | Selects the query type to run. The `instant` type queries against a single point in time. We use the "To" time from the time range. The `range` type queries over the selected range of time.                                                                                  |
| **Line limit** | Defines the upper limit for the number of log lines returned by a query. The default is Loki's configured maximum lines limit.                                                                                                                                                 |
| **Legend**     | _(Available only in a dashboard)_ Controls the time series name, using a name or pattern. For example, `{{hostname}}` is replaced with the label value for the label `hostname`.                                                                                               |
| **Resolution** | Sets the step parameter of Loki metrics range queries. With a resolution of `1/1`, each pixel corresponds to one data point. `1/2` retrieves one data point for every other pixel, `1/10` retrieves one data point per 10 pixels, and so on. Lower resolutions perform better. |

## Builder mode

Use Builder mode to visually construct queries, without needing to manually enter LogQL.

### Review toolbar features

In addition to the **Run query** button and mode switcher, Builder mode provides additional elements:

| Name                      | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Kick start your query** | A list of useful operation patterns you can use to add multiple operations to your query. |
| **Explain**               | Displays a step-by-step explanation of all query components and operations.               |
| **Raw query**             | Displays the raw LogQL query that the Builder would send to Loki.                         |

### Use the Labels selector

Select labels and their values from the dropdown list.
When you select a label, Grafana retrieves available values from the server.

Use the `+` button to add a label and the `x` button to remove a label.

### Operations

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
For details about each operation, use the `info` button to view the operation's description, or refer to the [Loki documentation](/docs/loki/latest/operations/).

Some operations make sense only when used in a specific order.
If adding an operation would result in nonsensical query, the query editor adds the operation to the correct place.
To re-order operations manually, drag the operation box by its name and drop it into the desired place.

#### Hints

In same cases the query editor can detect which operations would be most appropriate for a selected log stream. In such cases it will show a hint next to the `+ Operations` button. Click on the hint to add the operations to your query.

### Explain mode

Explain mode helps with understanding the query. It shows a step by step explanation of all query parts and the operations.

### Raw query

This section is shown only if the `Raw query` switch from the query editor top toolbar is set to `on`. It shows the raw query that will be created and executed by the query editor.

There are two types of LogQL queries:

- Log queries
- Metric queries

## Create a log query

Loki log queries return the contents of the log lines.
You can query and display log data from Loki via [Explore]({{< relref "../../../explore" >}}), and with the [Logs panel]({{< relref "../../../panels-visualizations/visualizations/logs" >}}) in dashboards.

To display the results of a log query, select the Loki data source, then enter a LogQL query.

For more information about log queries and LogQL, refer to the [Loki log queries documentation](/docs/loki/latest/logql/log_queries/).

### Show log context

When using a search expression as detailed above, you can retrieve the context surrounding your filtered results.
By clicking the `Show Context` link on the filtered rows, you'll be able to investigate the log messages that came before and after the
log message you're interested in.

### Tail live logs

Loki supports live tailing of logs in real-time in [Explore]({{< relref "../../../explore#loki-specific-features" >}}).

Live tailing relies on two Websocket connections: one between the browser and Grafana server, and another between the Grafana server and Loki server.

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

> **Note:** Available in Grafana v6.3 and higher.

## Create a metric query

You can use LogQL to wrap a log query with functions that create metrics from your logs.

For more information about metric queries, refer to the [Loki metric queries documentation](/docs/loki/latest/logql/metric_queries/).

## Apply annotations

[Annotations]({{< relref "../../../dashboards/build-dashboards/annotate-visualizations" >}}) overlay rich event information on top of graphs.
You can add annotation queries in the Dashboard menu's Annotations view.

You can use any non-metric Loki query as a source for annotations.
Grafana automatically uses log content as annotation text and your log stream labels as tags.
You don't need to create any additional mapping.
