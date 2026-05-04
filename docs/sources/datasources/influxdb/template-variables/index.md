---
aliases:
  - ../../data-sources/influxdb/influxdb-templates/
  - ../../data-sources/influxdb/template-variables/
  - influxdb-templates/
description: Guide for using template variables with the InfluxDB data source in Grafana
keywords:
  - grafana
  - influxdb
  - template
  - variable
  - query variable
  - ad-hoc filter
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: InfluxDB template variables
weight: 450
review_date: 2026-05-01
---

# InfluxDB template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables. Grafana displays these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard. Grafana refers to such variables as template variables.

For general information about variables, refer to [Variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

## Before you begin

- [Configure the InfluxDB data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/configure/).
- Understand [Grafana template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/).

## Supported variable types

| Variable type | Supported |
| ------------- | --------- |
| Query         | Yes       |
| Custom        | Yes       |
| Data source   | Yes       |
| Ad-hoc filter | Yes (InfluxQL only) |

## Create a query variable

By adding a query template variable, you can write an InfluxDB metadata exploration query. These queries return results such as measurement names, key names, and key values.

For more information, refer to [Add a query variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-a-query-variable).

### InfluxQL query variable examples

To create a variable containing all values for the `hostname` tag, use the following query in the **Query** field:

```sql
SHOW TAG VALUES WITH KEY = "hostname"
```

You can fetch key names for a given measurement:

```sql
SHOW TAG KEYS [FROM <measurement_name>]
```

You can list available measurements:

```sql
SHOW MEASUREMENTS
```

### Flux query variable examples

For Flux-configured data sources, write a Flux query that returns a single column of values:

```flux
import "influxdata/influxdb/schema"
schema.tagValues(bucket: v.defaultBucket, tag: "hostname")
```

### SQL query variable examples

For SQL-configured data sources (InfluxDB 3.x), write an SQL query that returns a single column of values:

```sql
SELECT DISTINCT hostname FROM cpu
```

You can list available tables:

```sql
SHOW TABLES
```

You can list columns in a specific table:

```sql
SHOW COLUMNS FROM cpu
```

## Chain or nest variables

You can create nested variables, sometimes called [chained variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#chained-variables).

For example, if you have a variable named `region`, you can configure the `hosts` variable to display only hosts from the selected region.

**InfluxQL:**

```sql
SHOW TAG VALUES WITH KEY = "hostname"  WHERE region = '$region'
```

**SQL:**

```sql
SELECT DISTINCT hostname FROM cpu WHERE region = '$region'
```

If you have a variable containing key names, you can use it in a **GROUP BY** clause. This allows you to adjust the grouping by selecting from the variable list at the top of the dashboard.

## Use **Ad hoc filters**

InfluxDB supports the **Ad hoc filters** variable type for InfluxQL. This variable type allows you to define multiple key/value filters, which Grafana automatically applies to all your InfluxDB queries. **Ad hoc filters** also support expressions.

To add **Ad hoc filters**:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Ad hoc filters** as the variable type.
1. Select your InfluxDB data source.

<!-- vale Grafana.Spelling = NO -->
For more information, refer to [Add ad hoc filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters).
<!-- vale Grafana.Spelling = YES -->

## Choose a variable syntax

The InfluxDB data source supports two variable syntaxes for use in the **Query** field:

- **`$<varname>`** - Use this syntax for standalone variable references. It doesn't allow you to use a variable in the middle of a word or expression.
- **`${varname}`** - Use this syntax when you want to interpolate a variable in the middle of an expression.

**InfluxQL examples:**

```sql
SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^$host$/ AND $timeFilter GROUP BY time($__interval), "hostname"
```

```sql
SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^${host}$/ AND $timeFilter GROUP BY time($__interval), "hostname"
```

When you enable the **Multi-value** or **Include all value** options with InfluxQL, Grafana converts the labels from plain text to a regular expression-compatible string, so you must use `=~` instead of `=`.

**SQL examples:**

```sql
SELECT $__dateBin(time), mean(usage_system) FROM cpu WHERE $__timeFilter(time) AND host = '$host' GROUP BY $__dateBin(time)
```

```sql
SELECT $__dateBin(time), mean(usage_system) FROM cpu WHERE $__timeFilter(time) AND host IN ($host) GROUP BY $__dateBin(time)
```

When you enable the **Multi-value** option with SQL, use the `IN` operator instead of `=` to match multiple values.

### Templated dashboard example

To view an example of a templated dashboard, refer to this [InfluxDB example dashboard](https://play.grafana.org/d/f62a0410-5abb-4dd8-9dfc-caddfc3e2ffd/eccb2445-b0a2-5e83-8e0f-6d5ea53ad575).
