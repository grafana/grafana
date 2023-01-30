---
aliases:
  - ../../data-sources/influxdb/influxdb-templates/
  - ../../data-sources/influxdb/template-variables/
  - influxdb-templates/
description: Guide for template variables in InfluxDB
keywords:
  - grafana
  - influxdb
  - queries
  - template
  - variable
menuTitle: Template variables
title: InfluxDB template variables
weight: 300
---

# InfluxDB template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Use query variables

If you add a query template variable, you can write an InfluxDB exploration (metadata) query.
These queries can return results like measurement names, key names, or key values.

For more information, refer to [Add query variable]({{< relref "../../../dashboards/variables/add-template-variables#add-a-query-variable" >}}).

For example, to create a variable that contains all values for tag `hostname`, specify a query like this in the query variable **Query**:

```sql
SHOW TAG VALUES WITH KEY = "hostname"
```

### Chain or nest variables

You can also create nested variables, sometimes called [chained variables]({{< relref "../../../dashboards/variables/add-template-variables#chained-variables" >}}).

For example, if you had a variable called `region`, you could have the `hosts` variable show only hosts from the selected region with a query like:

```sql
SHOW TAG VALUES WITH KEY = "hostname"  WHERE region = '$region'
```

You can fetch key names for a given measurement:

```sql
SHOW TAG KEYS [FROM <measurement_name>]
```

If you have a variable with key names, you can use this variable in a group-by clause.
This helps you change group-by using the variable list at the top of the dashboard.

### Use ad hoc filters

InfluxDB supports the special **Ad hoc filters** variable type.
You can use this variable type to specify any number of key/value filters, and Grafana applies them automatically to all of your InfluxDB queries.

For more information, refer to [Add ad hoc filters]({{< relref "../../../dashboards/variables/add-template-variables#add-ad-hoc-filters" >}}).

## Choose a variable syntax

The InfluxDB data source supports two variable syntaxes for use in the **Query** field:

- `$<varname>`, which is easier to read and write but does not allow you to use a variable in the middle of a word.

  ```sql
  SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^$host$/ AND $timeFilter GROUP BY time($__interval), "hostname"
  ```

- `${varname}`

  ```sql
  SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^[[host]]$/ AND $timeFilter GROUP BY time($__interval), "hostname"
  ```

When you enable the **Multi-value** or **Include all value** options, Grafana converts the labels from plain text to a regex-compatible string, so you must use `=~` instead of `=`.

### Templated dashboard example

To view an example templated dashboard, refer to [InfluxDB Templated Dashboard](https://play.grafana.org/dashboard/db/influxdb-templated).
