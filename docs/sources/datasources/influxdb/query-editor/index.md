---
aliases:
  - ../../data-sources/influxdb/query-editor/
  - influxdb-flux/
description: Guide for using the InfluxDB query editor in Grafana
keywords:
  - grafana
  - influxdb
  - query editor
  - influxql
  - flux
  - sql
  - macros
labels:
  products:
    - cloud
    - enterprise
    - oss
title: InfluxDB query editor
menuTitle: Query editor
weight: 400
review_date: 2026-05-01
---

# InfluxDB query editor

Each data source in Grafana has a unique query editor. For general information on query editors, refer to [Query editors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#query-editors). For general information on querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

The InfluxDB query editor is located on the [Explore page](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/). You can also access the InfluxDB query editor from a dashboard panel. Click the ellipsis in the upper right of the panel and select **Edit**.

You can also use the query editor to retrieve [log data](#query-logs).

## Before you begin

- Ensure you have [configured the InfluxDB data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/).
- Verify your credentials have appropriate permissions to query the target database or bucket.

## Key concepts

If you're new to InfluxDB, these terms are used throughout the query editor:

| Term | Description |
| ---- | ----------- |
| **Measurement** | A logical grouping of fields, tags, and timestamps, similar to a table in a relational database. |
| **Field** | A column in a measurement that stores the actual data values (numbers, strings, Boolean values). |
| **Tag** | A column used for metadata and indexing. Tags are indexed and optimized for filtering. |
| **Retention policy** | An InfluxDB 1.x setting that controls how long data is stored before automatic deletion. |
| **Bucket** | An InfluxDB 2.x and 3.x storage location that combines a database and retention policy. |

## Choose a query editor

The InfluxDB data source has three query editors, each corresponding to the query language selected in the [data source configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/):

- [InfluxQL](#influxql-query-editor)
- [SQL](#sql-query-editor)
- [Flux](#flux-query-editor)

Editor options vary based on query language.

## InfluxQL query editor

The InfluxQL query editor helps you select metrics and tags to create InfluxQL queries. There are two modes: `visual editor mode` and `raw query mode`. To switch between the two modes click the **pencil icon** in the upper right.

Visual query editor mode contains the following components:

- **FROM** - Select a measurement to query.
- **WHERE** - Select filters by clicking the **+ sign**. You can enter regular expressions or use the text input for regular expression tag values.
- **SELECT** - Select fields and functions from the drop-down. You can add multiple fields and functions by clicking the **+ sign**.
- **GROUP BY** - Select a tag from the drop-down menu.
- **TIMEZONE** - _Optional_ Group data by a specific timezone.
- **ORDER BY TIME** - Sort data by time in either ascending or descending order.
- **LIMIT** - _Optional_ Limits the number of rows returned by the query.
- **SLIMIT** - _Optional_ Limits the number of series returned by the query. Refer to [SLIMIT clause](https://docs.influxdata.com/influxdb/cloud/query-data/influxql/explore-data/limit-and-slimit/#slimit-clause) for more information.
- **FORMAT AS** - Select a format option from the drop-down menu: time series, table, or logs.
- **ALIAS** - Add an alias. Refer to [Alias patterns](#alias-patterns) for more information.

### Raw query editor mode

You can write raw InfluxQL queries by switching to raw query mode. Click the pencil in the upper right of the query editor to switch modes. When you switch to visual editor mode, any changes made in raw query mode are lost.

If you use raw query mode, your query must include `WHERE $timeFilter`. You should also provide a group by time and an aggregation function. Otherwise, InfluxDB may return hundreds of thousands of data points, potentially causing your browser to hang.

### Match by regular expressions

You can enter regular expressions for metric names or tag filter values.
Wrap the regular expression pattern in forward slashes (`/`), as shown in this example: `/measurement/`.

Grafana automatically adjusts the filter tag condition to use the InfluxDB regular expression match condition operator (`=~`).

### Field and aggregation functions

In the `SELECT` row, you can specify which fields and functions to use.

If you **group by time** you must use an aggregation function. Certain functions such as `derivative` also require an aggregation function.

The query editor input generates an InfluxDB `SELECT` clause. For example:

```sql
SELECT derivative(mean("value"), 10s) / 10 AS "REQ/s"
FROM....
```

You can also use a \* in a SELECT statement to select all fields.

```sql
SELECT * FROM <measurement_name>
```

### GROUP BY results

To group results by a tag, specify the tag in the **GROUP BY** row:

1. Click the **+ sign** in the GROUP BY row.
1. Select a tag from the drop-down.

You can GROUP BY multiple options.

To remove a GROUP BY option click the **X icon** next to the option.

### Alias patterns

| Alias pattern     | Replaced with |
| ----------------- | ------------- |
| `$m`              | Measurement name. |
| `$measurement`    | Measurement name. |
| `$1` - `$9`       | Part of measurement name (if you separate your measurement name with dots). |
| `$col`            | Column name. |
| `$tag_exampletag` | The value of the `exampletag` tag. The syntax is `$tag_yourTagName` and must start with `$tag_`. To use your tag as an alias in the ALIAS BY field, you must use the tag to group by in the query. |

You can also use the `[[tag_hostname]]` pattern replacement syntax.

For example, entering the value `Host: [[tag_hostname]]` in the ALIAS BY field replaces it with the `hostname` tag value for each legend value.

An example legend value is `Host: server1`.

## SQL query editor

Grafana supports the [SQL query language](https://docs.influxdata.com/influxdb/cloud-serverless/query-data/sql/) for InfluxDB 3.x and newer cloud products (Cloud Serverless, Cloud Dedicated, Clustered). SQL is InfluxData's recommended query language for new deployments.

The SQL query editor provides two modes:

- **Builder mode** - A visual query builder that helps you construct SQL queries by selecting tables, columns, filters, and aggregations from drop-down menus. This mode is useful for building queries without writing SQL directly.
- **Code mode** - A text editor for writing raw SQL queries with autocomplete and syntax highlighting. Switch between modes using the toggle at the top of the query editor.

SQL queries connect to InfluxDB using the FlightSQL (gRPC) protocol, which provides high-performance data transfer for large result sets.

### Format output

The SQL query editor supports two output formats:

- **Time series** (default) - Returns data as time-series frames. The query must include a timestamp column.
- **Table** - Returns data as a table frame, useful for non-time-series queries or when you want to display raw results.

Select the format from the **Format** drop-down in the query editor.

### Macros

You can use macros in your query to automatically substitute them with values from the Grafana context.

| Macro example               | Replaced with |
| --------------------------- | ------------- |
| `$__timeFrom`               | The start of the currently active time selection, such as `cast('2020-06-11T13:31:00Z' as timestamp)`. |
| `$__timeTo`                 | The end of the currently active time selection, such as `cast('2020-06-11T14:31:00Z' as timestamp)`. |
| `$__timeFilter(<column>)`   | A time range filter applied to the specified column. Expands to `<column> >= $__timeFrom AND <column> <= $__timeTo`. |
| `$__interval`               | An interval string that corresponds to the Grafana calculated interval based on the time range of the active time selection, such as `interval '5 second'`. |
| `$__dateBin(<column>)`      | Applies the [`date_bin`](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/functions/time-and-date/#date_bin) function using `$__interval`. Column must be a timestamp. |
| `$__dateBinAlias(<column>)` | Applies the [`date_bin`](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/functions/time-and-date/#date_bin) function with a `_binned` suffix alias. Column must be a timestamp. |
| `$__timeGroup(<column>)`    | Groups results by a time interval using `date_bin()` with `$__interval`. Column must be a timestamp. |
| `$__timeGroupAlias(<column>)` | Groups results by a time interval using `date_bin()` with `$__interval` and adds a `_binned` suffix alias. Column must be a timestamp. |

### SQL query examples

**Basic time-series query:**

```sql
SELECT time, usage_system, usage_user
FROM cpu
WHERE $__timeFilter(time)
ORDER BY time
```

**Aggregated time-series query with date_bin:**

```sql
SELECT
  $__dateBin(time),
  mean(usage_system) AS avg_system,
  mean(usage_user) AS avg_user
FROM cpu
WHERE $__timeFilter(time)
GROUP BY $__dateBin(time)
ORDER BY time
```

**Using JOINs across tables:**

SQL supports JOINs, which aren't available in InfluxQL or Flux:

```sql
SELECT
  c.time,
  c.usage_system,
  m.used_percent AS mem_used
FROM cpu c
INNER JOIN mem m ON c.time = m.time AND c.host = m.host
WHERE $__timeFilter(c.time)
ORDER BY c.time
```

**Filtering with WHERE clauses:**

```sql
SELECT $__dateBin(time), mean(usage_system) AS avg_system
FROM cpu
WHERE $__timeFilter(time)
  AND host = 'server01'
  AND cpu = 'cpu-total'
GROUP BY $__dateBin(time)
ORDER BY time
```

For the full list of supported SQL statements, operators, and functions, refer to InfluxData's [SQL reference documentation](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/).

## Flux query editor

Grafana supports Flux when running InfluxDB v1.8 and higher.
If your data source is [configured for Flux](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/), you can use
the [Flux](https://docs.influxdata.com/flux/v0/) in the query editor, which serves as
a text editor for raw Flux queries with macro support.

For more information and connection details, refer
to [InfluxDB 1.8 API compatibility](https://github.com/influxdata/influxdb-client-go/#influxdb-18-api-compatibility).

### Use macros

You can enter macros in the query to replace them with values from the Grafana context.
<!-- vale Grafana.Spelling = NO -->
Macros support copying and pasting from [InfluxData Chronograf](https://www.influxdata.com/time-series-platform/chronograf/).
<!-- vale Grafana.Spelling = YES -->

| Macro example      | Replaced with |
| ------------------ | ------------- |
| `v.timeRangeStart` | The start of the currently active time selection, such as `2020-06-11T13:31:00Z`. |
| `v.timeRangeStop`  | The end of the currently active time selection, such as `2020-06-11T14:31:00Z`. |
| `v.windowPeriod`   | An interval string compatible with Flux that corresponds to the Grafana calculated interval based on the time range of the active time selection, such as `5s`. |
| `v.defaultBucket`  | The **Default Bucket** value from the data source configuration. |
| `v.organization`   | The data source configuration's **Organization** setting. |

For example, consider the following Flux query:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "cpu" or r["_measurement"] == "swap")
  |> filter(fn: (r) => r["_field"] == "usage_system" or r["_field"] == "free")
  |> aggregateWindow(every: v.windowPeriod, fn: mean)
  |> yield(name: "mean")
```

Grafana interpolates this Flux query into the following and sends it to InfluxDB, with the interval and time period values changing according to the active time selection:

```flux
from(bucket: "grafana")
  |> range(start: 2020-06-11T13:59:07Z, stop: 2020-06-11T14:59:07Z)
  |> filter(fn: (r) => r["_measurement"] == "cpu" or r["_measurement"] == "swap")
  |> filter(fn: (r) => r["_field"] == "usage_system" or r["_field"] == "free")
  |> aggregateWindow(every: 2s, fn: mean)
  |> yield(name: "mean")
```

To view the interpolated version of a query with the Query inspector, refer to [Panel Inspector](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-inspector/).

## Query logs

You can query and display log data from InfluxDB in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) and in the dashboard [Logs panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/).

**InfluxQL:** Select an InfluxDB data source in the query editor. Under the **Select measurement field** next to the **FROM** section, choose a measurement containing your log data, then choose the appropriate fields that will display the log message. Add any additional filters by clicking the **+ sign** next to the **WHERE** field. Set **FORMAT AS** to **Logs**.

**SQL:** Write a SQL query that returns a timestamp column and a text column containing the log message. Set the **Format** to **Table**. For example:

```sql
SELECT time, message, level, host
FROM syslog
WHERE $__timeFilter(time)
ORDER BY time DESC
```

**Flux:** Use a Flux query with the `_value` field containing the log message.

After InfluxDB returns the results, the log panel displays log rows along with a bar chart. The x-axis represents time, while the y-axis shows the frequency or count.

## Next steps

- [Use template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/template-variables/) for dynamic dashboards.
- [Set up annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/annotations/) to overlay events on your graphs.
- [Create alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/alerting/) based on your InfluxDB queries.
