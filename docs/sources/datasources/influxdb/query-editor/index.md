---
aliases:
  - ../../data-sources/influxdb/query-editor/
  - influxdb-flux/
description: This topic describes the InfluxDB query editor, modes and querying the InfluxDB data source.
labels:
  products:
    - cloud
    - enterprise
    - oss
title: InfluxDB query Editor
menuTitle: Query editor
weight: 400
refs:
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
  panel-inspector:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-inspector/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-inspector/
  logs:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/logs/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#query-editors
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#query-editors
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  configure-influxdb-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure-influxdb-data-source/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure-influxdb-data-source/
---

# InfluxDB query editor

Grafana's query editors are unique to each data source. For general information on Grafana query editors, refer to [Query editors](ref:query-editor). For general information on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

The InfluxDB query editor is located on the [Explore page](ref:explore). You can also access the InfluxDB query editor from a dashboard panel. Click the ellipsis in the upper right of the panel and select **Edit**.

You can also use the query editor to retrieve [log data](#query-logs) and [annotate](#apply-annotations) visualizations.

## Choose a query editing mode

The InfluxDB data source has three different types of query editors, each corresponding to the query language selected in the [data source configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure-influxdb-data-source/#influxdb-configuration-options):

- [InfluxQL](#influxql-query-editor)
- [SQL](#sql-query-editor)
- [Flux](#flux-query-editor)

Editor options vary based on query language.

## InfluxQL query editor

The InfluxQL query editor helps you select metrics and tags to create InfluxQL queries. There are two modes: `visual editor mode` and `raw query mode`. To switch between the two modes click the **pencil icon** in the upper right.

Visual query editor mode contains the following components:

- **FROM** - Select a measurement to query.
- **WHERE** - Select filters by clicking the **+ sign**.
- **SELECT** - Select fields and functions from the drop-down. You can add multiple fields and functions by clicking the **+ sign**.
- **GROUP BY** - Select a tag from the drop-down menu.
- **TIMEZONE** - _Optional_ Group data by a specific timezone.
- **ORDER BY TIME** - Sort data by time in either ascending or descending order.
- **LIMIT** - _Optional_ Limits the number of rows returned by the query.
- **SLIMIT** - _Optional_ Limits the number of series returned by the query. Refer to [SLIMIT clause](https://docs.influxdata.com/influxdb/cloud/query-data/influxql/explore-data/limit-and-slimit/#slimit-clause) for more information on this option.
- **FORMAT AS** - Select a format option from the drop-down menu.
- **ALIAS** - Add an alias. Refer to [Alias patterns](#alias-patterns) for more information.

### Raw query editor mode

You can write raw InfluxQL queries by switching to raw query mode. Click the pencil in the upper right of the query editor to switch modes. Note that when you switch to visual editor mode, you will lose any changes made in raw query mode.

If you use raw query mode, your query must include `WHERE $timeFilter`. You should also provide a group by time and an aggregation function. Otherwise, InfluxDB may return hundreds of thousands of data points, potentially causing your browser to hang.

![InfluxQL query editor](/static/img/docs/influxdb/influxql-query-editor-8-0.png)

### Match by regular expressions

You can enter regular expressions for metric names or tag filter values.
Wrap the regex pattern in forward slashes (`/`), as shown in this example: `/measurement/`.

Grafana automatically adjusts the filter tag condition to use the InfluxDB regex match condition operator (`=~`).

### Field and aggregation functions

In the `SELECT` row, you can specify which fields and functions to use.

If you **group by time** you must use an aggregation function. Certain functions such as `derivative` also require an aggregation function.

If you have the following:

![](/static/img/docs/influxdb/select_editor.png)

The query editor input generates an InfluxDB `SELECT` clause:

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

| Alias pattern     | Replaced with                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$m`              | Measurement name.                                                                                                                                                                                  |
| `$measurement`    | Measurement name.                                                                                                                                                                                  |
| `$1` - `$9`       | Part of measurement name (if you separate your measurement name with dots).                                                                                                                        |
| `$col`            | Column name.                                                                                                                                                                                       |
| `$tag_exampletag` | The value of the `exampletag` tag. The syntax is `$tag*yourTagName` and must start with `$tag*`. To use your tag as an alias in the ALIAS BY field, you must use the tag to group by in the query. |

You can also use the `[[tag_hostname]]` pattern replacement syntax.

For example, entering the value `Host: [[tag_hostname]]` in the ALIAS BY field replaces it with the `hostname` tag value for each legend value.

An example legend value is `Host: server1`.

## SQL query editor

Grafana supports the [SQL query language](https://docs.influxdata.com/influxdb/cloud-serverless/query-data/sql/) in [InfluxDB v3.0](https://www.influxdata.com/blog/introducing-influxdb-3-0/) and higher.

You construct your SQL query directly in the query editor.

### Macros

You can use macros in your query to automatically substitute them with values from Grafana's context.

| Macro example               | Replaced with                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$__timeFrom`               | The start of the currently active time selection, such as `2020-06-11T13:31:00Z`.                                                                                                   |
| `$__timeTo`                 | The end of the currently active time selection, such as `2020-06-11T14:31:00Z`.                                                                                                     |
| `$__timeFilter`             | The time range that applies the start and the end of currently active time selection.                                                                                               |
| `$__interval`               | An interval string that corresponds to Grafana's calculated interval based on the time range of the active time selection, such as `5s`.                                            |
| `$__dateBin(<column>)`      | Applies [date_bin](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/functions/time-and-date/#date_bin) function. Column must be timestamp.                       |
| `$__dateBinAlias(<column>)` | Applies [date_bin](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/functions/time-and-date/#date_bin) function with suffix `_binned`. Column must be timestamp. |

Examples:

```
// with macro
1. SELECT * FROM cpu WHERE time >= $__timeFrom AND time <= $__timeTo
2. SELECT * FROM cpu WHERE $__timeFilter(time)
3. SELECT $__dateBin(time) from cpu

// interpolated
1. SELECT * FROM iox.cpu WHERE time >= cast('2023-12-15T12:38:30Z' as timestamp) AND time <= cast('2023-12-15T18:38:30Z' as timestamp)
2. SELECT * FROM cpu WHERE time >= '2023-12-15T12:41:28Z' AND time <= '2023-12-15T18:41:28Z'
3. SELECT date_bin(interval '15 second', time, timestamp '1970-01-01T00:00:00Z') from cpu
```

## Flux query editor

Grafana supports Flux when running InfluxDB v1.8 and higher.
If your data source is [configured for Flux](ref:configure-influxdb-data-source), you can use
the [Flux](https://docs.influxdata.com/flux/v0/) in the query editor, which serves as
a text editor for raw Flux queries with macro support.

For more information and connection details, refer
to [InfluxDB 1.8 API compatibility](https://github.com/influxdata/influxdb-client-go/#influxdb-18-api-compatibility).

### Use macros

You can enter macros in the query to replace them with values from Grafana's context.
Macros support copying and pasting from [Chronograf](https://www.influxdata.com/time-series-platform/chronograf/).

| Macro example      | Replaced with                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v.timeRangeStart` | The start of the currently active time selection, such as `2020-06-11T13:31:00Z`.                                                                             |
| `v.timeRangeStop`  | The end of the currently active time selection, such as `2020-06-11T14:31:00Z`.                                                                               |
| `v.windowPeriod`   | An interval string compatible with Flux that corresponds to Grafana's calculated interval based on the time range of the active time selection, such as `5s`. |
| `v.defaultBucket`  | The data source configuration's "Default Bucket" setting.                                                                                                     |
| `v.organization`   | The data source configuration's "Organization" setting.                                                                                                       |

For example, consider the following Flux query:

```flux
from(bucket: v.defaultBucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "cpu" or r["_measurement"] == "swap")
  |> filter(fn: (r) => r["_field"] == "usage_system" or r["_field"] == "free")
  |> aggregateWindow(every: v.windowPeriod, fn: mean)
  |> yield(name: "mean")
```

This Flux query is interpolated into the following query and sent to InfluxDB, with the interval and time period values changing according to the active time selection:

```flux
from(bucket: "grafana")
  |> range(start: 2020-06-11T13:59:07Z, stop: 2020-06-11T14:59:07Z)
  |> filter(fn: (r) => r["_measurement"] == "cpu" or r["_measurement"] == "swap")
  |> filter(fn: (r) => r["_field"] == "usage_system" or r["_field"] == "free")
  |> aggregateWindow(every: 2s, fn: mean)
  |> yield(name: "mean")
```

To view the interpolated version of a query with the Query inspector, refer to [Panel Inspector](ref:panel-inspector).

## Query logs

You can query and display log data from InfluxDB in [Explore](ref:explore) and in the dashboard [Logs panel](ref:logs).

Select an InfluxDB data source in the Query editor. Under the **Select measurement field** next to the **FROM** section, choose a measurement containing your log data, then choose the appropriate fields that will display the log message. Add any additional filters by clicking the **+ sign** next to the **WHERE** field. Add additional conditions in the GROUP BY, ORDER BY and the rest of the options.

After InfluxDB returns the results, the log panel displays log rows along with a bar chart. The x-axis represents time, while the y-axis shows the frequency or count.

## Apply annotations

[Annotations](ref:annotations) overlay rich event information on top of graphs.
You can add annotation queries in the dashboard menu's **Annotations view**.

For InfluxDB, your query **must** include `WHERE $timeFilter`.

If you select only one column, you don't need to enter anything in the column mapping fields.

The **Tags** field's value can be a comma-separated string.

### Annotation query example

```sql
SELECT title, description
from events
WHERE $timeFilter
ORDER BY time ASC
```
