---
description: Use template variables with the OpenTSDB data source in Grafana
keywords:
  - grafana
  - opentsdb
  - template
  - variables
  - dashboard
  - dynamic
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: OpenTSDB template variables
weight: 300
last_reviewed: 2026-01-28
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  troubleshooting-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
---

# OpenTSDB template variables

Instead of hard-coding server, application, and sensor names in your metric queries, you can use template variables. Variables appear as drop-down menus at the top of the dashboard, making it easy to change the data being displayed without editing queries.

For an introduction to template variables, refer to the [Variables](ref:variables) documentation.

## Query variable

The OpenTSDB data source supports query-type template variables that fetch values directly from OpenTSDB. These variables dynamically populate based on data in your OpenTSDB database.

### Supported query functions

| Query                        | Description                                                                      | API used                    |
| ---------------------------- | -------------------------------------------------------------------------------- | --------------------------- |
| `metrics(prefix)`            | Returns metric names matching the prefix. Use empty parentheses for all metrics. | `/api/suggest?type=metrics` |
| `tag_names(metric)`          | Returns tag keys (names) that exist for a specific metric.                       | `/api/search/lookup`        |
| `tag_values(metric, tagkey)` | Returns tag values for a specific metric and tag key.                            | `/api/search/lookup`        |
| `suggest_tagk(prefix)`       | Returns tag keys matching the prefix across all metrics.                         | `/api/suggest?type=tagk`    |
| `suggest_tagv(prefix)`       | Returns tag values matching the prefix across all metrics.                       | `/api/suggest?type=tagv`    |

{{< admonition type="note" >}}
The `tag_names` and `tag_values` functions use the OpenTSDB lookup API, which requires metrics to exist in your database. The `suggest_tagk` and `suggest_tagv` functions use the suggest API, which searches across all metrics.
{{< /admonition >}}

### Create a query variable

To create a query variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Enter a **Name** for your variable (for example, `host`).
1. Select **Query** as the variable type.
1. Select the **OpenTSDB** data source.
1. Enter your query using one of the supported query functions.
1. Optionally configure **Multi-value** to allow selecting multiple values.
1. Optionally configure **Include All option** to add an "All" option.
1. Click **Apply**.

### Query variable examples

**List all metrics:**

```
metrics()
```

Returns all metric names in your OpenTSDB database. Useful for creating a metric selector.

**List metrics with a prefix:**

```
metrics(sys.cpu)
```

Returns metrics starting with `sys.cpu`, such as `sys.cpu.user`, `sys.cpu.system`, `sys.cpu.idle`.

**List tag keys for a metric:**

```
tag_names(sys.cpu.user)
```

Returns tag keys like `host`, `env`, `datacenter` that exist on the `sys.cpu.user` metric.

**List tag values for a metric and tag key:**

```
tag_values(sys.cpu.user, host)
```

Returns all host values for the `sys.cpu.user` metric, such as `webserver01`, `webserver02`, `dbserver01`.

**Search for tag keys by prefix:**

```
suggest_tagk(host)
```

Returns tag keys matching `host` across all metrics, such as `host`, `hostname`, `host_id`.

**Search for tag values by prefix:**

```
suggest_tagv(web)
```

Returns tag values matching `web` across all metrics, such as `webserver01`, `webserver02`, `web-prod-01`.

If template variables aren't populating in the **Preview of values** section, refer to [Troubleshooting](ref:troubleshooting-opentsdb).

## Nested template variables

You can use one template variable to filter values for another. This creates cascading filters, such as selecting a data center first, then showing only hosts in that data center.

### Filter syntax

The `tag_values` function accepts additional tag filters after the tag key:

```
tag_values(metric, tagkey, tag1=value1, tag2=value2, ...)
```

Use template variables as filter values to create dynamic dependencies:

```
tag_values(metric, tagkey, tag1=$variable1, tag2=$variable2)
```

### Nested variable examples

| Query                                                      | Description                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `tag_values(sys.cpu.user, host, env=$env)`                 | Returns host values filtered by the selected `env` value.    |
| `tag_values(sys.cpu.user, host, env=$env, datacenter=$dc)` | Returns host values filtered by both `env` and `datacenter`. |
| `tag_values(app.requests, endpoint, service=$service)`     | Returns endpoint values for the selected service.            |

### Create cascading filters

To create a hierarchy of dependent variables:

1. **Create the parent variable:**
   - Name: `datacenter`
   - Query: `tag_values(sys.cpu.user, datacenter)`

2. **Create the child variable:**
   - Name: `host`
   - Query: `tag_values(sys.cpu.user, host, datacenter=$datacenter)`

3. **Create additional levels as needed:**
   - Name: `cpu`
   - Query: `tag_values(sys.cpu.user, cpu, datacenter=$datacenter, host=$host)`

When users change the data center selection, the host variable automatically refreshes to show only hosts in that data center.

## Use variables in queries

Reference variables in your queries using the `$variablename` or `${variablename}` syntax. Grafana replaces the variable with its current value when the query executes.

### Where to use variables

Variables can be used in these query editor fields:

| Field                   | Example             | Description                                 |
| ----------------------- | ------------------- | ------------------------------------------- |
| **Metric**              | `$metric`           | Dynamically select which metric to query.   |
| **Tag value**           | `host=$host`        | Filter by a variable-selected tag value.    |
| **Filter value**        | `$host`             | Use in filter value field for filtering.    |
| **Alias**               | `$tag_host - $host` | Include variable values in legend labels.   |
| **Downsample interval** | `$interval`         | Use a variable for the downsample interval. |

### Variable syntax options

| Syntax                   | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `$variablename`          | Simple syntax for most cases.                                                    |
| `${variablename}`        | Use when the variable is adjacent to other text (for example, `${host}_suffix`). |
| `${variablename:format}` | Apply a specific format to the variable value.                                   |

## Multi-value variables

When you enable **Multi-value** for a variable, users can select multiple values simultaneously. The OpenTSDB data source handles multi-value variables using pipe (`|`) separation, which is compatible with OpenTSDB's literal_or filter type.

### Configure multi-value variables

1. When creating the variable, enable **Multi-value**.
1. Optionally enable **Include All option** to add an "All" selection.
1. Use the variable in a filter with the `literal_or` filter type.

### Multi-value example

With a `host` variable configured as multi-value:

| Field        | Value        |
| ------------ | ------------ |
| Filter Key   | `host`       |
| Filter Type  | `literal_or` |
| Filter Value | `$host`      |

If the user selects `webserver01`, `webserver02`, and `webserver03`, the filter value becomes `webserver01|webserver02|webserver03`.

### All value behavior

When the user selects "All", Grafana sends all available values pipe-separated. For large value sets, consider using a wildcard filter instead:

| Field        | Value      |
| ------------ | ---------- |
| Filter Key   | `host`     |
| Filter Type  | `wildcard` |
| Filter Value | `*`        |

## Interval and auto-interval variables

Grafana provides built-in interval variables that are useful with OpenTSDB downsampling:

| Variable         | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `$__interval`    | Automatically calculated interval based on time range and panel width. |
| `$__interval_ms` | Same as `$__interval` but in milliseconds.                             |

Use these in the downsample interval field for automatic interval adjustment:

| Field               | Value         |
| ------------------- | ------------- |
| Downsample Interval | `$__interval` |

## Next steps

- [Build queries](ref:query-editor) using your template variables.
- [Set up alerting](ref:alerting) with templated queries.
- [Troubleshoot issues](ref:troubleshooting-opentsdb) if variables aren't populating.
