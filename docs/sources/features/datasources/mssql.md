+++
title = "Using MSSQL in Grafana"
description = "Guide for using MSSQL in Grafana"
keywords = ["grafana", "MSSQL", "guide"]
type = "docs"
[menu.docs]
name = "MSSQL"
parent = "datasources"
weight = 7
+++

# Using MSSQL in Grafana

Grafana ships with a built-in MSSQL data source plugin that allows you to query and visualize data from any MS SQL server 2005 or newer.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select *MSSQL* from the *Type* dropdown.

### Database User Permissions (Important!)

The database user you specify when you add the data source should only be granted SELECT permissions on
the specified database & tables you want to query. Grafana does not validate that the query is safe. The query
could include any SQL statement. For example, statements like `DELETE FROM user;` and `DROP TABLE user;` would be
executed. To protect against this we **Highly** recommmend you create a specific MSSQL user with restricted permissions.

Example:

```sql
 CREATE USER grafanareader WITH PASSWORD 'password'
 GRANT SELECT ON dbo.YourTable3 TO grafanareader
```

Make sure the user does not get any unwanted privileges from the public role.

## Macros

To simplify syntax and to allow for dynamic parts, like date range filters, the query can contain macros.

Macro example | Description
------------ | -------------
*$__time(dateColumn)* | Will rename the column to `time`. For example, *dateColumn AS time*.
*$__utcTime(dateColumn)* | Will be replaced by an expression to convert a DATETIME column type to UTC depending on the server's local timeoffset and rename it to `time`. For example, *DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), dateColumn) ) AS time*
*$__timeEpoch(dateColumn)* | Will be replaced by an expression to convert a DATETIME column type to unix timestamp and rename the it to `time`. For example, *DATEDIFF(second, {d '1970-01-01'}, DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), dateColumn) ) AS time*
*$__timeFilter(dateColumn)* | Will be replaced by a time range filter using the specified column name. For example, *dateColumn >= DATEADD(s, 1494410783+DATEDIFF(second,GETUTCDATE(),GETDATE()), '1970-01-01') AND dateColumn <= DATEADD(s, 1494497183+DATEDIFF(second,GETUTCDATE(),GETDATE()), '1970-01-01')*
*$__timeFrom()* | Will be replaced by the start of the currently active time selection. For example, *DATEADD(second, 1494410783+DATEDIFF(second,GETUTCDATE(),GETDATE()), '1970-01-01')*
*$__timeTo()* | Will be replaced by the end of the currently active time selection. For example, *DATEADD(second, 1494497183+DATEDIFF(second,GETUTCDATE(),GETDATE()), '1970-01-01')*
*$__unixEpochFilter(dateColumn)* | Will be replaced by a time range filter using the specified column name with times represented as unix timestamp. For example, *dateColumn > 1494410783 AND dateColumn < 1494497183*
*$__unixEpochFrom()* | Will be replaced by the start of the currently active time selection as unix timestamp. For example, *1494410783*
*$__unixEpochTo()* | Will be replaced by the end of the currently active time selection as unix timestamp. For example, *1494497183*

