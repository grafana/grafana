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
menuTitle: MySQL query editor
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
---

# MySQL query editor

Grafana’s query editors are unique for each data source. For general information on Grafana query editors, refer to [Query editors](ref:query-editor). For general information on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

The MySQL query editor is located on the [Explore page](ref:explore). You can also access the MySQL query editor from a dashboard panel. Click the ellipsis in the upper right of the panel and select **Edit**.

{{< admonition type="note" >}}
If a default database is configured in the **Data Source Configuration page**, or via a provisioning configuration file, users will be restricted to querying only that pre-configured database. This feature is behind a feature flag and is available once you enable `sqlDatasourceDatabaseSelection`.
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

| Macro example                                         | Description                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$__time(dateColumn)`                                 | Replaces the value with an expression to convert to a UNIX timestamp and renames the column to `time_sec`. Example: _UNIX_TIMESTAMP(dateColumn) AS time_sec_.                                                             |
| `$__timeEpoch(dateColumn)`                            | Replaces the value with an expression to convert to a UNIX Epoch timestamp and renames the column to `time_sec`. Example: _UNIX_TIMESTAMP(dateColumn) AS time_sec_.                                                       |
| `$__timeFilter(dateColumn)`                           | Replaces the value a time range filter using the specified column name. Example: _dateColumn BETWEEN FROM_UNIXTIME(1494410783) AND FROM_UNIXTIME(1494410983)_                                                             |
| `$__timeFrom()`                                       | Replaces the value with the start of the currently active time selection. Example: _FROM_UNIXTIME(1494410783)_                                                                                                            |
| `$__timeTo()`                                         | Replaces the value with the end of the currently active time selection. Example: _FROM_UNIXTIME(1494410983)_                                                                                                              |
| `$__timeGroup(dateColumn,'5m')`                       | Replaces the value with an expression suitable for use in a GROUP BY clause. Example: *cast(cast(UNIX_TIMESTAMP(dateColumn)/(300) as signed)*300 as signed),\*                                                            |
| `$__timeGroup(dateColumn,'5m', 0)`                    | Same as the `$__timeGroup(dateColumn,'5m')` macro, but includes a fill parameter to ensure missing points in the series are added by Grafana, using 0 as the default value. **This applies only to time series queries.** |
| `$__timeGroup(dateColumn,'5m', NULL)`                 | Same as the `$__timeGroup(dateColumn,'5m', 0)` but NULL is used as the value for missing points. **This applies only to time series queries.**                                                                            |
| `$__timeGroup(dateColumn,'5m', previous)`             | Same as the `$__timeGroup(dateColumn,'5m', previous)` macro, but uses the previous value in the series as the fill value. If no previous value exists,`NULL` will be used. **This applies only to time series queries.**  |
| `$__timeGroupAlias(dateColumn,'5m')`                  | Replaces the value identical to $\_\_timeGroup but with an added column alias.                                                                                                                                            |
| `$__unixEpochFilter(dateColumn)`                      | Replaces the value by a time range filter using the specified column name with times represented as a UNIX timestamp. Example: _dateColumn > 1494410783 AND dateColumn < 1494497183_                                      |
| `$__unixEpochFrom()`                                  | Replaces the value with the start of the currently active time selection as a UNIX timestamp. Example: _1494410783_                                                                                                       |
| `$__unixEpochTo()`                                    | Replaces the value with the end of the currently active time selection as UNIX timestamp. Example: _1494497183_                                                                                                           |
| `$__unixEpochNanoFilter(dateColumn)`                  | Replaces the value with a time range filter using the specified column name with time represented as a nanosecond timestamp. Example: _dateColumn > 1494410783152415214 AND dateColumn < 1494497183142514872_             |
| `$__unixEpochNanoFrom()`                              | Replaces the value with the start of the currently active time selection as nanosecond timestamp. Example: _1494410783152415214_                                                                                          |
| `$__unixEpochNanoTo()`                                | Replaces the value with the end of the currently active time selection as nanosecond timestamp. Example: _1494497183142514872_                                                                                            |
| `$__unixEpochGroup(dateColumn,'5m', [fillmode])`      | Same as $\_\_timeGroup but for times stored as Unix timestamp. **Note that `fillMode` only works with time series queries.**                                                                                              |
| `$__unixEpochGroupAlias(dateColumn,'5m', [fillmode])` | Same as $\_\_timeGroup but also adds a column alias. **Note that `fillMode` only works with time series queries.**                                                                                                        |

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
| 2020-01-02 03:05:00 | 3.0          | 2020-01-02 03:05:00 | 10.0.1.1 |
| 2020-01-02 03:06:00 | 4.0          | 2020-01-02 03:06:00 | 10.0.1.2 |
| 2020-01-02 03:10:00 | 6.0          | 2020-01-02 03:10:00 | 10.0.1.1 |
| 2020-01-02 03:11:00 | 7.0          | 2020-01-02 03:11:00 | 10.0.1.2 |
| 2020-01-02 03:20:00 | 5.0          | 2020-01-02 03:20:00 | 10.0.1.2 |
+---------------------+--------------+---------------------+----------+
```

