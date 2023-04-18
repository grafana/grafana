---
description: Guide for templates in InfluxDB
title: InfluxDB templates
weight: 300
---

## InfluxDB templates

Instead of hard-coding things like server, application and sensor name in your metric queries you can use variables in their place.

For more information, refer to [Templates and variables]({{< relref "../../variables/_index.md" >}}).

## Using variables in InfluxDB queries

There are two syntaxes:

`$<varname>` Example:

```sql
SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^$host$/ AND $timeFilter GROUP BY time($__interval), "hostname"
```

`[[varname]]` Example:

```sql
SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^[[host]]$/ AND $timeFilter GROUP BY time($__interval), "hostname"
```

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the **Multi-value** or **Include all value** options are enabled, Grafana converts the labels from plain text to a regex compatible string. Which means you have to use `=~` instead of `=`.

Example dashboard:
[InfluxDB Templated Dashboard](https://play.grafana.org/dashboard/db/influxdb-templated)

## Query variables

If you add a query template variable, then you can write an InfluxDB exploration (metadata) query. These queries can return things like measurement names, key names or key values. For more information, refer to [Add query variable]({{< relref "../../variables/variable-types/add-query-variable.md" >}}).

For example, you can have a variable that contains all values for tag `hostname` if you specify a query like this in the query variable **Query**.

```sql
SHOW TAG VALUES WITH KEY = "hostname"
```

## Chained or nested variables

You can also create nested variables, sometimes called [chained variables]({{< relref "../../variables/variable-types/chained-variables.md" >}}).

For example, if you had another variable, for example `region`. Then you could have the hosts variable only show hosts from the current selected region with a query like this:

```sql
SHOW TAG VALUES WITH KEY = "hostname"  WHERE region = '$region'
```

You can fetch key names for a given measurement.

```sql
SHOW TAG KEYS [FROM <measurement_name>]
```

If you have a variable with key names you can use this variable in a group by clause. This will allow you to change group by using the variable list at the top of the dashboard.

### Ad hoc filters variable

InfluxDB supports the special `Ad hoc filters` variable type. This variable allows you to specify any number of key/value filters on the fly. These filters are automatically applied to all your InfluxDB queries.

For more information, refer to [Add ad hoc filters]({{< relref "../../variables/variable-types/add-ad-hoc-filters.md" >}}).
