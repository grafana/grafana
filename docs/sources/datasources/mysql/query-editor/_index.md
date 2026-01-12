---
description: This document describes the MySQL query editor.
keywords:
  - grafana
  - mysql
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: MySQL query editor
weight: 30
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  variable-syntax-advanced-variable-format-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/#advanced-variable-format-options
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
  panel-inspector:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-inspector/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-inspector/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#query-editors
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#query-editors
  alert-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/
  template-annotations-and-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  configure-standard-options:
    - pattern: /docs/grafana/
    - destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/
  mysql-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/template-variables/
  mysql-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/alerting/
  mysql-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/annotations/
---

# MySQL query editor

Grafana’s query editors are unique for each data source. For general information on Grafana query editors, refer to [Query editors](ref:query-editor). For general information on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

The MySQL query editor is located on the [Explore page](ref:explore). You can also access the MySQL query editor from a dashboard panel. Click the ellipsis in the upper right of the panel and select **Edit**.

{{< admonition type="note" >}}
If a default database is configured in the **Data Source Configuration page**, or via a provisioning configuration file, users will be restricted to querying only that pre-configured database.
{{< /admonition >}}

## MySQL query editor components

The MySQL query editor has two modes: **Builder** and **Code**.

Builder mode helps you build a query using a visual interface. Code mode allows for advanced querying and offers support for complex SQL query writing.

