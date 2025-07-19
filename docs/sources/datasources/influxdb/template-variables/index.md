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
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: InfluxDB template variables
weight: 600
refs:
  add-template-variables-chained-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#chained-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#chained-variables
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
  add-template-variables-add-ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  add-template-variables-add-a-query-variable:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-a-query-variable
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-a-query-variable
  variable-best-practices:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#variable-best-practices
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#variable-best-practices
---

# InfluxDB template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables. Grafana displays these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard. Grafana refers to such variables as template variables.

For additional information using variables and templates, refer to the following documentation:

- [Variables](ref:variables)
- [Templates](ref:variables)
- [Add and manage variables](ref:add-template-variables)
- [Variable best practices](ref:variable-best-practices)

## Use query variables

By adding a query template variable, you can write an InfluxDB metadata exploration query. These queries return results such as measurement names, key names, and key values.

For more information, refer to [Add a query variable](ref:add-template-variables-add-a-query-variable).

To create a variable containing all values for the `hostname` tag, use the following query format in the **Query** variable:

```sql
SHOW TAG VALUES WITH KEY = "hostname"
```

## Chain or nest variables

You can also create nested variables, sometimes called [chained variables](ref:add-template-variables-chained-variables).

For example, if you have a variable named `region`, you can configure the `hosts` variable to display only hosts from the selected region using the following query:

```sql
SHOW TAG VALUES WITH KEY = "hostname"  WHERE region = '$region'
```

You can also fetch key names for a given measurement:

```sql
SHOW TAG KEYS [FROM <measurement_name>]
```

If you have a variable containing key names, you can use it in a **GROUP BY** clause. This allows you to adjust the grouping by selecting from the variable list at the top of the dashboard

## Use ad hoc filters

InfluxDB supports the **Ad hoc filters** variable type. This variable type allows you to define multiple key/value filters, which Grafana then automatically applies to all your InfluxDB queries.

For more information, refer to [Add ad hoc filters](ref:add-template-variables-add-ad-hoc-filters).

## Choose a variable syntax

The InfluxDB data source supports two variable syntaxes for use in the **Query** field:

- `$<varname>` - This syntax is easy to read and write but does not allow you to use a variable in the middle of a word or expression.

  ```sql
  SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^$host$/ AND $timeFilter GROUP BY time($__interval), "hostname"
  ```

- `${varname}` - Use this syntax when you want to interpolate a variable in the middle of an expression.

  ```sql
  SELECT mean("value") FROM "logins" WHERE "hostname" =~ /^[[host]]$/ AND $timeFilter GROUP BY time($__interval), "hostname"
  ```

When you enable the **Multi-value** or **Include all value** options, Grafana converts the labels from plain text to a regex-compatible string, so you must use `=~` instead of `=`.

### Templated dashboard example

To view an example of a templated dashboard, refer to this [InfluxDB example dashboard](https://play.grafana.org/d/f62a0410-5abb-4dd8-9dfc-caddfc3e2ffd/eccb2445-b0a2-5e83-8e0f-6d5ea53ad575).
