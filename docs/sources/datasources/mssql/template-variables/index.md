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
review_date: 2026-05-19
title: Microsoft SQL Server template variables
weight: 350
---

# Microsoft SQL Server template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana displays these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as **template variables**.

For general information on using variables in Grafana, refer to [Add variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

For an introduction to templating and template variables, refer to [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

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

## Format variables for SQL queries

When using template variables inside SQL queries, the formatting option you choose determines how Grafana renders the variable value. Choosing the correct format prevents SQL injection risks and avoids broken queries from incorrect quoting.

### Use `sqlstring` for safe single-value interpolation

The `${var:sqlstring}` format wraps the variable value in single quotes and escapes any internal single quotes. This is the recommended approach for single-value variables used in `WHERE` clauses:

```sql
SELECT * FROM events
WHERE hostname = ${hostname:sqlstring}
```

If `hostname` is set to `server01`, this expands to:

```sql
SELECT * FROM events
WHERE hostname = 'server01'
```

{{< admonition type="caution" >}}
Don't manually wrap variables in quotes (for example, `'${var}'`). Since Grafana v11.3, multi-value variables are automatically quoted when used with the `IN` operator. Manually adding quotes results in double-quoting (for example, `''value''`), which breaks queries.
{{< /admonition >}}

### Multi-value variable formatting

When a variable allows multiple selections, Grafana provides several formatting options:

| Format | Syntax | Output for selections `a`, `b` | Use case |
| --- | --- | --- | --- |
| Default (auto-quoted) | `$var` or `${var}` | `'a','b'` | `IN` clauses (recommended) |
| `sqlstring` | `${var:sqlstring}` | `'a'` (single value only) | Equality comparisons |
| `csv` | `${var:csv}` | `a,b` | Unquoted lists |
| `singlequote` | `${var:singlequote}` | `'a','b'` | Explicit single-quote wrapping |
| `doublequote` | `${var:doublequote}` | `"a","b"` | MSSQL identifier quoting |
| `pipe` | `${var:pipe}` | `a\|b` | Regex patterns |
| `raw` | `${var:raw}` | `a,b` | No escaping (use with caution) |

For multi-value variables in SQL `WHERE` clauses, the default formatting with `IN` is typically correct:

```sql
SELECT * FROM events
WHERE hostname IN ($hostname)
```

If `hostname` has values `server01` and `server02` selected, this expands to:

```sql
SELECT * FROM events
WHERE hostname IN ('server01','server02')
```

### Disable quoting for multi-value variables

To output multi-value variables without automatic quoting, use the `csv` format:

```text
${servers:csv}
```

This outputs the values as an unquoted comma-separated list. Use this only when you handle quoting yourself or when the values are numeric.

Refer to [Advanced variable format options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options) for the full list of formatting options.

## Handle the "All" option in SQL queries

When a variable includes the **All** option (enabled in variable settings), you need to handle the case where the user selects "All" differently from individual selections.

### Pattern: Use a custom "All" value with `LIKE`

Set the **Custom all value** field in the variable settings to `%`, then use `LIKE` in your query:

```sql
SELECT * FROM events
WHERE hostname LIKE ${hostname:sqlstring}
```

When the user selects "All", `hostname` resolves to `%`, and the `LIKE '%'` matches all rows. When a specific value is selected, `LIKE 'server01'` matches only that value.

### Pattern: Conditional `WHERE` clause with "All"

For `IN` clauses where `%` doesn't work, use a conditional approach. Set the **Custom all value** to `ALL`, then write:

```sql
SELECT * FROM events
WHERE (
  ${hostname:raw} = 'ALL'
  OR hostname IN ($hostname)
)
```

When the user selects "All", the first condition is true and all rows match. When specific values are selected, the `IN` clause filters normally.

### Pattern: Chained variables with "All"

When you have chained (dependent) variables and the parent uses "All", apply the same pattern. For example, if `region` feeds into `hostname`:

Variable query for `hostname`:

```sql
SELECT hostname FROM host
WHERE (${region:raw} = 'ALL' OR region IN ($region))
```

Panel query:

```sql
SELECT $__timeGroupAlias(time, '5m'), COUNT(*) as count
FROM events
WHERE $__timeFilter(time)
  AND (${region:raw} = 'ALL' OR region IN ($region))
  AND (${hostname:raw} = 'ALL' OR hostname IN ($hostname))
GROUP BY $__timeGroup(time, '5m')
ORDER BY 1
```

## Conditional SQL clauses

Grafana doesn't have built-in support for conditionally omitting entire `WHERE` clauses based on variable selection. Use one of these patterns to achieve conditional filtering.

### Pattern: Always-true condition

Use a condition that evaluates to true when the variable should be ignored:

```sql
SELECT * FROM events
WHERE $__timeFilter(time)
  AND (${env:raw} = 'ALL' OR environment IN ($env))
  AND (${sev:raw} = 'ALL' OR severity IN ($sev))
```

### Pattern: CASE expression for optional filters

For more complex scenarios, use a `CASE` expression:

```sql
SELECT * FROM events
WHERE $__timeFilter(time)
  AND 1 = CASE
    WHEN ${hostname:raw} = 'ALL' THEN 1
    WHEN hostname IN ($hostname) THEN 1
    ELSE 0
  END
```

## Known behaviors and limitations

Be aware of the following behaviors when using template variables with Microsoft SQL Server.

### Automatic quoting in multi-value variables

Since Grafana v11.3, multi-value variables used with the `IN` operator are automatically quoted. If you previously wrote `WHERE col IN ('${var}')` with manual quotes, remove the manual quotes and use `WHERE col IN ($var)` instead.

### Comments inside string literals

The Grafana SQL query parser strips SQL comments (`--` and `/* */`) before macro interpolation. In some cases, `--` inside a quoted string literal could be incorrectly interpreted as a comment. If your query contains strings with `--`, verify the query expands correctly by clicking **Generated SQL** after running the query.

### Variables in alerting queries

Template variables are not supported in alerting queries. Grafana evaluates alert rules on the backend without dashboard context. If your dashboard query uses variables, create a separate alerting query with hard-coded values. For more information, refer to [Microsoft SQL Server alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/alerting/#template-variables-not-supported).