{{< admonition type="note" >}}
If your table or database name contains a reserved word or a [prohibited character](https://dev.mysql.com/doc/en/identifiers.html) the editor will put quotes around the name. For example, the name `table-name` will be quoted with backticks - `` `table-name` ``.
{{< /admonition >}}

## MySQL Builder mode

{{< figure alt="Builder mode" src="/media/docs/mysql/screenshot-mysql-query-editor.v11.3.png" class="docs-image--no-shadow" >}}

The following components will help you build a MySQL query:

- **Format** - Select a format response from the drop-down for the MySQL query. The default is **Table**. If you use the **Time series** format option, one of the columns must be `time`.

- **Dataset** - Select a database to query from the drop-down.
  - **Table** - Select a table from the drop-down. Tables correspond to the chosen database.

  - **Data operations** - _Optional_ Select an aggregation from the drop-down. You can add multiple data operations by clicking the **+ sign**. Click the **X** to remove a data operation. Click the **garbage can icon** to remove the entire column.

  - **Column** - Select a column on which to run the aggregation.

  - **Alias** - _Optional_ Add an alias from the drop-down. You can also add your own alias by typing it in the box and clicking **Enter**. Remove an alias by clicking the **X**.

- **Filter** - Toggle to add filters.
  - **Filter by column value** - _Optional_ If you toggle **Filter** you can add a column to filter by from the drop-down. To filter on more columns, click the **+ sign** to the right of the condition drop-down. You can choose a variety of operators from the drop-down next to the condition. When multiple filters are added you can add an `AND` operator to display all true conditions or an `OR` operator to display any true conditions. Use the second drop-down to choose a filter. To remove a filter, click the `X` button next to that filter's drop-down. After selecting a date type column, you can choose **Macros** from the operators list and select `timeFilter` which will add the `$\_\_timeFilter` macro to the query with the selected date column.

- **Group** - Toggle to add **Group by column**.
  - **Group by column** - Select a column to filter by from the drop-down. Click the **+ sign** to filter by multiple columns. Click the **X** to remove a filter.

- **Order** - Toggle to add an ORDER BY statement.
  - **Order by** - Select a column to order by from the drop-down. Select ascending (`ASC`) or descending (`DESC`) order.
  - **Limit** - You can add an optional limit on the number of retrieved results. Default is 50.

- **Preview** - Toggle for a preview of the SQL query generated by the query builder. Preview is toggled on by default.

## MySQL Code mode

To create advanced queries, switch to **Code mode** by clicking **Code** in the upper right of the editor window. Code mode supports the auto-completion of tables, columns, SQL keywords, standard SQL functions, Grafana template variables, and Grafana macros. Columns cannot be completed before a table has been specified.

{{< figure src="/static/img/docs/v92/sql_code_editor.png" class="docs-image--no-shadow" >}}

Select **Table** or **Time Series** as the format. Click the **{}** in the bottom right to format the query. Click the **downward caret** to expand the Code mode editor. **CTRL/CMD + Return** serves as a keyboard shortcut to execute the query.

{{< admonition type="warning" >}}
Changes made to a query in Code mode will not transfer to Builder mode and will be discarded. You will be prompted to copy your code to the clipboard to save any changes.
{{< /admonition >}}

## Macros

You can add macros to your queries to simplify the syntax and enable dynamic elements, such as date range filters.

| Macro example                                         | Description                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$__time(dateColumn)`                                 | Replaces the value with an expression to convert to a UNIX timestamp and renames the column to `time_sec`. It also helps to recognize the `time` column, as required in Time Series format. Example: _UNIX_TIMESTAMP(dateColumn) AS time_sec_. |
| `$__timeEpoch(dateColumn)`                            | Replaces the value with an expression to convert to a UNIX Epoch timestamp and renames the column to `time_sec`. Example: _UNIX_TIMESTAMP(dateColumn) AS time_sec_.                                                                            |
| `$__timeFilter(dateColumn)`                           | Applies a time range filter using the specified column name and fetches only the data that falls within that range. Example: _dateColumn BETWEEN FROM_UNIXTIME(1494410783) AND FROM_UNIXTIME(1494410983)_                                      |
| `$__timeFrom()`                                       | Replaces the value with the start of the currently active time selection. Example: _FROM_UNIXTIME(1494410783)_                                                                                                                                 |
| `$__timeTo()`                                         | Replaces the value with the end of the currently active time selection. Example: _FROM_UNIXTIME(1494410983)_                                                                                                                                   |
| `$__timeGroup(dateColumn,'5m')`                       | Replaces the value with an expression suitable for use in a GROUP BY clause and creates the bucket timestamps at a fixed interval. Example: *cast(cast(UNIX_TIMESTAMP(dateColumn)/(300) as signed)*300 as signed),\*                           |
| `$__timeGroup(dateColumn,'5m', 0)`                    | Same as the `$__timeGroup(dateColumn,'5m')` macro, but includes a fill parameter to ensure missing points in the series are added by Grafana, using 0 as the default value. **This applies only to time series queries.**                      |
| `$__timeGroup(dateColumn,'5m', NULL)`                 | Same as the `$__timeGroup(dateColumn,'5m', 0)` but NULL is used as the value for missing points. **This applies only to time series queries.**                                                                                                 |
| `$__timeGroup(dateColumn,'5m', previous)`             | Same as the `$__timeGroup(dateColumn,'5m', previous)` macro, but uses the previous value in the series as the fill value. If no previous value exists,`NULL` will be used. **This applies only to time series queries.**                       |
| `$__timeGroupAlias(dateColumn,'5m')`                  | Replaces the value identical to $\_\_timeGroup but with an added column alias.                                                                                                                                                                 |
| `$__unixEpochFilter(dateColumn)`                      | Replaces the value by a time range filter using the specified column name with times represented as a UNIX timestamp. Example: _dateColumn > 1494410783 AND dateColumn < 1494497183_                                                           |
| `$__unixEpochFrom()`                                  | Replaces the value with the start of the currently active time selection as a UNIX timestamp. Example: _1494410783_                                                                                                                            |
| `$__unixEpochTo()`                                    | Replaces the value with the end of the currently active time selection as UNIX timestamp. Example: _1494497183_                                                                                                                                |
| `$__unixEpochNanoFilter(dateColumn)`                  | Replaces the value with a time range filter using the specified column name with time represented as a nanosecond timestamp. Example: _dateColumn > 1494410783152415214 AND dateColumn < 1494497183142514872_                                  |
| `$__unixEpochNanoFrom()`                              | Replaces the value with the start of the currently active time selection as nanosecond timestamp. Example: _1494410783152415214_                                                                                                               |
| `$__unixEpochNanoTo()`                                | Replaces the value with the end of the currently active time selection as nanosecond timestamp. Example: _1494497183142514872_                                                                                                                 |
| `$__unixEpochGroup(dateColumn,'5m', [fillmode])`      | Same as $\_\_timeGroup but for times stored as Unix timestamp. **Note that `fillMode` only works with time series queries.**                                                                                                                   |
| `$__unixEpochGroupAlias(dateColumn,'5m', [fillmode])` | Same as $\_\_timeGroup but also adds a column alias. **Note that `fillMode` only works with time series queries.**                                                                                                                             |

## Table SQL queries

If the **Format** option is set to **Table**, you can execute virtually any type of SQL query. The Table panel will automatically display the resulting columns and rows from your query.

You can change or customize the name of a Table panel column by using the SQL keyword `AS` syntax.

```sql
SELECT
  title as 'Title',
  user.login as 'Created By' ,
  dashboard.created as 'Created On'
 FROM dashboard
INNER JOIN user on user.id = dashboard.created_by
WHERE $__timeFilter(dashboard.created)
```

Table panel results:

![](/static/img/docs/v43/mysql_table.png)

## Time series queries

Set the **Format** option to **Time series** to create and run time series queries.

{{< admonition type="note" >}}
To run a time series query you must include a column named `time` that returns either a SQL datetime value or a numeric datatype representing the UNIX epoch time in seconds. Additionally, the query results must be sorted by the `time` column for proper visualization in panels.
{{< /admonition >}}

The examples in this section refer to the data in the following table:

```text
+---------------------+--------------+---------------------+----------+
| time_date_time      | value_double | CreatedAt           | hostname |
+---------------------+--------------+---------------------+----------+
| 2025-01-02 03:05:00 | 3.0          | 2025-01-02 03:05:00 | 10.0.1.1 |
| 2025-01-02 03:06:00 | 4.0          | 2025-01-02 03:06:00 | 10.0.1.2 |
| 2025-01-02 03:10:00 | 6.0          | 2025-01-02 03:10:00 | 10.0.1.1 |
| 2025-01-02 03:11:00 | 7.0          | 2025-01-02 03:11:00 | 10.0.1.2 |
| 2025-01-02 03:20:00 | 5.0          | 2025-01-02 03:20:00 | 10.0.1.2 |
+---------------------+--------------+---------------------+----------+
```

{{< admonition type="note" >}}
For backward compatibility, an exception to the aforementioned rule applies to queries returning three columns, including a string column named `metric`. Instead of converting the metric column into field labels, it is used as the field name, and the series name is set to the value of the metric column. Refer to the following example with a metric column.
{{< /admonition >}}

**Example with `$__time(dateColumn)` Macro:**

```sql
SELECT
  $__time(time_date_time),
  value_double
FROM my_data
ORDER BY time_date_time
```

Table panel result:

{{< figure alt="output of time macro" src="/media/docs/grafana/data-sources/mysql/screenshot-time-and-timefilter-macro.png" >}}

In the following example, the result includes two columns, `Time` and `value_double`, which represent the data associated with fixed timestamps. This query does not apply a time range filter and returns all rows from the table.

**Example with `$__timeFilter(dateColumn)` Macro:**

```sql
SELECT
  $__time(time_date_time),
  value_double
FROM my_data
WHERE $__timeFilter(time_date_time)
ORDER BY time_date_time
```

Table panel result:

{{< figure alt="output of time filter macro" src="/media/docs/grafana/data-sources/mysql/screenshot-time-and-timefilter-macro.png" >}}

This example returns the same result as the previous one, but adds support for filtering data using the Grafana time picker.

**Example with `$__timeGroup(dateColumn,'5m')` Macro:**

```sql
SELECT
  $__timeGroup(time_date_time, '5m') AS time,
  sum(value_double) AS sum_value
FROM my_data
WHERE $__timeFilter(time_date_time)
GROUP BY time
ORDER BY time
```

Table panel result:

{{< figure alt="output of time group macro" src="/media/docs/grafana/data-sources/mysql/screenshot-timegroup-macro.png" >}}

Given the result in the following example, the data is grouped and aggregated within buckets with timestamps of fixed interval i.e. 5 mins. To customize the default series name formatting (optional), refer to [Standard options definitions](ref:configure-standard-options).

**Example with `$__timeGroupAlias(dateColumn,'5m')` Macro:**

```sql
SELECT
  $__timeGroupAlias(time_date_time,'5m'),
  min(value_double),
  'min' as metric
FROM my_data
WHERE $__timeFilter(time_date_time)
GROUP BY time
ORDER BY time
```

Table panel result:

{{< figure alt="output of time group alias macro" src="/media/docs/grafana/data-sources/mysql/screenshot-timeGroupAlias-macro.png" >}}

The following result is similar to the result of the `$__timeGroup(dateColumn,'5m')` macro, except it uses a built-in alias for the time column.
To customize the default series name formatting (optional), refer to [Standard options definitions](ref:configure-standard-options).

**Example with `$__timeGroupAlias` Macro to convert null values to zero instead:**

```sql
SELECT
  $__timeGroupAlias(createdAt,'5m',0),
  sum(value_double) as value,
  hostname
FROM my_data
WHERE
  $__timeFilter(createdAt)
GROUP BY time, hostname
ORDER BY time
```

Table panel result:

{{< figure alt="output of null values to zero case, for time group alias macro" src="/media/docs/grafana/data-sources/mysql/screenshot-timeGroupAlias-macro-conv-null-to-zero.png" >}}

Given the result in the following example, null values within bucket timestamps are replaced by zero and also add the `Time` column alias by default. To customize the default series name formatting (optional), refer to [Standard options definitions](ref:configure-standard-options) to display the value of `${__field.labels.hostname}`.

**Example with multiple columns for `$__timeGroupAlias(dateColumn,'5m')` Macro:**

```sql
SELECT
  $__timeGroupAlias(time_date_time,'5m'),
  min(value_double) as min_value,
  max(value_double) as max_value
FROM my_data
WHERE $__timeFilter(time_date_time)
GROUP BY time
ORDER BY time
```

Table panel result:

{{< figure alt="output with multiple colummns for time group alias macro" src="/media/docs/grafana/data-sources/mysql/screenshot-timeGroupAlias-macro-multiple-columns.png" >}}

The query returns multiple columns representing minimum and maximum values within the defined range.

## Template variables

Instead of hard-coding values like server, application, or sensor names in your metric queries, you can use variables. Variables appear as drop-down select boxes at the top of the dashboard, making it easy to change the data displayed in your dashboard.

For detailed information on using template variables with MySQL, refer to [MySQL template variables](ref:mysql-template-variables).

## Annotations

Annotations allow you to overlay event information on your graphs, helping you correlate events with metrics. You can write SQL queries that return event data to display as annotations on your dashboards.

For detailed information on creating annotations with MySQL, refer to [MySQL annotations](ref:mysql-annotations).

## Alerting

You can use time series queries to create Grafana-managed alert rules. Table formatted queries are not supported in alert rule conditions.

For detailed information on creating alerts with MySQL, refer to [MySQL alerting](ref:mysql-alerting).
