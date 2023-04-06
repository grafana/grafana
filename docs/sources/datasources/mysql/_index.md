---
aliases:
  - ../data-sources/mysql/
  - ../features/datasources/mysql/
description: Guide for using MySQL in Grafana
keywords:
  - grafana
  - mysql
  - guide
menuTitle: MySQL
title: MySQL data source
weight: 1000
---

# MySQL data source

> Starting from Grafana v5.1 you can name the time column _time_ in addition to earlier supported _time_sec_. Usage of _time_sec_ will eventually be deprecated.

Grafana ships with a built-in MySQL data source plugin that allows you to query and visualize data from a MySQL compatible database.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

## Configure the data source

**To access the data source configuration page:**

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `MySQL` in the search bar.
1. Select **MySQL**.

   The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options.

### Data source options

| Name               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Name`             | The data source name. This is how you refer to the data source in panels and queries.                                                                                                                                                                                                                                                                                                                                                                                   |
| `Default`          | Default data source means that it will be pre-selected for new panels.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Host`             | The IP address/hostname and optional port of your MySQL instance.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Database`         | Name of your MySQL database.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `User`             | Database user's login/username                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Password`         | Database user's password                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Session Timezone` | Specify the time zone used in the database session, such as `Europe/Berlin` or `+02:00`. This is necessary, if the timezone of the database (or the host of the database) is set to something other than UTC. Set the value used in the session with `SET time_zone='...'`. If you leave this field empty, then the time zone is not updated. For more information, refer to the [MySQL documentation](https://dev.mysql.com/doc/refman/8.0/en/time-zone-support.html). |
| `Max open`         | The maximum number of open connections to the database, default `unlimited` (Grafana v5.4+).                                                                                                                                                                                                                                                                                                                                                                            |
| `Max idle`         | The maximum number of connections in the idle connection pool, default `2` (Grafana v5.4+).                                                                                                                                                                                                                                                                                                                                                                             |
| `Max lifetime`     | The maximum amount of time in seconds a connection may be reused, default `14400`/4 hours. This should always be lower than configured [wait_timeout](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_wait_timeout) in MySQL (Grafana v5.4+).                                                                                                                                                                                               |

### Min time interval

The **Min time interval** setting defines a lower limit for the [`$__interval`]({{< relref "../../dashboards/variables/add-template-variables#__interval" >}}) and [`$__interval_ms`]({{< relref "../../dashboards/variables/add-template-variables#__interval_ms" >}}) variables.

This value _must_ be formatted as a number followed by a valid time identifier:

| Identifier | Description |
| ---------- | ----------- |
| `y`        | year        |
| `M`        | month       |
| `w`        | week        |
| `d`        | day         |
| `h`        | hour        |
| `m`        | minute      |
| `s`        | second      |
| `ms`       | millisecond |

We recommend setting this value to match your MySQL write frequency.
For example, use `1m` if MySQL writes data every minute.

You can also override this setting in a dashboard panel under its data source options.

### Database User Permissions (Important!)

The database user you specify when you add the data source should only be granted SELECT permissions on
the specified database and tables you want to query. Grafana does not validate that the query is safe. The query
could include any SQL statement. For example, statements like `USE otherdb;` and `DROP TABLE user;` would be
executed. To protect against this we **Highly** recommend you create a specific mysql user with restricted permissions.

Example:

```sql
 CREATE USER 'grafanaReader' IDENTIFIED BY 'password';
 GRANT SELECT ON mydatabase.mytable TO 'grafanaReader';
```

You can use wildcards (`*`) in place of database or table if you want to grant access to more databases and tables.

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

#### Provisioning examples

##### Basic Provisioning

```yaml
apiVersion: 1

datasources:
  - name: MySQL
    type: mysql
    url: localhost:3306
    user: grafana
    jsonData:
      database: grafana
      maxOpenConns: 0 # Grafana v5.4+
      maxIdleConns: 2 # Grafana v5.4+
      connMaxLifetime: 14400 # Grafana v5.4+
    secureJsonData:
      password: ${GRAFANA_MYSQL_PASSWORD}
```

##### Using TLS Verificaiton

```yaml
apiVersion: 1

datasources:
  - name: MySQL
    type: mysql
    url: localhost:3306
    user: grafana
    jsonData:
      tlsAuth: true
      database: grafana
      maxOpenConns: 0 # Grafana v5.4+
      maxIdleConns: 2 # Grafana v5.4+
      connMaxLifetime: 14400 # Grafana v5.4+
    secureJsonData:
      password: ${GRAFANA_MYSQL_PASSWORD}
      tlsClientCert: ${GRAFANA_TLS_CLIENT_CERT}
      tlsCACert: ${GRAFANA_TLS_CA_CERT}
```

