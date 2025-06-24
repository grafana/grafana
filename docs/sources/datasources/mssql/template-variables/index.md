---
aliases:
  - ../../data-sources/mssql/template-variables/
description: Using template variables with Microsoft SQL Server in Grafana
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - Azure SQL Database
  - templates
  - variables
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Microsoft SQL Server template variables
weight: 400
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  variable-syntax-advanced-variable-format-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
---

# Microsoft SQL Server template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For general information on using variable in Grafana, refer to [Add variables](ref:add-template-variables)

For an introduction to templating and template variables, refer to the [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables) documentation.

## Query variable

A query variable in Grafana is a type of template variable that dynamically pulls values from your data source using a query. Using a query variable, you can write a SQL query that returns things like measurement names, key names or key values that are shown as a drop-down select box.

For example, you can have a variable that contains all values for the hostname column in a table if you specify a query like this in the templating variable **Query** setting.

```sql
SELECT hostname FROM host
```

A query can return multiple columns, and Grafana will automatically generate a list using the values from those columns. For example, the following query returns values from both the `hostname` and `hostname2` columns, which are then included in the variable's drop-down list.

```sql
SELECT [host].[hostname], [other_host].[hostname2] FROM host JOIN other_host ON [host].[city] = [other_host].[city]
```

You can also create a key/value variable using a query that returns two columns named `__text` and `__value`. The `__text` column defines what is shown in the drop-down, while the `__value` column is what gets passed to the panel queries. This is useful when you want to display a user-friendly label (like a hostname) but use a different underlying value (like an ID).

Note that the values in the __text column should be unique. If there are duplicates, Grafana will only use the first matching entry.

```sql
SELECT hostname __text, id __value FROM host
```

You can also create nested variables, where one variable depends on the value of another. For example, if you have a variable named `region` you can configure a `hosts` variable to only show hosts from the selected region. If region is a multi-value variable, use the `IN` operator instead of `=` to match against multiple selected values.

```sql
SELECT hostname FROM host WHERE region IN ($region)
```

## Use variables in queries

Template variable values are only quoted when the template variable is a `multi-value`

When using a multi-value variable, use the `IN` comparison operator rather than `=` to match against multiple values.

There are two syntaxes:

`$<varname>` Example with a template variable named `hostname`:

```sql
SELECT
  atimestamp time,
  aint value
FROM table
WHERE $__timeFilter(atimestamp) and hostname in($hostname)
ORDER BY atimestamp
```

`[[varname]]` Example with a template variable named `hostname`:

```sql
SELECT
  atimestamp as time,
  aint as value
FROM table
WHERE $__timeFilter(atimestamp) and hostname in([[hostname]])
ORDER BY atimestamp
```

### Disable quoting for multi-value variables

By default, Grafana formats multi-value variables as a quoted, comma-separated string. For example: if `server01` and `server02` are selected, the result will be `'server01'`, `'server02'`. To disable quoting, use the `csv` formatting option for variables:

`${servers:csv}`

This will output the values as an unquoted comma-separated list.

Refer to [Advanced variable format options](ref:variable-syntax-advanced-variable-format-options) for additional information.