A time series query result is returned in a [wide data frame format](https://grafana.com/developers/plugin-tools/key-concepts/data-frames#wide-format). Any column except time or of type string transforms into value fields in the data frame query result. Any string column transforms into field labels in the data frame query result.

{{< admonition type="note" >}}
For backward compatibility, an exception to the aforementioned rule applies to queries returning three columns, including a string column named `metric`. Instead of converting the metric column into field labels, it is used as the field name, and the series name is set to the value of the metric column. Refer to the following example with a metric column.
{{< /admonition >}}

**Example with `metric` column:**

```sql
SELECT
  $__timeGroupAlias(time_date_time,'5m'),
  min(value_double),
  'min' as metric
FROM test_data
WHERE $__timeFilter(time_date_time)
GROUP BY time
ORDER BY time
```

Data frame result:

```text
+---------------------+-----------------+
| Name: time          | Name: min       |
| Labels:             | Labels:         |
| Type: []time.Time   | Type: []float64 |
+---------------------+-----------------+
| 2020-01-02 03:05:00 | 3               |
| 2020-01-02 03:10:00 | 6               |
| 2020-01-02 03:20:00 | 5               |
+---------------------+-----------------+
```

To customize the default series name formatting (optional), refer to [Standard options definitions](ref:configure-standard-options-display-name).

**Example using the fill parameter in the $\_\_timeGroupAlias macro to convert null values to be zero instead:**

```sql
SELECT
  $__timeGroupAlias(createdAt,'5m',0),
  sum(value_double) as value,
  hostname
FROM test_data
WHERE
  $__timeFilter(createdAt)
GROUP BY time, hostname
ORDER BY time
```

Given the data frame result in the following example and using the graph panel, you will get two series named _value 10.0.1.1_ and _value 10.0.1.2_. To render the series with a name of _10.0.1.1_ and _10.0.1.2_ , use a [Standard options definitions](ref:configure-standard-options-display-name) display value of `${__field.labels.hostname}`.

Data frame result:

```text
+---------------------+---------------------------+---------------------------+
| Name: time          | Name: value               | Name: value               |
| Labels:             | Labels: hostname=10.0.1.1 | Labels: hostname=10.0.1.2 |
| Type: []time.Time   | Type: []float64           | Type: []float64           |
+---------------------+---------------------------+---------------------------+
| 2020-01-02 03:05:00 | 3                         | 4                         |
| 2020-01-02 03:10:00 | 6                         | 7                         |
| 2020-01-02 03:15:00 | 0                         | 0                         |
| 2020-01-02 03:20:00 | 0                         | 5                         |
+---------------------+---------------------------+---------------------------+
```

**Example with multiple columns:**

```sql
SELECT
  $__timeGroupAlias(time_date_time,'5m'),
  min(value_double) as min_value,
  max(value_double) as max_value
FROM test_data
WHERE $__timeFilter(time_date_time)
GROUP BY time
ORDER BY time
```

Data frame result:

```text
+---------------------+-----------------+-----------------+
| Name: time          | Name: min_value | Name: max_value |
| Labels:             | Labels:         | Labels:         |
| Type: []time.Time   | Type: []float64 | Type: []float64 |
+---------------------+-----------------+-----------------+
| 2020-01-02 03:05:00 | 3               | 4               |
| 2020-01-02 03:10:00 | 6               | 7               |
| 2020-01-02 03:20:00 | 5               | 5               |
+---------------------+-----------------+-----------------+
```

## Templating

Instead of hardcoding values like server, application, or sensor names in your metric queries, you can use variables. Variables appear as drop-down select boxes at the top of the dashboard. These drop-downs make it easy to change the data being displayed in your dashboard.

Refer to [Templates](ref:variables) for an introduction to creating template variables as well as the different types.

### Query variable

If you add a `Query` template variable you can write a MySQL query to retrieve items such as measurement names, key names, or key values, which will be displayed in the drop-down menu.

For example, you can use a variable to retrieve all the values from the `hostname` column in a table by creating the following query in the templating variable _Query_ setting.

```sql
SELECT hostname FROM my_host
```

A query can return multiple columns, and Grafana will automatically generate a list based on the query results. For example, the following query returns a list with values from `hostname` and `hostname2`.

```sql
SELECT my_host.hostname, my_other_host.hostname2 FROM my_host JOIN my_other_host ON my_host.city = my_other_host.city
```

To use time range dependent macros like `$__timeFilter(column)` in your query,you must set the template variable's refresh mode to _On Time Range Change_.

```sql
SELECT event_name FROM event_log WHERE $__timeFilter(time_column)
```

Another option is a query that can create a key/value variable. The query should return two columns that are named `__text` and `__value`. The `__text` column must contain unique values (if not, only the first value is used). This allows the drop-down options to display a text-friendly name as the text while using an ID as the value. For example, a query could use `hostname` as the text and `id` as the value:

```sql
SELECT hostname AS __text, id AS __value FROM my_host
```

You can also create nested variables. For example, if you have a variable named `region`, you can configure the `hosts` variable to display only the hosts within the currently selected region as shown in the following example. If `region` is a multi-value variable, use the `IN` operator instead of `=` to match multiple values.

```sql
SELECT hostname FROM my_host  WHERE region IN($region)
```

#### Use `__searchFilter` to filter results in a query variable

Using `__searchFilter` in the query field allows the query results to be filtered based on the user’s input in the drop-down selection box. If you do not enter anything, the default value for `__searchFilter` is %

Note that you must enclose the `__searchFilter` expression in quotes as Grafana does not add them automatically.

The following example demonstrates how to use `__searchFilter` in the query field to enable real-time searching for `hostname` as the user type in the drop-down selection box.

```sql
SELECT hostname FROM my_host  WHERE hostname LIKE '$__searchFilter'
```

### Using variables in queries

Template variable values are only quoted when the template variable is a `multi-value`.

If the variable is a multi-value variable, use the `IN` comparison operator instead of `=` to match against multiple values.

You can use two different syntaxes:

`$<varname>` Example with a template variable named `hostname`:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time,
  aint as value,
  avarchar as metric
FROM my_table
WHERE $__timeFilter(atimestamp) and hostname in($hostname)
ORDER BY atimestamp ASC
```

`[[varname]]` Example with a template variable named `hostname`:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time,
  aint as value,
  avarchar as metric
FROM my_table
WHERE $__timeFilter(atimestamp) and hostname in([[hostname]])
ORDER BY atimestamp ASC
```

#### Disabling quoting for multi-value variables

Grafana automatically creates a quoted, comma-separated string for multi-value variables. For example: if `server01` and `server02` are selected then it will be formatted as: `'server01', 'server02'`. To disable quoting, use the csv formatting option for variables:

Grafana automatically formats multi-value variables as a quoted, comma-separated string. For example, if `server01` and `server02` are selected, they are formatted as `'server01'`, `'server02'`. To remove the quotes, enable the CSV formatting option for the variables.

`${servers:csv}`

Read more about variable formatting options in the [Variables](ref:variable-syntax-advanced-variable-format-options) documentation.

## Annotations

[Annotations](ref:annotate-visualizations) allow you to overlay rich event information on top of graphs. You add annotation queries via the **Dashboard settings > Annotations view**.

**Example query using a`time` column with epoch values:**

```sql
SELECT
  epoch_time as time,
  metric1 as text,
  CONCAT(tag1, ',', tag2) as tags
FROM
  public.test_data
WHERE
  $__unixEpochFilter(epoch_time)
```

**Example region query using `time` and `timeend` columns with epoch values:**

```sql
SELECT
  epoch_time as time,
  epoch_timeend as timeend,
  metric1 as text,
  CONCAT(tag1, ',', tag2) as tags
FROM
  public.test_data
WHERE
  $__unixEpochFilter(epoch_time)
```

**Example query using a `time` column with a native SQL date/time data type:**

```sql
SELECT
  native_date_time as time,
  metric1 as text,
  CONCAT(tag1, ',', tag2) as tags
FROM
  public.test_data
WHERE
  $__timeFilter(native_date_time)
```

| Name      | Description                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `time`    | The name of the date/time field, which can be a column with a native SQL date/time data type or epoch value.          |
| `timeend` | Optional name of the end date/time field, which can be a column with a native SQL date/time data type or epoch value. |
| `text`    | Event description field.                                                                                              |
| `tags`    | Optional field name to use for event tags as a comma separated string.                                                |

## Alerting

Use time series queries to create alerts. Table formatted queries aren't yet supported in alert rule conditions.

For more information regarding alerting refer to the following:

- [Alert rules](ref:alert-rules)
- [Template annotations and labels](ref:template-annotations-and-labels)
