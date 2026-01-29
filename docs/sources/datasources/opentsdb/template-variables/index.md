---
aliases:
  - ../../data-sources/opentsdb/template-variables/
description: Use template variables with the OpenTSDB data source in Grafana
keywords:
  - grafana
  - opentsdb
  - template
  - variables
  - dashboard
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
---

# OpenTSDB template variables

Instead of hard-coding server, application, and sensor names in your metric queries, you can use template variables. Variables appear as drop-down menus at the top of the dashboard, making it easy to change the data being displayed.

For an introduction to template variables, refer to the [Variables](ref:variables) documentation.

## Query variable

The OpenTSDB data source supports query-type template variables that fetch values directly from OpenTSDB. Use the following syntax:

| Query | Description |
| ----- | ----------- |
| `metrics(prefix)` | Returns metric names with the specified prefix. Use an empty string for all metrics. |
| `tag_names(metric)` | Returns tag names (keys) for a specific metric. |
| `tag_values(metric, tagkey)` | Returns tag values for a specific metric and tag key. |
| `suggest_tagk(prefix)` | Returns tag names (keys) for all metrics with the specified prefix. |
| `suggest_tagv(prefix)` | Returns tag values for all metrics with the specified prefix. |

### Create a query variable

To create a query variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Query** as the variable type.
1. Select the **OpenTSDB** data source.
1. Enter your query using the syntax from the table.
1. Click **Apply**.

### Query variable examples

**List all metrics:**

```
metrics()
```

**List metrics with a prefix:**

```
metrics(sys.cpu)
```

**List tag keys for a metric:**

```
tag_names(sys.cpu.user)
```

**List tag values for a metric and tag key:**

```
tag_values(sys.cpu.user, host)
```

If template variables aren't populating in the **Preview of values** section, refer to [Troubleshooting](ref:troubleshooting-opentsdb).

## Nested template variables

You can use one template variable to filter tag values for another. This is useful for creating cascading filters, such as selecting a region first, then filtering hosts by that region.

The syntax is:

```
tag_values(metric, tagkey, filter1=$var1, filter2=$var2, ...)
```

### Nested variable examples

| Query | Description |
| ----- | ----------- |
| `tag_values(cpu, hostname, env=$env)` | Returns hostname values for the cpu metric, filtered by the selected env tag value. |
| `tag_values(cpu, hostname, env=$env, region=$region)` | Returns hostname values for the cpu metric, filtered by both env and region tag values. |

### Create nested variables

To create a set of nested variables:

1. Create a parent variable (for example, `env`) using `tag_values(cpu, env)`.
1. Create a child variable (for example, `host`) using `tag_values(cpu, hostname, env=$env)`.
1. The child variable automatically updates when the parent selection changes.

## Use variables in queries

Reference variables in your queries using the `$variablename` syntax:

| Field | Example |
| ----- | ------- |
| Metric | `sys.cpu.user` |
| Tags | `host=$host` |

When the dashboard loads, Grafana replaces `$host` with the selected value from the variable drop-down.