We plan to add many more macros. If you have suggestions for what macros you would like to see, please [open an issue](https://github.com/grafana/grafana) in our GitHub repo.

The query editor has a link named `Generated SQL` that shows up after a query has been executed, while in panel edit mode. Click on it and it will expand and show the raw interpolated SQL string that was executed.

## Table queries

If the `Format as` query option is set to `Table` then you can basically do any type of SQL query. The table panel will automatically show the results of whatever columns & rows your query returns.

Query editor with example query:

![](/img/docs/v47/mssql_table_query.png)


The query:

```sql
SELECT  COLUMN_NAME AS [Name], 
        DATA_TYPE AS [Type],
        CHARACTER_OCTET_LENGTH AS [Length],
        NUMERIC_PRECISION as [Precisopn],	
        NUMERIC_PRECISION_RADIX AS [Radix],	
        NUMERIC_SCALE AS [Scale]
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'mssql_types';
```

You can control the name of the Table panel columns by using regular `AS ` SQL column selection syntax.

The resulting table panel:

![](/img/docs/v47/mssql_table.png)

### Time series queries

If you set `Format as` to `Time series`, for use in Graph panel for example, then the query must must have a column named `time` that returns either a sql datetime or any numeric datatype representing unix epoch in seconds. You may return a column named `metric` that is used as metric name for the value column. Any column except `time` and `metric` is treated as a value column. If you ommit the `metric` column, tha name of the value column will be the metric name. You may select multiple value columns, each will have its name as metric. If you select multiple value columns along with a `metric` column, the names ("MetircName - ColumnName") will be combined to make the metric name.

Example with `metric` column

```sql
SELECT
  [time_date_time] as [time],
  [value_double] as [value],
  [metric1] as [metric]
FROM [test_data]
WHERE   $__timeFilter([time_date_time])
ORDER BY [time_date_time]
```

Example with multiple `value` culumns

```sql
SELECT
  [time_date_time] as [time],
  [value_double1] as [metric_name1],
  [value_int2] as [metric_name2]
FROM [test_data]
WHERE   $__timeFilter([time_date_time])
ORDER BY [time_date_time]
```

Example with multiple `value` culumns combined with a `metric` column

```sql
SELECT
  [time_date_time] as [time],
  [value_double1] as [value1],
  [value_int2] as [value2],
  [metric_col] as [metric]
FROM [test_data]
WHERE   $__timeFilter([time_date_time])
ORDER BY [time_date_time]
```
The result of the above query would look something like the below

![](/img/docs/v47/mssql_metric_value.png)

Currently, there is no support for a dynamic group by time based on time range & panel width.
This is something we plan to add.

## Templating

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different types of template variables.

### Query Variable

If you add a template variable of the type `Query`, you can write a MSSQL query that can
return things like measurement names, key names or key values that are shown as a dropdown select box.

For example, you can have a variable that contains all values for the `hostname` column in a table if you specify a query like this in the templating variable *Query* setting.

```sql
SELECT hostname FROM host
```

A query can return multiple columns and Grafana will automatically create a list from them. For example, the query below will return a list with values from `hostname` and `hostname2`.

```sql
SELECT [host].[hostname], [other_host].[hostname2] FROM host JOIN other_host ON [host].[city] = [other_host].[city]
```

Another option is a query that can create a key/value variable. The query should return two columns that are named `__text` and `__value`. The `__text` column value should be unique (if it is not unique then the first value is used). The options in the dropdown will have a text and value that allows you to have a friendly name as text and an id as the value. An example query with `hostname` as the text and `id` as the value:

```sql
SELECT hostname __text, id __value FROM host
```

You can also create nested variables. For example if you had another variable named `region`. Then you could have
the hosts variable only show hosts from the current selected region with a query like this (if `region` is a multi-value variable then use the `IN` comparison operator rather than `=` to match against multiple values):

```sql
SELECT hostname FROM host WHERE region IN ($region)
```

### Using Variables in Queries

From Grafana 4.3.0 to 4.6.0, template variables are always quoted automatically so if it is a string value do not wrap them in quotes in where clauses.

From Grafana 4.7.0, template variable values are only quoted when the template variable is a `multi-value`.

If the variable is a multi-value variable then use the `IN` comparison operator rather than `=` to match against multiple values.

There are two syntaxes:

`$<varname>`  Example with a template variable named `hostname`:

```sql
SELECT
  atimestamp time,
  aint value
FROM table
WHERE $__timeFilter(atimestamp) and hostname in($hostname)
ORDER BY atimestamp
```

`[[varname]]`  Example with a template variable named `hostname`:

```sql
SELECT
  atimestamp as time,
  aint as value
FROM table
WHERE $__timeFilter(atimestamp) and hostname in([[hostname]])
ORDER BY atimestamp
```

## Annotations

[Annotations]({{< relref "reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation queries via the Dashboard menu / Annotations view.

An example query:

```sql
SELECT
  DATEDIFF(second, {d '1970-01-01'}, DATEADD(second, DATEDIFF(second,GETDATE(),GETUTCDATE()), time_column) ) as [time],
 metric1 as [text],
  convert(varvhar, metric1) + ',' + convert(varchar, metric2) as [tags] 
FROM
  test_data
WHERE
  $__timeFilter(time_column)
```

Name | Description
------------ | -------------
time | The name of the date/time field. could be in a native sql time datatype
text | Event description field.
tags | Optional field name to use for event tags as a comma separated string.

## Alerting

Time series queries should work in alerting conditions. Table formatted queries is not yet supported in alert rule
conditions.
