---
description: Using template variables with MySQL in Grafana
keywords:
  - grafana
  - mysql
  - templates
  - variables
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: MySQL template variables
weight: 300
review_date: 2026-05-11
---

# MySQL template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana displays these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as **template variables**.

For an introduction to templating and template variables, refer to [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

## Query variable

A query variable in Grafana dynamically retrieves values from your data source using a query. With a query variable, you can write a SQL query that returns values such as measurement names, key names, or key values that are shown in a drop-down select box.

The variable query editor supports the same **Builder** and **Code** modes as the main query editor. Use Builder mode to construct queries visually by selecting a dataset, table, columns, and filters. Use Code mode to write SQL directly.

For example, the following query returns all values from the `hostname` column:

```sql
SELECT hostname FROM my_host
```

A query can return multiple columns, and Grafana automatically generates a list using the values from those columns. For example, the following query returns values from both the `hostname` and `hostname2` columns, which are included in the variable's drop-down list.

```sql
SELECT my_host.hostname, my_other_host.hostname2 FROM my_host JOIN my_other_host ON my_host.city = my_other_host.city
```

To use time range dependent macros like `$__timeFilter(column)` in your query, you must set the template variable's refresh mode to **On Time Range Change**.

```sql
SELECT event_name FROM event_log WHERE $__timeFilter(time_column)
```

### Key/value variables

You can create a key/value variable so the drop-down shows a user-friendly label (for example, hostname) while panel queries use a different value (for example, ID). Use the variable editor's **Value field** and **Text field** at the bottom of the query section to specify which query columns supply the value and the label. Your query can use any column names; you don't need `__value` or `__text` in the SQL.

Example: run a query that returns `hostname` and `id`, then set **Text field** to `hostname` and **Value field** to `id`.

```sql
SELECT hostname, id FROM my_host
```

Note that the values in the text column should be unique. If there are duplicates, Grafana uses only the first matching entry.

Alternatively, you can use the legacy approach: return columns named `__text` and `__value` in your query (for example, `SELECT hostname AS __text, id AS __value FROM my_host`).

### Nested variables

You can create nested variables, where one variable depends on the value of another. For example, if you have a variable named `region`, you can configure a `hosts` variable to only show hosts from the selected region. If `region` is a multi-value variable, use the `IN` operator instead of `=` to match against multiple selected values.

```sql
SELECT hostname FROM my_host WHERE region IN($region)
```

### Filter results with `__searchFilter`

Using `__searchFilter` in the query field allows the query results to be filtered based on the user's input in the drop-down selection box. If you don't enter anything, the default value for `__searchFilter` is `%`.

Note that you must enclose the `__searchFilter` expression in quotes as Grafana doesn't add them automatically.

The following example demonstrates how to use `__searchFilter` in the query field to enable real-time searching for `hostname` as the user types in the drop-down selection box.

```sql
SELECT hostname FROM my_host WHERE hostname LIKE '$__searchFilter'
```

## Use variables in queries

Grafana automatically quotes template variable values only when the template variable is a `multi-value`.

When using a multi-value variable, use the `IN` comparison operator instead of `=` to match against multiple values.

Grafana supports two syntaxes for using variables in queries:

- **`$<varname>` syntax**

Example with a template variable named `hostname`:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time,
  aint as value,
  avarchar as metric
FROM my_table
WHERE $__timeFilter(atimestamp) and hostname in($hostname)
ORDER BY atimestamp ASC
```

- **`[[varname]]` syntax**

Example with a template variable named `hostname`:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time,
  aint as value,
  avarchar as metric
FROM my_table
WHERE $__timeFilter(atimestamp) and hostname in([[hostname]])
ORDER BY atimestamp ASC
```

### Disable quoting for multi-value variables

By default, Grafana formats multi-value variables as a quoted, comma-separated string. For example, if `server01` and `server02` are selected, the result will be `'server01'`, `'server02'`. To disable quoting, use the `csv` formatting option for variables:

```text
${servers:csv}
```

This outputs the values as an unquoted comma-separated list.

### Use explicit quoting for string variables

Don't rely on implicit quoting behavior for string variables in SQL queries. Quoting behavior can vary depending on panel type and context:

- **Repeat panels** may not quote single-value variables at all, causing bare values to appear in the SQL and breaking the query.
- If you manually wrap a variable in quotes (for example, `WHERE name = '$myvar'`) and Grafana also applies its own quoting, the value gets double-quoted (for example, `''30''` instead of `'30'`). This intentional quoting behavior was restored in Grafana 11.3.

To avoid both problems, use the `sqlstring` format option. It handles escaping and quoting in a single step, so you don't add your own quotes around the variable:

```sql
SELECT *
FROM my_table
WHERE hostname = ${hostname:sqlstring}
```

This produces a safely quoted string (for example, `'server01'`) regardless of panel type or context. For multi-value variables, use `IN` with `${var:sqlstring}`:

```sql
SELECT *
FROM my_table
WHERE hostname IN (${hostname:sqlstring})
```

{{< admonition type="caution" >}}
Don't wrap `${var:sqlstring}` in additional quotes. The `sqlstring` formatter already produces a quoted value. Writing `'${var:sqlstring}'` results in double quoting.
{{< /admonition >}}

Refer to [Advanced variable format options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options) for additional information.
