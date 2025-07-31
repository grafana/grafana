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
Grafana displays these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as **template variables**.

For general information on using variables in Grafana, refer to [Add variables](ref:add-template-variables).

For an introduction to templating and template variables, refer to [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables).

## Query variable

A query variable in Grafana dynamically retrieves values from your data source using a query. With a query variable, you can write a SQL query that returns values such as measurement names, key names, or key values that are shown in a drop-down select box.

For example, the following query returns all values from the `hostname` column:

```sql
SELECT hostname FROM host
```

A query can return multiple columns, and Grafana automatically generates a list using the values from those columns. For example, the following query returns values from both the `hostname` and `hostname2` columns, which are included in the variable's drop-down list.

```sql
SELECT [host].[hostname], [other_host].[hostname2] FROM host JOIN other_host ON [host].[city] = [other_host].[city]
```

You can also create a key/value variable using a query that returns two columns named `__text` and `__value`.

- The `__text` column defines the label shown in the drop-down.

- The `__value` column defines the value passed to panel queries.

This is useful when you want to display a user-friendly label (like a hostname) but use a different underlying value (like an ID).

Note that the values in the `_text` column should be unique. If there are duplicates, Grafana uses only the first matching entry.

```sql
SELECT hostname __text, id __value FROM host
```

You can also create nested variables, where one variable depends on the value of another. For example, if you have a variable named `region`, you can configure a `hosts` variable to only show hosts from the selected region. If `region` is a multi-value variable, use the `IN` operator instead of `=` to match against multiple selected values.

```sql
SELECT hostname FROM host WHERE region IN ($region)
```

## Use variables in queries

Grafana automatically quotes template variable values only when the template variable is a `multi-value`.

When using a multi-value variable, use the `IN` comparison operator instead of `=` to match against multiple values.

Grafana supports two syntaxes for using variables in queries:

- **`$<varname>` syntax**

Example with a template variable named `hostname`:

```sql
SELECT
  atimestamp time,
  aint value
FROM table
WHERE $__timeFilter(atimestamp) and hostname in($hostname)
ORDER BY atimestamp
```

- **`[[varname]]` syntax**

Example with a template variable named `hostname`:

```sql
SELECT
  atimestamp as time,
  aint as value
FROM table
WHERE $__timeFilter(atimestamp) and hostname in([[hostname]])
ORDER BY atimestamp
```

### Disable quoting for multi-value variables

By default, Grafana formats multi-value variables as a quoted, comma-separated string. For example, if `server01` and `server02` are selected, the result will be `'server01'`, `'server02'`. To disable quoting, use the `csv` formatting option for variables:

```text
${servers:csv}
```

This outputs the values as an unquoted comma-separated list.

Refer to [Advanced variable format options](ref:variable-syntax-advanced-variable-format-options) for additional information.