##### Use TLS and Skip Certificate Verification

```yaml
apiVersion: 1

datasources:
  - name: MySQL
    type: mysql
    url: localhost:3306
    user: grafana
    jsonData:
      tlsAuth: true
      skipTLSVerify: true
      database: grafana
      maxOpenConns: 0 # Grafana v5.4+
      maxIdleConns: 2 # Grafana v5.4+
      connMaxLifetime: 14400 # Grafana v5.4+
    secureJsonData:
      password: ${GRAFANA_MYSQL_PASSWORD}
      tlsClientCert: ${GRAFANA_TLS_CLIENT_CERT}
      tlsCACert: ${GRAFANA_TLS_CA_CERT}
```

## Query builder

{{< figure src="/static/img/docs/v92/mysql_query_builder.png" class="docs-image--no-shadow" >}}

The MySQL query builder is available when editing a panel using a MySQL data source.

This topic explains querying specific to the MySQL data source.
For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../panels-visualizations/query-transform-data/" >}}).

You can run the built query by pressing the `Run query` button in the top right corner of the editor.

### Format

The response from MySQL can be formatted as either a table or as a time series. To use the time series format one of the columns must be named `time`.

### Dataset and Table selection

> **Note:** If your table or database name contains a reserved word or a [not permitted character](https://dev.mysql.com/doc/refman/8.0/en/identifiers.html) the editor will put quotes around them. For example a table name like `table-name` will be quoted with backticks `` `table-name` ``.

In the dataset dropdown, choose the MySQL database to query. The dropdown is be populated with the databases that the user has access to.
When the dataset is selected, the table dropdown is populated with the tables that are available.

NOTE: If a default database has been choosen through the Data Source configuration page, the Dataset Dropdown will be disabled, and only that configured database will be avilable for querying.

### Columns and Aggregation functions (SELECT)

Using the dropdown, select a column to include in the data. You can also specify an optional aggregation function.

Add further value columns by clicking the plus button and another column dropdown appears.

### Filter data (WHERE)

To add a filter, flip the switch at the top of the editor.
Using the first dropdown, select if all the filters need to match (AND) or if only one of the filters needs to match (OR).

To add more columns to filter on use the plus button.

### Group By

To group the results by column, flip the group switch at the top of the editor. You can then choose which column to group the results by. The group by clause can be removed by pressing the X button.

### Preview

By flipping the preview switch at the top of the editor, you can get a preview of the SQL query generated by the query builder.

## Code editor

{{< figure src="/static/img/docs/v92/sql_code_editor.png" class="docs-image--no-shadow" >}}

To make advanced queries, switch to the code editor by clicking `code` in the top right corner of the editor. The code editor support autocompletion of tables, columns, SQL keywords, standard sql functions, Grafana template variables and Grafana macros. Columns cannot be completed before a table has been specified.

You can expand the code editor by pressing the `chevron` pointing downwards in the lower right corner of the code editor.

`CTRL/CMD + Return` works as a keyboard shortcut to run the query.

## Macros

To simplify syntax and to allow for dynamic parts, like date range filters, the query can contain macros.

| Macro example                                         | Description                                                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$__time(dateColumn)`                                 | Will be replaced by an expression to convert to a UNIX timestamp and rename the column to `time_sec`. For example, _UNIX_TIMESTAMP(dateColumn) as time_sec_                                                  |
| `$__timeEpoch(dateColumn)`                            | Will be replaced by an expression to convert to a UNIX timestamp and rename the column to `time_sec`. For example, _UNIX_TIMESTAMP(dateColumn) as time_sec_                                                  |
| `$__timeFilter(dateColumn)`                           | Will be replaced by a time range filter using the specified column name. For example, _dateColumn BETWEEN FROM_UNIXTIME(1494410783) AND FROM_UNIXTIME(1494410983)_                                           |
| `$__timeFrom()`                                       | Will be replaced by the start of the currently active time selection. For example, _FROM_UNIXTIME(1494410783)_                                                                                               |
| `$__timeTo()`                                         | Will be replaced by the end of the currently active time selection. For example, _FROM_UNIXTIME(1494410983)_                                                                                                 |
| `$__timeGroup(dateColumn,'5m')`                       | Will be replaced by an expression usable in GROUP BY clause. For example, *cast(cast(UNIX_TIMESTAMP(dateColumn)/(300) as signed)*300 as signed),\*                                                           |
| `$__timeGroup(dateColumn,'5m', 0)`                    | Same as above but with a fill parameter so missing points in that series will be added by grafana and 0 will be used as value.                                                                               |
| `$__timeGroup(dateColumn,'5m', NULL)`                 | Same as above but NULL will be used as value for missing points.                                                                                                                                             |
| `$__timeGroup(dateColumn,'5m', previous)`             | Same as above but the previous value in that series will be used as fill value if no value has been seen yet NULL will be used (only available in Grafana 5.3+).                                             |
| `$__timeGroupAlias(dateColumn,'5m')`                  | Will be replaced identical to $\_\_timeGroup but with an added column alias (only available in Grafana 5.3+).                                                                                                |
| `$__unixEpochFilter(dateColumn)`                      | Will be replaced by a time range filter using the specified column name with times represented as Unix timestamp. For example, _dateColumn > 1494410783 AND dateColumn < 1494497183_                         |
| `$__unixEpochFrom()`                                  | Will be replaced by the start of the currently active time selection as Unix timestamp. For example, _1494410783_                                                                                            |
| `$__unixEpochTo()`                                    | Will be replaced by the end of the currently active time selection as Unix timestamp. For example, _1494497183_                                                                                              |
| `$__unixEpochNanoFilter(dateColumn)`                  | Will be replaced by a time range filter using the specified column name with times represented as nanosecond timestamp. For example, _dateColumn > 1494410783152415214 AND dateColumn < 1494497183142514872_ |
| `$__unixEpochNanoFrom()`                              | Will be replaced by the start of the currently active time selection as nanosecond timestamp. For example, _1494410783152415214_                                                                             |
| `$__unixEpochNanoTo()`                                | Will be replaced by the end of the currently active time selection as nanosecond timestamp. For example, _1494497183142514872_                                                                               |
| `$__unixEpochGroup(dateColumn,'5m', [fillmode])`      | Same as $\_\_timeGroup but for times stored as Unix timestamp (only available in Grafana 5.3+).                                                                                                              |
| `$__unixEpochGroupAlias(dateColumn,'5m', [fillmode])` | Same as above but also adds a column alias (only available in Grafana 5.3+).                                                                                                                                 |

We plan to add many more macros. If you have suggestions for what macros you would like to see, please [open an issue](https://github.com/grafana/grafana) in our GitHub repo.

The query editor has a link named `Generated SQL` that shows up after a query has been executed, while in panel edit mode. Click on it and it will expand and show the raw interpolated SQL string that was executed.

## Table queries

If the `Format as` query option is set to `Table` then you can basically do any type of SQL query. The table panel will automatically show the results of whatever columns and rows your query returns.

Query editor with example query:

{{< figure src="/static/img/docs/v45/mysql_table_query.png" >}}

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

![](/static/img/docs/v43/mysql_table.png)

## Time series queries

If you set Format as to _Time series_, then the query must have a column named time that returns either a SQL datetime or any numeric datatype representing Unix epoch in seconds. In addition, result sets of time series queries must be sorted by time for panels to properly visualize the result.

A time series query result is returned in a [wide data frame format]({{< relref "../../developers/plugins/data-frames#wide-format" >}}). Any column except time or of type string transforms into value fields in the data frame query result. Any string column transforms into field labels in the data frame query result.

> For backward compatibility, there's an exception to the above rule for queries that return three columns including a string column named metric. Instead of transforming the metric column into field labels, it becomes the field name, and then the series name is formatted as the value of the metric column. See the example with the metric column below.

To optionally customize the default series name formatting, refer to [Standard options definitions]({{< relref "../../panels-visualizations/configure-standard-options#display-name" >}}).

**Example with `metric` column:**

```sql
SELECT
  $__timeGroup(time_date_time,'5m'),
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
+---------------------+-----------------+
```

**Example using the fill parameter in the $\_\_timeGroup macro to convert null values to be zero instead:**

```sql
SELECT
  $__timeGroup(createdAt,'5m',0),
  sum(value_double) as value,
  hostname
FROM test_data
WHERE
  $__timeFilter(createdAt)
GROUP BY time, hostname
ORDER BY time
```

Given the data frame result in the following example and using the graph panel, you will get two series named _value 10.0.1.1_ and _value 10.0.1.2_. To render the series with a name of _10.0.1.1_ and _10.0.1.2_ , use a [[Standard options definitions]({{< relref "../../panels-visualizations/configure-standard-options#display-name" >}}) display value of `${__field.labels.hostname}`.

Data frame result:

```text
+---------------------+---------------------------+---------------------------+
| Name: time          | Name: value               | Name: value               |
| Labels:             | Labels: hostname=10.0.1.1 | Labels: hostname=10.0.1.2 |
| Type: []time.Time   | Type: []float64           | Type: []float64           |
+---------------------+---------------------------+---------------------------+
| 2020-01-02 03:05:00 | 3                         | 4                         |
| 2020-01-02 03:10:00 | 6                         | 7                         |
+---------------------+---------------------------+---------------------------+
```

**Example with multiple columns:**

```sql
SELECT
  $__timeGroup(time_date_time,'5m'),
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
| 2020-01-02 03:04:00 | 3               | 4               |
| 2020-01-02 03:05:00 | 6               | 7               |
+---------------------+-----------------+-----------------+
```

Currently, there is no support for a dynamic group by time based on time range and panel width.
This is something we plan to add.

## Templating

This feature is currently available in the nightly builds and will be included in the 5.0.0 release.

Instead of hard-coding things like server, application and sensor name in your metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.

Check out the [Templating]({{< relref "../../dashboards/variables" >}}) documentation for an introduction to the templating feature and the different types of template variables.

### Query Variable

If you add a template variable of the type `Query`, you can write a MySQL query that can
return things like measurement names, key names or key values that are shown as a dropdown select box.

For example, you can have a variable that contains all values for the `hostname` column in a table if you specify a query like this in the templating variable _Query_ setting.

```sql
SELECT hostname FROM my_host
```

A query can return multiple columns and Grafana will automatically create a list from them. For example, the query below will return a list with values from `hostname` and `hostname2`.

```sql
SELECT my_host.hostname, my_other_host.hostname2 FROM my_host JOIN my_other_host ON my_host.city = my_other_host.city
```

To use time range dependent macros like `$__timeFilter(column)` in your query the refresh mode of the template variable needs to be set to _On Time Range Change_.

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

#### Using `__searchFilter` to filter results in Query Variable

> Available from Grafana 6.5 and above

Using `__searchFilter` in the query field will filter the query result based on what the user types in the dropdown select box.
When nothing has been entered by the user the default value for `__searchFilter` is `%`.

> Important that you surround the `__searchFilter` expression with quotes as Grafana does not do this for you.

The example below shows how to use `__searchFilter` as part of the query field to enable searching for `hostname` while the user types in the dropdown select box.

Query

```sql
SELECT hostname FROM my_host  WHERE hostname LIKE '$__searchFilter'
```

### Using Variables in Queries

From Grafana 4.3.0 to 4.6.0, template variables are always quoted automatically so if it is a string value do not wrap them in quotes in where clauses.

From Grafana 4.7.0, template variable values are only quoted when the template variable is a `multi-value`.

If the variable is a multi-value variable then use the `IN` comparison operator rather than `=` to match against multiple values.

There are two syntaxes:

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

#### Disabling Quoting for Multi-value Variables

Grafana automatically creates a quoted, comma-separated string for multi-value variables. For example: if `server01` and `server02` are selected then it will be formatted as: `'server01', 'server02'`. Do disable quoting, use the csv formatting option for variables:

`${servers:csv}`

Read more about variable formatting options in the [Variables]({{< relref "../../dashboards/variables/variable-syntax#advanced-variable-format-options" >}}) documentation.

## Annotations

[Annotations]({{< relref "../../dashboards/build-dashboards/annotate-visualizations" >}}) allow you to overlay rich event information on top of graphs. You add annotation queries via the Dashboard menu / Annotations view.

**Example query using time column with epoch values:**

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

**Example region query using time and timeend columns with epoch values:**

> Only available in Grafana v6.6+.

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

**Example query using time column of native SQL date/time data type:**

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

| Name      | Description                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `time`    | The name of the date/time field. Could be a column with a native SQL date/time data type or epoch value.                          |
| `timeend` | Optional name of the end date/time field. Could be a column with a native SQL date/time data type or epoch value. (Grafana v6.6+) |
| `text`    | Event description field.                                                                                                          |
| `tags`    | Optional field name to use for event tags as a comma separated string.                                                            |

## Alerting

Time series queries should work in alerting conditions. Table formatted queries are not yet supported in alert rule conditions.
