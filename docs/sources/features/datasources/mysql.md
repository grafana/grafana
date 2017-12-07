+++
title = "Using MySQL in Grafana"
description = "Guide for using MySQL in Grafana"
keywords = ["grafana", "mysql", "guide"]
type = "docs"
[menu.docs]
name = "MySQL"
parent = "datasources"
weight = 7
+++

# Using MySQL in Grafana

> Only available in Grafana v4.3+.

Grafana ships with a built-in MySQL data source plugin that allow you to query any visualize
data from a MySQL compatible database.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select *MySQL* from the *Type* dropdown.

### Database User Permissions (Important!)

The database user you specify when you add the data source should only be granted SELECT permissions on
the specified database & tables you want to query. Grafana does not validate that the query is safe. The query
could include any SQL statement. For example, statements like `USE otherdb;` and `DROP TABLE user;` would be
executed. To protect against this we **Highly** recommmend you create a specific mysql user with restricted permissions.

Example:

```sql
 CREATE USER 'grafanaReader' IDENTIFIED BY 'password';
 GRANT SELECT ON mydatabase.mytable TO 'grafanaReader';
```

You can use wildcards (`*`)  in place of database or table if you want to grant access to more databases and tables.

## Macros

To simplify syntax and to allow for dynamic parts, like date range filters, the query can contain macros.

Macro example | Description
------------ | -------------
*$__timeFilter(dateColumn)* | Will be replaced by a time range filter using the specified column name. For example, *dateColumn > FROM_UNIXTIME(1494410783) AND dateColumn < FROM_UNIXTIME(1494497183)*

We plan to add many more macros. If you have suggestions for what macros you would like to see, please [open an issue](https://github.com/grafana/grafana) in our GitHub repo.

The query editor has a link named `Generated SQL` that show up after a query as been executed, while in panel edit mode. Click on it and it will expand and show the raw interpolated SQL string that was executed.

## Table queries

If the `Format as` query option is set to `Table` then you can basically do any type of SQL query. The table panel will automatically show the results of whatever columns & rows your query returns.

Query editor with example query:

{{< docs-imagebox img="/img/docs/v45/mysql_table_query.png" >}}

The query:

```sql
SELECT
  title as 'Title',
  user.login as 'Created By' ,
  dashboard.created as 'Created On'
 FROM dashboard
INNER JOIN user on user.id = dashboard.created_by
WHERE $__timeFilter(dashboard.created)
```

You can control the name of the Table panel columns by using regular `as ` SQL column selection syntax.

The resulting table panel:

![](/img/docs/v43/mysql_table.png)

### Time series queries

If you set `Format as` to `Time series`, for use in Graph panel for example, then there are some requirements for
what your query returns.

- Must be a column named `time_sec` representing a unix epoch in seconds.
- Must be a column named `value` representing the time series value.
- Must be a column named `metric` representing the time series name.

Example:

```sql
SELECT
  min(UNIX_TIMESTAMP(time_date_time)) as time_sec,
  max(value_double) as value,
  metric1 as metric
FROM test_data
WHERE   $__timeFilter(time_date_time)
GROUP BY metric1, UNIX_TIMESTAMP(time_date_time) DIV 300
ORDER BY time_sec asc
```

Currently, there is no support for a dynamic group by time based on time range & panel width.
This is something we plan to add.

## Templating

This feature is currently available in the nightly builds and will be included in the 5.0.0 release.

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different types of template variables.

### Query Variable

If you add a template variable of the type `Query`, you can write a MySQL query that can
return things like measurement names, key names or key values that are shown as a dropdown select box.

For example, you can have a variable that contains all values for the `hostname` column in a table if you specify a query like this in the templating variable *Query* setting.

```sql
SELECT hostname FROM my_host
```

A query can returns multiple columns and Grafana will automatically create a list from them. For example, the query below will return a list with values from `hostname` and `hostname2`.

```sql
SELECT my_host.hostname, my_other_host.hostname2 FROM my_host JOIN my_other_host ON my_host.city = my_other_host.city
```

To use time range dependent macros like `$__timeFilter(column)` in your query the refresh mode of the template variable needs to be set to *On Time Range Change*.

```sql
SELECT event_name FROM event_log WHERE $__timeFilter(time_column)
```

Another option is a query that can create a key/value variable. The query should return two columns that are named `__text` and `__value`. The `__text` column value should be unique (if it is not unique then the first value is used). The options in the dropdown will have a text and value that allows you to have a friendly name as text and an id as the value. An example query with `hostname` as the text and `id` as the value:

```sql
SELECT hostname AS __text, id AS __value FROM my_host
```

You can also create nested variables. For example if you had another variable named `region`. Then you could have
the hosts variable only show hosts from the current selected region with a query like this (if `region` is a multi-value variable then use the `IN` comparison operator rather than `=` to match against multiple values):

```sql
SELECT hostname FROM my_host  WHERE region IN($region)
```

### Using Variables in Queries

From Grafana 4.3.0 to 4.6.0, template variables are always quoted automatically so if it is a string value do not wrap them in quotes in where clauses.

From Grafana 4.7.0, template variable values are only quoted when the template variable is a `multi-value`.

If the variable is a multi-value variable then use the `IN` comparison operator rather than `=` to match against multiple values.

There are two syntaxes:

`$<varname>`  Example with a template variable named `hostname`:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time_sec,
  aint as value,
  avarchar as metric
FROM my_table
WHERE $__timeFilter(atimestamp) and hostname in($hostname)
ORDER BY atimestamp ASC
```

`[[varname]]`  Example with a template variable named `hostname`:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time_sec,
  aint as value,
  avarchar as metric
FROM my_table
WHERE $__timeFilter(atimestamp) and hostname in([[hostname]])
ORDER BY atimestamp ASC
```

## Annotations

[Annotations]({{< relref "reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation queries via the Dashboard menu / Annotations view.

An example query:

```sql
SELECT
  UNIX_TIMESTAMP(atimestamp) as time_sec,
  value as text,
  CONCAT(tag1, ',', tag2) as tags
FROM my_table
WHERE $__timeFilter(atimestamp)
ORDER BY atimestamp ASC
```

Name | Description
------------ | -------------
time_sec | The name of the date/time field.
text | Event description field.
tags | Optional field name to use for event tags as a comma separated string.

## Alerting

Time series queries should work in alerting conditions. Table formatted queries is not yet supported in alert rule conditions.
